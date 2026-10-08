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
 * Settings of one table for one account: visible columns, sorting, and free "ext" settings of the page (e.g. row colour rules).
 * Saved in the database (SheetUserPrefs, key = user_id + gridKey); a copy stays in the browser so the table keeps working when the
 * table is not created yet or the server is unreachable.   storage: 'loading' | 'server' | 'local'
 */
const useGridPrefs = (gridKey, defaults) => {
  const userId = parseInt(localStorage.getItem("user_id"), 10);
  const local = readLocal(userId, gridKey);
  const [config, setConfig] = useState(() => ({
    visible: local?.visible || defaults.visible,
    sorts: local?.sorts || defaults.sorts || [],
    ext: { ...(defaults.ext || {}), ...(local?.ext || {}) },
  }));
  const [storage, setStorage] = useState("loading");
  const [warning, setWarning] = useState("");
  const timer = useRef(null);
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

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
          setConfig((prev) => ({
            visible: cfg.visible?.length ? cfg.visible : prev.visible,
            sorts: cfg.sorts || prev.sorts,
            ext: { ...prev.ext, ...(cfg.ext || {}) },
          }));
          writeLocal(userId, gridKey, cfg);
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
          setWarning(err.response?.data?.code === "PREFS_TABLE_MISSING" ? MISSING : "บันทึกการตั้งค่าลงเซิร์ฟเวอร์ไม่สำเร็จ — เก็บไว้ในเครื่องนี้");
        });
    }, 600);
  }, [userId, gridKey]);

  const update = useCallback((patch) => {
    setConfig((prev) => { const next = { ...prev, ...patch }; persist(next); return next; });
  }, [persist]);

  const setVisible = useCallback((visible) => update({ visible }), [update]);
  const setSorts = useCallback((sorts) => update({ sorts }), [update]);
  const setExt = useCallback((patch) => setConfig((prev) => { const next = { ...prev, ext: { ...prev.ext, ...patch } }; persist(next); return next; }), [persist]);
  const reset = useCallback(() => {
    const d = defaultsRef.current;
    update({ visible: d.visible, ext: { ...(d.ext || {}) } });
  }, [update]);

  return { visible: config.visible, sorts: config.sorts, ext: config.ext, setVisible, setSorts, setExt, reset, storage, warning };
};

export default useGridPrefs;
