import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, CircularProgress } from "@mui/material";

const API_URL = import.meta.env.VITE_API_URL;

const ModalUnboundEPC = ({ open, onClose }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [inputs, setInputs] = useState({});
  const [savingEpc, setSavingEpc] = useState("");
  const [message, setMessage] = useState("");

  const fetchUnknown = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await axios.get(`${API_URL}/api/coldstorage/rfid/unknown-epc`);
      setItems(res.data.data ?? []);
    } catch (err) {
      console.error("Fetch unknown EPC error:", err);
      setError(err.response?.data?.error || "ดึงข้อมูล EPC ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setMessage("");
      fetchUnknown();
    }
  }, [open, fetchUnknown]);

  const handleInputChange = (epc, value) => {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    setInputs((prev) => ({ ...prev, [epc]: digits }));
  };

  const handleBind = async (epc) => {
    const troId = inputs[epc] || "";
    if (!/^\d{4}$/.test(troId)) {
      setError("กรุณากรอก tro_id เป็นตัวเลข 4 หลัก");
      return;
    }
    try {
      setSavingEpc(epc);
      setError("");
      const res = await axios.post(`${API_URL}/api/coldstorage/rfid/bind-epc`, { epc, tro_id: troId });
      setMessage(res.data.message || "ผูกสำเร็จ");
      setInputs((prev) => {
        const next = { ...prev };
        delete next[epc];
        return next;
      });
      await fetchUnknown();
    } catch (err) {
      console.error("Bind EPC error:", err);
      setError(err.response?.data?.error || "ผูก EPC ไม่สำเร็จ");
    } finally {
      setSavingEpc("");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle style={{ fontFamily: "Prompt, sans-serif" }}>EPC ที่ยังไม่ผูก tro_id</DialogTitle>
      <DialogContent style={{ fontFamily: "Prompt, sans-serif" }}>
        {error && <p style={{ color: "#d32f2f" }}>{error}</p>}
        {message && <p style={{ color: "#2e7d32" }}>{message}</p>}
        {loading ? (
          <div style={{ textAlign: "center", padding: 24 }}><CircularProgress /></div>
        ) : items.length === 0 ? (
          <p>ไม่มี EPC ที่รอผูก</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
                <th>EPC</th>
                <th>Reader</th>
                <th>สแกน (ครั้ง)</th>
                <th>ล่าสุด</th>
                <th>tro_id (4 หลัก)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.epc} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ fontFamily: "monospace" }}>{row.epc}</td>
                  <td>{row.reader_no ?? "-"}</td>
                  <td>{row.scan_count}</td>
                  <td>{row.last_seen}</td>
                  <td>
                    <TextField
                      size="small"
                      value={inputs[row.epc] || ""}
                      onChange={(e) => handleInputChange(row.epc, e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleBind(row.epc); }}
                      inputProps={{ inputMode: "numeric", maxLength: 4 }}
                      placeholder="0000"
                      style={{ width: 100 }}
                    />
                  </td>
                  <td>
                    <Button
                      variant="contained"
                      size="small"
                      disabled={savingEpc === row.epc || (inputs[row.epc] || "").length !== 4}
                      onClick={() => handleBind(row.epc)}
                    >
                      ผูก
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={fetchUnknown} disabled={loading}>รีเฟรช</Button>
        <Button onClick={onClose}>ปิด</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ModalUnboundEPC;
