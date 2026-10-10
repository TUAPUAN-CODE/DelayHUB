// ส่ง token ยืนยันตัวตนไปกับ "ทุก" request ที่เรียก API ของระบบ (axios ทั้งตัวหลักและ axios.create + fetch ที่โค้ดเดิมใช้ ~245 จุด) โดยไม่ต้องแก้ทีละหน้า
//  - เก็บ token ไว้ใน localStorage "auth_token" (ได้จาก POST /api/login) — logout / เปิดหน้า login จะถูกล้างพร้อมข้อมูลผู้ใช้อื่น (clearUserLocalStorage)
//  - ส่งเฉพาะไปที่ API ของเรา (VITE_API_URL) ไม่ส่งให้โดเมนอื่น เช่น print agent
//  - server ตอบ 401 (ไม่มี token / หมดอายุ) → ล้างข้อมูลผู้ใช้แล้วกลับหน้า login
//  - token ใกล้หมดอายุ → ต่ออายุอัตโนมัติ (ต่อเนื่องได้ไม่เกิน 7 วัน)
import axios from "axios";
import { clearUserLocalStorage } from "./localStorageUtil";

const API_URL = import.meta.env.VITE_API_URL || "";
export const TOKEN_KEY = "auth_token";
export const UNLOCK_KEY = "sheetSettingUnlockToken"; // ใบอนุญาตปลดล็อกหน้า Setting (sessionStorage = เฉพาะแท็บนี้)
const PUBLIC_PAGES = ["/", "/login", "/signup", "/forgot-password", "/logout"];

export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
export const setToken = (token) => { try { if (token) localStorage.setItem(TOKEN_KEY, token); else localStorage.removeItem(TOKEN_KEY); } catch (err) { console.error("[auth] token store error:", err.message); } };
export const getUnlockToken = () => { try { return sessionStorage.getItem(UNLOCK_KEY); } catch { return null; } };
export const setUnlockToken = (token) => { try { if (token) sessionStorage.setItem(UNLOCK_KEY, token); else sessionStorage.removeItem(UNLOCK_KEY); } catch (err) { console.error("[auth] unlock store error:", err.message); } };

/** วันหมดอายุ (ms) ของ token — อ่านจาก payload เพื่อดูเฉยๆ (การตรวจจริงทำที่ server) */
export const tokenExpiresAt = (token) => {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(part.padEnd(Math.ceil(part.length / 4) * 4, "=")));
    return typeof payload.exp === "number" ? payload.exp * 1000 : 0;
  } catch { return 0; }
};

let apiOrigin = null;
const originOfApi = () => {
  if (apiOrigin) return apiOrigin;
  try { apiOrigin = new URL(API_URL || window.location.origin, window.location.href).origin; } catch { apiOrigin = window.location.origin; }
  return apiOrigin;
};
const isApiUrl = (url) => {
  try { return new URL(String(url), window.location.href).origin === originOfApi(); } catch { return false; }
};
const pathOf = (url) => { try { return new URL(String(url), window.location.href).pathname; } catch { return ""; } };

let redirecting = false;
const handleUnauthorized = (raw) => {
  let data = raw;
  if (typeof raw === "string") { try { data = JSON.parse(raw); } catch { data = null; } } // ที่ระดับ adapter body ยังเป็นข้อความดิบ
  const code = data && data.code;
  if (code !== "AUTH_REQUIRED" && code !== "TOKEN_EXPIRED") return;
  if (redirecting || PUBLIC_PAGES.includes(window.location.pathname)) return;
  redirecting = true;
  console.error("[auth] session ends:", code);
  clearUserLocalStorage();
  window.location.assign("/login");
};

const addHeaders = (headersLike, url, method) => {
  const token = getToken();
  if (token && !headersLike.has("Authorization")) headersLike.set("Authorization", `Bearer ${token}`);
  const unlock = getUnlockToken();
  if (unlock && String(method).toUpperCase() === "PUT" && pathOf(url).endsWith("/api/sheet/prefs") && !headersLike.has("X-Setting-Unlock")) {
    headersLike.set("X-Setting-Unlock", unlock);
  }
};

// ── axios: ที่ระดับ adapter เพื่อให้ครอบคลุม axios.create() ที่สร้างทีหลังด้วย ──
const baseAdapter = axios.getAdapter(axios.defaults.adapter);
axios.defaults.adapter = (config) => {
  const url = `${config.baseURL || ""}${config.url || ""}`;
  if (isApiUrl(url)) addHeaders(config.headers, url, config.method || "get");
  return baseAdapter(config).catch((err) => {
    if (err && err.response && err.response.status === 401) handleUnauthorized(err.response.data);
    throw err;
  });
};

// ── fetch ──
if (typeof window !== "undefined" && typeof window.fetch === "function" && !window.fetch.__pfcmAuth) {
  const nativeFetch = window.fetch.bind(window);
  const patched = (input, init) => {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    if (!isApiUrl(url)) return nativeFetch(input, init);
    const headers = new Headers((init && init.headers) || (typeof input !== "string" && input ? input.headers : undefined));
    addHeaders(headers, url, (init && init.method) || (typeof input !== "string" && input && input.method) || "GET");
    return nativeFetch(input, { ...(init || {}), headers }).then((res) => {
      if (res.status === 401) res.clone().json().then(handleUnauthorized).catch(() => {});
      return res;
    });
  };
  patched.__pfcmAuth = true;
  window.fetch = patched;
}

// ── ต่ออายุ token ──
const REFRESH_WHEN_LEFT_MS = 3 * 3600 * 1000;
const refreshIfNeeded = async () => {
  const token = getToken();
  if (!token) return;
  const left = tokenExpiresAt(token) - Date.now();
  if (left > REFRESH_WHEN_LEFT_MS) return;
  try {
    const res = await axios.post(`${API_URL}/api/auth/refresh`, {}, { headers: { Authorization: `Bearer ${token}` } });
    if (res.data && res.data.token) setToken(res.data.token);
  } catch (err) {
    console.error("[auth] refresh error:", err.response ? err.response.status : err.message);
  }
};
if (typeof window !== "undefined") {
  setTimeout(refreshIfNeeded, 5000);
  setInterval(refreshIfNeeded, 10 * 60 * 1000);
}
