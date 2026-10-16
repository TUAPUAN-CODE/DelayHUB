import { useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, Radio, RadioGroup, TextField, Tooltip, Typography } from "@mui/material";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import { defaultAgentUrl, isAndroid, readSlipPrintConfig, saveSlipPrintConfig } from "../../services/slipPrint";

/** Small "เครื่องพิมพ์สลิป" button: how THIS device prints slips (browser print on Windows, or the Print Agent for Android). */
const SlipPrintSettings = () => {
  const [open, setOpen] = useState(false);
  const [cfg, setCfg] = useState(readSlipPrintConfig);
  const [testMsg, setTestMsg] = useState(null);

  const set = (k, v) => { setCfg((c) => ({ ...c, [k]: v })); setTestMsg(null); };
  const save = () => { saveSlipPrintConfig(cfg); setOpen(false); };
  const test = async () => {
    try {
      const res = await fetch(`${cfg.agentUrl.replace(/\/$/, "")}/health`);
      const data = await res.json();
      setTestMsg(data.ok ? { ok: true, text: "เชื่อมต่อ Print Agent ได้" } : { ok: false, text: "Print Agent ตอบกลับผิดปกติ" });
    } catch (err) {
      console.error("[SlipPrintSettings] test error:", err);
      setTestMsg({ ok: false, text: `เชื่อมต่อ ${cfg.agentUrl} ไม่ได้` });
    }
  };

  return (
    <>
      <Tooltip title="ตั้งค่าเครื่องพิมพ์สลิปของเครื่องนี้" arrow>
        <IconButton className="no-print" size="small" onClick={() => { setCfg(readSlipPrintConfig()); setOpen(true); }}><PrintOutlinedIcon fontSize="small" /></IconButton>
      </Tooltip>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth className="no-print">
        <DialogTitle>เครื่องพิมพ์สลิป (เครื่องนี้)</DialogTitle>
        <DialogContent>
          <Typography variant="caption" color="text.secondary">อุปกรณ์นี้: {isAndroid() ? "Android" : "Windows / อื่นๆ"} · ตั้งค่าเก็บไว้ที่เครื่องนี้เท่านั้น</Typography>
          <RadioGroup value={cfg.mode} onChange={(e) => set("mode", e.target.value)} sx={{ mt: 1 }}>
            <FormControlLabel value="browser" control={<Radio />} label="พิมพ์จากเครื่องนี้ (Windows ที่ต่อเครื่องพิมพ์สลิปไว้)" />
            <FormControlLabel value="agent" control={<Radio />} label="ส่งไปพิมพ์ผ่าน Print Agent (Android / แท็บเล็ต / มือถือ)" />
          </RadioGroup>
          {cfg.mode === "agent" && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, mt: 1 }}>
              <TextField size="small" label="Print Agent URL" value={cfg.agentUrl} onChange={(e) => set("agentUrl", e.target.value)} helperText={`ค่าเริ่มต้น ${defaultAgentUrl()}`} />
              <TextField size="small" label="IP / ชื่อเครื่องที่แชร์เครื่องพิมพ์ (ว่าง = เครื่องพิมพ์หลักของเครื่อง Print Agent)" value={cfg.printerHost} onChange={(e) => set("printerHost", e.target.value.trim())} />
              <TextField size="small" label="ชื่อ share ของเครื่องพิมพ์" value={cfg.printerShare} onChange={(e) => set("printerShare", e.target.value.trim())} disabled={!cfg.printerHost} />
              <Button size="small" variant="outlined" onClick={test}>ทดสอบการเชื่อมต่อ</Button>
              {testMsg && <Alert severity={testMsg.ok ? "success" : "error"}>{testMsg.text}</Alert>}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>ยกเลิก</Button>
          <Button variant="contained" color="secondary" onClick={save}>บันทึก</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SlipPrintSettings;
