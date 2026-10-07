import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";

axios.defaults.withCredentials = true;
const API_URL = import.meta.env.VITE_API_URL;
const SHEET_KEY = "master";

const readLocal = (userId) => {
  try { return JSON.parse(localStorage.getItem(`sheetPrefs:${userId}:${SHEET_KEY}`) || "null"); } catch { return null; }
};
const writeLocal = (userId, config) => {
  try { localStorage.setItem(`sheetPrefs:${userId}:${SHEET_KEY}`, JSON.stringify(config)); } catch { /* storage may be blocked */ }
};

/**
 * Column settings of one account. Saved in the database (table SheetUserPrefs, per user_id); a copy is kept in the browser so the
 * sheet still works — and remembers the choice on this device — while the table has not been created yet or the server is unreachable.
 * storage: 'loading' | 'server' | 'local'
 */
const useSheetPrefs = (defaultVisible) => {
  const userId = parseInt(localStorage.getItem("user_id"), 10);
  const [visible, setVisibleState] = useState(() => readLocal(userId)?.visible || defaultVisible);
  const [storage, setStorage] = useState("loading");
  const [warning, setWarning] = useState("");
  const saveTimer = useRef(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    if (Number.isNaN(userId)) {
      setStorage("local");
      setWarning("ไม่พบ user_id — เก็บการตั้งค่าไว้ในเครื่องนี้เท่านั้น");
      loadedRef.current = true;
      return undefined;
    }
    axios.get(`${API_URL}/api/sheet/prefs`, { params: { user_id: userId, sheet_key: SHEET_KEY } })
      .then((res) => {
        if (cancelled) return;
        const cfg = res.data?.config ? JSON.parse(res.data.config) : null;
        if (cfg?.visible?.length) { setVisibleState(cfg.visible); writeLocal(userId, cfg); }
        setStorage("server");
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[useSheetPrefs] load error:", err);
        setStorage("local");
        setWarning(err.response?.data?.code === "PREFS_TABLE_MISSING"
          ? "ยังไม่ได้สร้างตารางเก็บการตั้งค่าในฐานข้อมูล — เก็บไว้ในเครื่องนี้ชั่วคราว"
          : "โหลดการตั้งค่าจากเซิร์ฟเวอร์ไม่สำเร็จ — ใช้ค่าที่เก็บไว้ในเครื่องนี้");
      })
      .finally(() => { loadedRef.current = true; });
    return () => { cancelled = true; };
  }, [userId]);

  const persist = useCallback((next) => {
    const config = { visible: next };
    writeLocal(userId, config);
    if (Number.isNaN(userId)) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      axios.put(`${API_URL}/api/sheet/prefs`, { user_id: userId, sheet_key: SHEET_KEY, config: JSON.stringify(config) })
        .then(() => { setStorage("server"); setWarning(""); })
        .catch((err) => {
          console.error("[useSheetPrefs] save error:", err);
          setStorage("local");
          setWarning(err.response?.data?.code === "PREFS_TABLE_MISSING"
            ? "ยังไม่ได้สร้างตารางเก็บการตั้งค่าในฐานข้อมูล — เก็บไว้ในเครื่องนี้ชั่วคราว"
            : "บันทึกการตั้งค่าลงเซิร์ฟเวอร์ไม่สำเร็จ — เก็บไว้ในเครื่องนี้");
        });
    }, 600);
  }, [userId]);

  const setVisible = useCallback((next) => { setVisibleState(next); persist(next); }, [persist]);
  const reset = useCallback(() => { setVisible(defaultVisible); }, [defaultVisible, setVisible]);

  return { visible, setVisible, reset, storage, warning };
};

export default useSheetPrefs;
