import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, CircularProgress, Tabs, Tab } from "@mui/material";

const API_URL = import.meta.env.VITE_API_URL;

const getUserId = () => {
  try {
    return localStorage.getItem("user_id") || "";
  } catch {
    return "";
  }
};

const ModalUnboundEPC = ({ open, onClose }) => {
  const [tab, setTab] = useState("unbound"); // 'unbound' = รอผูก, 'bound' = ผูกแล้ว (แก้ไข/ยกเลิก)
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [inputs, setInputs] = useState({});
  const [savingEpc, setSavingEpc] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const url = tab === "unbound"
        ? `${API_URL}/api/coldstorage/rfid/unknown-epc`
        : `${API_URL}/api/coldstorage/rfid/bound-epc`;
      const res = await axios.get(url, { params: tab === "bound" ? { q: search } : undefined });
      setItems(res.data.data ?? []);
    } catch (err) {
      console.error("Fetch EPC list error:", err);
      setError(err.response?.data?.error || "ดึงข้อมูล EPC ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [tab, search]);

  useEffect(() => {
    if (open) {
      setMessage("");
      fetchItems();
    }
  }, [open, tab, fetchItems]);

  const handleTabChange = (e, value) => {
    setTab(value);
    setItems([]);
    setInputs({});
    setError("");
    setMessage("");
  };

  const handleInputChange = (epc, value) => {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    setInputs((prev) => ({ ...prev, [epc]: digits }));
  };

  const callApi = async (epc, request, failText) => {
    const userId = getUserId();
    if (!userId) {
      setError("ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่");
      return;
    }
    try {
      setSavingEpc(epc);
      setError("");
      const res = await request(userId);
      setMessage(res.data.message || "สำเร็จ");
      setInputs((prev) => {
        const next = { ...prev };
        delete next[epc];
        return next;
      });
      await fetchItems();
    } catch (err) {
      console.error(failText, err);
      setError(err.response?.data?.error || failText);
    } finally {
      setSavingEpc("");
    }
  };

  const handleSubmit = async (epc) => {
    const troId = inputs[epc] || "";
    if (!/^\d{4}$/.test(troId)) {
      setError("กรุณากรอก tro_id เป็นตัวเลข 4 หลัก");
      return;
    }
    if (tab === "unbound") {
      await callApi(epc, (userId) => axios.post(`${API_URL}/api/coldstorage/rfid/bind-epc`, { epc, tro_id: troId, user_id: userId }), "ผูก EPC ไม่สำเร็จ");
    } else {
      if (!window.confirm(`เปลี่ยน EPC ${epc} เป็นรถเข็น ${troId} ใช่หรือไม่?`)) return;
      await callApi(epc, (userId) => axios.put(`${API_URL}/api/coldstorage/rfid/rebind-epc`, { epc, tro_id: troId, user_id: userId }), "เปลี่ยน tro_id ไม่สำเร็จ");
    }
  };

  const handleUnbind = async (row) => {
    if (!window.confirm(`ยกเลิกการผูก EPC ${row.epc} กับรถเข็น ${row.tro_id} ใช่หรือไม่?`)) return;
    await callApi(
      row.epc,
      (userId) => axios.delete(`${API_URL}/api/coldstorage/rfid/delete-epc`, { data: { epc: row.epc, user_id: userId } }),
      "ยกเลิกการผูกไม่สำเร็จ"
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle style={{ fontFamily: "Prompt, sans-serif" }}>จัดการการผูก EPC กับ tro_id</DialogTitle>
      <DialogContent style={{ fontFamily: "Prompt, sans-serif" }}>
        <Tabs value={tab} onChange={handleTabChange} style={{ marginBottom: 8 }}>
          <Tab value="unbound" label="รอผูก tro_id" />
          <Tab value="bound" label="ผูกแล้ว (แก้ไข/ยกเลิก)" />
        </Tabs>
        {tab === "bound" && (
          <TextField
            size="small"
            label="ค้นหา EPC หรือ tro_id"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: 8, width: 260 }}
          />
        )}
        {error && <p style={{ color: "#d32f2f" }}>{error}</p>}
        {message && <p style={{ color: "#2e7d32" }}>{message}</p>}
        {loading ? (
          <div style={{ textAlign: "center", padding: 24 }}><CircularProgress /></div>
        ) : items.length === 0 ? (
          <p>{tab === "unbound" ? "ไม่มี EPC ที่รอผูก" : "ไม่พบรายการ"}</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
                <th>EPC</th>
                {tab === "unbound" ? (
                  <>
                    <th>Reader</th>
                    <th>สแกน (ครั้ง)</th>
                    <th>ล่าสุด</th>
                  </>
                ) : (
                  <th>tro_id ปัจจุบัน</th>
                )}
                <th>{tab === "unbound" ? "tro_id (4 หลัก)" : "เปลี่ยนเป็น (4 หลัก)"}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.epc} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ fontFamily: "monospace" }}>{row.epc}</td>
                  {tab === "unbound" ? (
                    <>
                      <td>{row.reader_no ?? "-"}</td>
                      <td>{row.scan_count}</td>
                      <td>{row.last_seen}</td>
                    </>
                  ) : (
                    <td>{row.tro_id}</td>
                  )}
                  <td>
                    <TextField
                      size="small"
                      value={inputs[row.epc] || ""}
                      onChange={(e) => handleInputChange(row.epc, e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(row.epc); }}
                      inputProps={{ inputMode: "numeric", maxLength: 4 }}
                      placeholder="0000"
                      style={{ width: 100 }}
                    />
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <Button
                      variant="contained"
                      size="small"
                      disabled={savingEpc === row.epc || (inputs[row.epc] || "").length !== 4}
                      onClick={() => handleSubmit(row.epc)}
                    >
                      {tab === "unbound" ? "ผูก" : "เปลี่ยน"}
                    </Button>
                    {tab === "bound" && (
                      <Button
                        size="small"
                        color="error"
                        disabled={savingEpc === row.epc}
                        onClick={() => handleUnbind(row)}
                        style={{ marginLeft: 8 }}
                      >
                        ยกเลิกการผูก
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={fetchItems} disabled={loading}>รีเฟรช</Button>
        <Button onClick={onClose}>ปิด</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ModalUnboundEPC;
