import { useEffect, useState } from "react";
import axios from "axios";
import { Loader2 } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL;

// On / off: must the packing staff type a WONo + Basket when they confirm packing (window "ยืนยันข้อมูล" of the Sheet page)?
// Saved on the server (GET / PUT /api/ingredient/wo-required); only Supervisor / Master can change it (the server answers 403 to others).
// Turning it ON asks to confirm first, because it can stop the packing floor from confirming a lot that has no WO.
const WoRequiredSwitch = () => {
  const [state, setState] = useState(null); // { required, updated_by, updated_at }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const load = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/ingredient/wo-required`, { signal: ctrl.signal });
        setState(res.data.data);
      } catch (err) {
        if (axios.isCancel(err)) return;
        console.error("wo-required load error:", err);
        setMessage({ ok: false, text: err.response?.data?.error || "โหลดการตั้งค่าไม่สำเร็จ" });
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    };
    load();
    return () => ctrl.abort();
  }, []);

  const save = async (required) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await axios.put(`${API_URL}/api/ingredient/wo-required`, { required });
      setState(res.data.data);
      setConfirming(false);
      setMessage({ ok: true, text: required ? "เปิดการบังคับแล้ว" : "ปิดการบังคับแล้ว" });
    } catch (err) {
      console.error("wo-required save error:", err);
      setConfirming(false);
      setMessage({ ok: false, text: err.response?.status === 403 ? "เฉพาะ Supervisor / Master เปลี่ยนได้" : err.response?.data?.error || "บันทึกไม่สำเร็จ" });
    } finally {
      setSaving(false);
    }
  };

  const toggle = () => {
    if (!state || saving) return;
    setMessage(null);
    if (state.required) save(false);
    else setConfirming(true);
  };

  const on = state?.required === true;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={!state || saving}
        onClick={toggle}
        className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${on ? "bg-blue-600" : "bg-slate-300"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
      </button>
      <div className="min-w-0">
        <div className="font-medium text-slate-800">บังคับกรอก WONo</div>
        <div className="text-xs text-slate-500">
          {loading ? "กำลังโหลด..." : on ? "เปิดอยู่ — ยืนยันบรรจุไม่ได้ถ้าไม่กรอก WONo + Basket" : "ปิดอยู่ — กรอกหรือไม่กรอกก็ได้"}
          {state?.updated_at ? ` · เปลี่ยนล่าสุด ${state.updated_at.slice(0, 16)}` : ""}
          {state?.updated_at && state.updated_by ? ` · ${state.updated_by}` : ""}
        </div>
      </div>
      {(loading || saving) && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
      {confirming && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
          <span>พนักงานจะกดยืนยันบรรจุไม่ได้ ถ้าไม่กรอก WONo — ยืนยันเปิดการบังคับ?</span>
          <button type="button" onClick={() => save(true)} disabled={saving} className="rounded-md bg-blue-600 px-3 py-1 font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            ยืนยัน
          </button>
          <button type="button" onClick={() => setConfirming(false)} disabled={saving} className="rounded-md border border-slate-300 bg-white px-3 py-1 text-slate-700 hover:bg-slate-50">
            ยกเลิก
          </button>
        </div>
      )}
      {message && <span className={`text-xs ${message.ok ? "text-green-700" : "text-red-600"}`}>{message.text}</span>}
    </div>
  );
};

export default WoRequiredSwitch;
