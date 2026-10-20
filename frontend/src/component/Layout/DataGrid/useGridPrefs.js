import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";

axios.defaults.withCredentials = true;
const API_URL = import.meta.env.VITE_API_URL;

const readLocal = (userId, key) => {
  try { return JSON.parse(localStorage.getItem(`gridPrefs:${userId}:${key}`) || "null"); } catch { return null; }
};
const writeLocal = (userId, key, config) => {
  try { localStorage.setItem(`gridPrefs:${userId}:${key}`, JSON.stringify(config)); } catch { /* storage may be blocked */ }
};

const MISSING = "ยังไม่ได้สร้างตารางเก็บการตั้งค่าในฐานข้อมูล — เก็บไว้ในเครื่องนี้ชั่วคราว";

/**
 * Columns a page wants every account to see, also accounts that saved their columns before the column existed / was asked for:
 * ensure = [{ key, after? }] — each key is added ONCE per account (after the column `after`, else at the end) and remembered in ext.__ensured,
 * so an account can still hide it afterwards. Returns the same object when nothing is added.
 */
const applyEnsure = (cfg, ensure) => {
  if (!ensure?.length) return cfg;
  const done = new Set(cfg.ext?.__ensured || []);
  const todo = ensure.filter((e) => !done.has(e.key));
  if (!todo.length) return cfg;
  const visible = [...(cfg.visible || [])];
  todo.forEach(({ key, after }) => {
    if (visible.includes(key)) return;
    const i = after ? visible.indexOf(after) : -1;
    visible.splice(i >= 0 ? i + 1 : visible.length, 0, key);
  });
  return { ...cfg, visible, ext: { ...(cfg.ext || {}), __ensured: [...done, ...todo.map((e) => e.key)] } };
};

/**
 * Settings of one table for one account: visible columns, sorting, and free "ext" settings of the page (e.g. row colour rules).
 * Saved in the database (SheetUserPrefs, key = user_id + gridKey); a copy stays in the browser so the table keeps working when the
 * table is not created yet or the server is unreachable.   storage: 'loading' | 'server' | 'local'
 */
const useGridPrefs = (gridKey, defaults) => {
  const userId = parseInt(localStorage.getItem("user_id"), 10);
  const local = readLocal(userId, gridKey);
  const [config, setConfig] = useState(() => applyEnsure({
    visible: local?.visible || defaults.visible,
    sorts: local?.sorts || defaults.sorts || [],
    ext: { ...(defaults.ext || {}), ...(local?.ext || {}) },
    pins: local?.pins ?? null, // columns frozen on the left; null = the default of the table
  }, defaults.ensure));
  const [storage, setStorage] = useState("loading");
  const [warning, setWarning] = useState("");
  const timer = useRef(null);
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    let cancelled = false;
    if (Number.isNaN(userId)) {
      setStorage("local");
      setWarning("ไม่พบ user_id — เก็บการตั้งค่าไว้ในเครื่องนี้เท่านั้น");
      return undefined;
    }
    axios.get(`${API_URL}/api/sheet/prefs`, { params: { user_id: userId, sheet_key: gridKey } })
      .then((res) => {
        if (cancelled) return;
        const cfg = res.data?.config ? JSON.parse(res.data.config) : null;
        if (cfg) {
          const prev = configRef.current;
          const merged = {
            visible: cfg.visible?.length ? cfg.visible : prev.visible,
            sorts: cfg.sorts || prev.sorts,
            ext: { ...prev.ext, ...(cfg.ext || {}) },
            pins: cfg.pins ?? prev.pins,
          };
          const next = applyEnsure(merged, defaultsRef.current.ensure);
          setConfig(next);
          writeLocal(userId, gridKey, next);
          if (next !== merged) persistRef.current(next); // a column was added for this account: save it once
        }
        setStorage("server");
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[useGridPrefs] load error:", err);
        setStorage("local");
        setWarning(err.response?.data?.code === "PREFS_TABLE_MISSING" ? MISSING : "โหลดการตั้งค่าจากเซิร์ฟเวอร์ไม่สำเร็จ — ใช้ค่าที่เก็บไว้ในเครื่องนี้");
      });
    return () => { cancelled = true; };
  }, [userId, gridKey]);

  const persist = useCallback((next) => {
    writeLocal(userId, gridKey, next);
    if (Number.isNaN(userId)) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      axios.put(`${API_URL}/api/sheet/prefs`, { user_id: userId, sheet_key: gridKey, config: JSON.stringify(next) })
        .then(() => { setStorage("server"); setWarning(""); })
        .catch((err) => {
          console.error("[useGridPrefs] save error:", err);
          setStorage("local");
          const code = err.response?.data?.code;
          setWarning(code === "PREFS_TABLE_MISSING" ? MISSING : code === "SETTING_LOCKED" ? "ต้องปลดล็อกหน้า Setting ด้วยรหัสก่อน จึงจะบันทึกการตั้งค่านี้ลงเซิร์ฟเวอร์ได้ — เก็บไว้ในเครื่องนี้ชั่วคราว" : "บันทึกการตั้งค่าลงเซิร์ฟเวอร์ไม่สำเร็จ — เก็บไว้ในเครื่องนี้");
        });
    }, 600);
  }, [userId, gridKey]);

  const persistRef = useRef(persist);
  persistRef.current = persist;

  const update = useCallback((patch) => {
    setConfig((prev) => { const next = { ...prev, ...patch }; persist(next); return next; });
  }, [persist]);

  const setVisible = useCallback((visible) => update({ visible }), [update]);
  const setSorts = useCallback((sorts) => update({ sorts }), [update]);
  const setExt = useCallback((patch) => setConfig((prev) => { const next = { ...prev, ext: { ...prev.ext, ...patch } }; persist(next); return next; }), [persist]);
  const setPins = useCallback((pins) => update({ pins }), [update]);
  const reset = useCallback(() => {
    const d = defaultsRef.current;
    update({ visible: d.visible, ext: { ...(d.ext || {}) }, pins: null });
  }, [update]);

  return { visible: config.visible, sorts: config.sorts, ext: config.ext, pins: config.pins, setVisible, setSorts, setExt, setPins, reset, storage, warning };
};

export default useGridPrefs;
