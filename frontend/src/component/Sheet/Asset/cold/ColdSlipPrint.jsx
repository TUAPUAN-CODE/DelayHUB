import { lazy, Suspense, useEffect, useState } from "react";
import axios from "axios";
import { Alert, Box, CircularProgress, Dialog, DialogContent } from "@mui/material";
import { indexByTrolley } from "../../../ColdStorage/CheckOutWithRFID/Asset/RFIDSlipPrintService";

axios.defaults.withCredentials = true;
const API_URL = import.meta.env.VITE_API_URL;

// the slip is the same component as the Check Out slip (PrintModal): lazy, it is only needed when a slip is printed
const PrintModal = lazy(() => import("../../../ColdStorage/RoomTableSupervisor/Asset/checkout/PrintModal"));

/**
 * "ปริ้นสลีป" of a trolley that is in a cold room (Master Sheet, status "อยู่ในห้องเย็น"): the same slip as Check Out with EVERY material of the trolley
 * (materials[]), but without the exit time (the trolley has not left the room). The data comes from the same endpoints as the check-out slip,
 * limited to the trolley with ?tro_id=.
 */
const ColdSlipPrint = ({ tro_id, onClose }) => {
  const [state, setState] = useState({ loading: false, data: null, error: "" });

  useEffect(() => {
    if (!tro_id) return undefined;
    let cancel = false;
    setState({ loading: true, data: null, error: "" });
    const get = (url) => axios.get(`${API_URL}${url}`, { params: { tro_id } });
    Promise.allSettled([get("/api/coldstorage/export/fetchSlotRawMat"), get("/api/coldstorages/export/fetchSlotRawMat"), get("/api/coldstorage/mix/export/fetchSlotRawMat")])
      .then(([reg, large, mix]) => {
        if (cancel) return;
        const rows = (r) => (r.status === "fulfilled" && r.value.data?.success ? r.value.data.data : []);
        const group = indexByTrolley([...rows(reg), ...rows(large)], rows(mix)).get(String(tro_id));
        if (!group) { setState({ loading: false, data: null, error: `ไม่พบข้อมูลวัตถุดิบในรถเข็น ${tro_id}` }); return; }
        const first = group.materials[0] || {};
        setState({ loading: false, data: { ...group, material_code: first.material_code, materialName: first.materialName, level_eu: group.level_eu ?? first.levelEu }, error: "" });
      });
    return () => { cancel = true; };
  }, [tro_id]);

  if (!tro_id) return null;
  if (state.data) {
    return (
      <Suspense fallback={null}>
        <PrintModal open data={state.data} onClose={onClose} hideExit />
      </Suspense>
    );
  }
  return (
    <Dialog open onClose={onClose}>
      <DialogContent sx={{ minWidth: 280, display: "flex", justifyContent: "center", py: 3 }}>
        {state.error ? <Alert severity="warning" onClose={onClose}>{state.error}</Alert> : <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}><CircularProgress size={22} />กำลังเตรียมสลีปรถเข็น {tro_id}</Box>}
      </DialogContent>
    </Dialog>
  );
};

export default ColdSlipPrint;
