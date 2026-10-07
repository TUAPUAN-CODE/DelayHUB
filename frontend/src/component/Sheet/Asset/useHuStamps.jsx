import { useCallback, useRef, useState } from "react";
import { Alert, Snackbar } from "@mui/material";
import ScanStampDialog from "../../ColdStorages/SapSheet/Asset/ScanStampDialog";
import PromptDialog from "../../ColdStorages/SapSheet/Asset/PromptDialog";
import okSound from "../../ColdStorages/SapSheet/Asset/ok.mp3";
import { formatTime, parseTag, planStamp, simplifyServerMessage } from "../../ColdStorages/SapSheet/Asset/sapTimeline";
import { postCheckin, postStamp, STAMP_LABEL } from "../../ColdStorages/SapSheet/Asset/sapApi";

const nowText = () => new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const playOk = () => { try { new Audio(okSound).play().catch(() => {}); } catch { /* sound is optional */ } };

/**
 * Time stamps of a HU (SAP_Receive): start thaw / thaw done / dispatch to line (scan or per-row button) and check-in to the cold room.
 * Same rules and friendly messages as the old Time Stamp page. `findHu(hu)` returns the loaded HU row (or undefined), `reload()` refreshes the sheet.
 */
const useHuStamps = ({ findHu, reload }) => {
  const [scanKind, setScanKind] = useState(null);
  const [log, setLog] = useState([]);
  const [prompt, setPrompt] = useState(null);
  const [toast, setToast] = useState("");
  const logId = useRef(0);

  const addLog = useCallback((entry) => {
    logId.current += 1;
    setLog((prev) => [{ id: logId.current, time: nowText(), ...entry }, ...prev].slice(0, 100));
  }, []);
  const askPrompt = useCallback((cfg) => new Promise((resolve) => setPrompt({ ...cfg, resolve })), []);

  const doStamp = useCallback(async (kind, tag) => {
    const row = findHu(tag.hu);
    const plan = planStamp(kind, row);
    if (row && !plan.ok) {
      addLog({ kind, hu: tag.hu, ok: false, text: plan.reason });
      return { ok: false, message: `HU ${tag.hu}: ${plan.reason}` };
    }
    let weight = tag.weight ?? (row?.weight ? Number(row.weight) : null);
    if ((kind === "start" || kind === "end") && !(weight > 0)) {
      const v = await askPrompt({ type: "weight", kind, tag });
      if (v === null) return { ok: false, message: "ยกเลิก — ต้องใส่น้ำหนักก่อนบันทึก" };
      weight = parseFloat(v);
    }
    const res = await postStamp(kind, { mat: tag.mat, batch: tag.batch, hu: tag.hu, weight });
    await reload();
    if (res.ok) {
      playOk();
      const text = `${res.message || "บันทึกสำเร็จ"} เมื่อ ${formatTime(new Date())}`;
      addLog({ kind, hu: tag.hu, ok: true, text });
      return { ok: true, message: `HU ${tag.hu}: ${text}` };
    }
    const fresh = findHu(tag.hu);
    const freshPlan = fresh ? planStamp(kind, fresh) : null;
    const text = freshPlan && !freshPlan.ok ? freshPlan.reason : simplifyServerMessage(res.message);
    addLog({ kind, hu: tag.hu, ok: false, text });
    return { ok: false, message: `HU ${tag.hu}: ${text}` };
  }, [addLog, askPrompt, findHu, reload]);

  const handleScan = useCallback(async (kind, text) => {
    const tag = parseTag(text);
    if (tag.error) { addLog({ kind, hu: "", ok: false, text: tag.error }); return { ok: false, message: tag.error }; }
    return doStamp(kind, tag);
  }, [addLog, doStamp]);

  const rowStamp = useCallback((kind, row) => {
    doStamp(kind, { mat: row.mat, batch: row.batch, hu: String(row.hu), weight: row.weight ? Number(row.weight) : null }).then((r) => setToast(r.message));
  }, [doStamp]);

  const rowCheckin = useCallback(async (row) => {
    const plan = planStamp("checkin", row);
    if (!plan.ok) { setToast(`HU ${row.hu}: ${plan.reason}`); return; }
    const supervisor = await askPrompt({ type: "supervisor", kind: "checkin", tag: { hu: String(row.hu) } });
    if (supervisor === null) return;
    const res = await postCheckin({ hu: row.hu, supervisor });
    await reload();
    if (res.ok) {
      playOk();
      const text = `รับเข้าห้องเย็นรอบที่ ${plan.round} เมื่อ ${formatTime(new Date())} (ผู้รับ: ${supervisor})`;
      addLog({ kind: "checkin", hu: String(row.hu), ok: true, text });
      setToast(`HU ${row.hu}: ${text}`);
    } else {
      const text = simplifyServerMessage(res.message);
      addLog({ kind: "checkin", hu: String(row.hu), ok: false, text });
      setToast(`HU ${row.hu}: ${text}`);
    }
  }, [addLog, askPrompt, reload]);

  const closePrompt = (value) => { prompt?.resolve(value); setPrompt(null); };

  const layer = (
    <>
      <ScanStampDialog open={!!scanKind} kind={scanKind} onClose={() => setScanKind(null)} onScan={handleScan} log={log} />
      <PromptDialog
        open={prompt?.type === "weight"} title="ใส่น้ำหนักวัตถุดิบ"
        description={`ป้ายนี้ไม่มีน้ำหนัก (HU ${prompt?.tag?.hu || ""}) กรุณาใส่น้ำหนักก่อนบันทึก${prompt ? ` ${STAMP_LABEL[prompt.kind]}` : ""}`}
        label="น้ำหนัก (กก.)" type="number" onCancel={() => closePrompt(null)} onConfirm={(v) => closePrompt(v)}
      />
      <PromptDialog
        open={prompt?.type === "supervisor"} title="รับเข้าห้องเย็น" description={`HU ${prompt?.tag?.hu || ""} — กรอกชื่อหัวหน้าผู้รับเข้า`}
        label="ชื่อหัวหน้าผู้รับเข้า" onCancel={() => closePrompt(null)} onConfirm={(v) => closePrompt(v)}
      />
      <Snackbar open={!!toast} autoHideDuration={6000} onClose={() => setToast("")} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="info" onClose={() => setToast("")} sx={{ width: "100%" }}>{toast}</Alert>
      </Snackbar>
    </>
  );

  return { openScan: setScanKind, rowStamp, rowCheckin, layer, log };
};

export default useHuStamps;
