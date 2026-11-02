import { useEffect, useState } from "react";
import axios from "axios";
import { Typography } from "@mui/material";

const API_URL = import.meta.env.VITE_API_URL;

// "F<rmfp_id>" = the number of a Tuna scrap / CK bone item (it exists before the item has a mapping_id); printed on every slip under the mapping_id.
// One request for all the ids asked within a moment (a slip with many materials); the answer is kept, so printing again does not ask again.
const cache = new Map(); // mapping_id -> "F123" | ""
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
    const no = map[id] || "";
    if (ok) cache.set(id, no); // a failed request is not remembered (printing again asks again)
    (batch.get(id) || []).forEach((resolve) => resolve(no));
  });
};

const lookup = (id) => {
  if (cache.has(id)) return Promise.resolve(cache.get(id));
  return new Promise((resolve) => {
    waiting.set(id, [...(waiting.get(id) || []), resolve]);
    if (!timer) timer = setTimeout(flush, 30);
  });
};

/** "F123" of a mapping_id when it belongs to a Tuna scrap / CK bone item, else "" */
export const useFlowNo = (mappingId) => {
  const id = mappingId === null || mappingId === undefined || mappingId === "" || Number.isNaN(Number(mappingId)) ? null : String(Number(mappingId));
  const [no, setNo] = useState(() => (id && cache.has(id) ? cache.get(id) : ""));
  useEffect(() => {
    let alive = true;
    if (!id) { setNo(""); return undefined; }
    lookup(id).then((v) => { if (alive) setNo(v); });
    return () => { alive = false; };
  }, [id]);
  return no;
};

/** the line under "รายการ : …" of the slips that use big Typography lines (same look as the line above it) */
export const FlowNoLine = ({ mappingId }) => {
  const no = useFlowNo(mappingId);
  if (!no) return null;
  return (
    <Typography variant="h6" className="print-text" sx={{ color: "#464646", fontSize: "22px", margin: "10px", "@media print": { fontSize: "10px", margin: "2px 0" } }}>
      เลขรายการ Flow : {no}
    </Typography>
  );
};

/** for the slips that list materials with small label / value items: children(no) is called only when the material has a flow number */
export const FlowNoValue = ({ mappingId, children }) => {
  const no = useFlowNo(mappingId);
  return no ? children(no) : null;
};
