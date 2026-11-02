import { useEffect, useState } from "react";
import axios from "axios";
import { Typography } from "@mui/material";
import { flowPackNotes } from "../Sheet/Asset/flowStages";

const API_URL = import.meta.env.VITE_API_URL;

// "F<rmfp_id>" = the number of a Tuna scrap / CK bone item (it exists before the item has a mapping_id); printed on every slip under the mapping_id.
// One request for all the ids asked within a moment (a slip with many materials); the answer is kept, so printing again does not ask again.
const cache = new Map(); // mapping_id -> { no: "F123", rmit_date, sc_pack_date, cold_to_pack } | null
const waiting = new Map(); // mapping_id -> [resolve]
let timer = null;

const flush = async () => {
  timer = null;
  const ids = [...waiting.keys()];
  const batch = new Map(waiting);
  waiting.clear();
  let map = {};
  let ok = false;
  try {
    const res = await axios.get(`${API_URL}/api/sheet/flow-ids`, { params: { mapping_ids: ids.join(",") } });
    map = res.data?.data || {};
    ok = true;
  } catch (err) {
    console.error("[FlowNo] load error:", err);
  }
  ids.forEach((id) => {
    const info = map[id] || null;
    if (ok) cache.set(id, info); // a failed request is not remembered (printing again asks again)
    (batch.get(id) || []).forEach((resolve) => resolve(info));
  });
};

const lookup = (id) => {
  if (cache.has(id)) return Promise.resolve(cache.get(id));
  return new Promise((resolve) => {
    waiting.set(id, [...(waiting.get(id) || []), resolve]);
    if (!timer) timer = setTimeout(flush, 30);
  });
};

/** { no: "F123", notes: [{ label, value }] } of a mapping_id that belongs to a Tuna scrap / CK bone item, else null */
export const useFlowNo = (mappingId) => {
  const id = mappingId === null || mappingId === undefined || mappingId === "" || Number.isNaN(Number(mappingId)) ? null : String(Number(mappingId));
  const [info, setInfo] = useState(() => (id && cache.has(id) ? cache.get(id) : null));
  useEffect(() => {
    let alive = true;
    if (!id) { setInfo(null); return undefined; }
    lookup(id).then((v) => { if (alive) setInfo(v); });
    return () => { alive = false; };
  }, [id]);
  return info ? { no: info.no, notes: flowPackNotes(info) } : null;
};

const lineSx = { color: "#464646", fontSize: "22px", margin: "10px", "@media print": { fontSize: "10px", margin: "2px 0" } };

/** the lines under "รายการ : …" of the slips that use big Typography lines (same look as the line above it): the number + the deadline */
export const FlowNoLine = ({ mappingId }) => {
  const info = useFlowNo(mappingId);
  if (!info) return null;
  return (
    <>
      <Typography variant="h6" className="print-text" sx={lineSx}>เลขรายการ Paste : {info.no}</Typography>
      {info.notes.map((n) => <Typography key={n.value} variant="h6" className="print-text" sx={lineSx}>{n.label} : {n.value}</Typography>)}
    </>
  );
};

/** for the slips that list materials with small label / value items: children(no, notes) is called only when the material has a flow number */
export const FlowNoValue = ({ mappingId, children }) => {
  const info = useFlowNo(mappingId);
  return info ? children(info.no, info.notes) : null;
};
