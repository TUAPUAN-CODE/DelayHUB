import { useEffect, useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

/*
 * Remark CS on every slip: one note per HU, typed when the preparation receives the HU from the big cold room (/prep/Sheet,
 * POST /api/prep/checkin/sap). A slip line finds it from what the slip knows about its material, in this order:
 *   mapping_id (its HU)  ·  hu  ·  mat + batch (the SAP receive of that batch)
 * Shown as "Remark CS: …", or "Remark CS: -" when there is none.
 *
 * The lines of a slip ask together (one GET /api/prep/remark-cs for everything asked in the same moment) and the answers are kept
 * for a minute, so a slip that renders again does not ask again.
 */
const TTL_MS = 60 * 1000;
const cache = new Map(); // key -> { text, at }
let pending = null;      // { keys: Set, promise }: asked in this moment, not sent yet
const inflight = new Map(); // key -> promise of the request that is loading it

const norm = (v) => (v === undefined || v === null ? "" : String(v).trim());
// mapping_id and the HU of SAP_Receive are INT: anything else (e.g. the HU of a packaging slip) is not one of them
const intId = (v) => { const n = Number(norm(v)); return norm(v) !== "" && Number.isInteger(n) && n > 0 && n <= 2147483647 ? n : null; };
const keysOf = ({ mappingId, hu, mat, batch }) => {
  const out = [];
  const m = intId(mappingId);
  if (m) out.push(`m:${m}`);
  const h = intId(hu);
  if (h) out.push(`h:${h}`);
  // a batch may be "B1, B2": every batch is a key
  if (norm(mat)) norm(batch).split(",").map((b) => b.trim()).filter(Boolean).forEach((b) => out.push(`b:${norm(mat)}|${b}`));
  return out;
};
const fresh = (k) => { const c = cache.get(k); return c && Date.now() - c.at < TTL_MS; };

const MAX_KEYS = 100; // the API reads at most 100 keys of each kind per request

const fetchKeys = async (all) => {
  for (let i = 0; i < all.length; i += MAX_KEYS) await fetchChunk(all.slice(i, i + MAX_KEYS)); // eslint-disable-line no-await-in-loop
};

const fetchChunk = async (keys) => {
  const mapping = keys.filter((k) => k.startsWith("m:")).map((k) => k.slice(2));
  const hus = keys.filter((k) => k.startsWith("h:")).map((k) => k.slice(2));
  const pairs = keys.filter((k) => k.startsWith("b:")).map((k) => k.slice(2));
  try {
    const res = await axios.get(`${API_URL}/api/prep/remark-cs`, { params: { mapping_ids: mapping.join(","), hus: hus.join(","), keys: pairs.join(",") } });
    const d = res.data?.data || {};
    const at = Date.now();
    mapping.forEach((id) => cache.set(`m:${id}`, { text: d.mapping?.[id] || "", at }));
    hus.forEach((h) => cache.set(`h:${h}`, { text: d.hu?.[h] || "", at }));
    pairs.forEach((p) => cache.set(`b:${p}`, { text: d.matBatch?.[p] || "", at }));
  } catch (err) {
    console.error("[RemarkCs] load error:", err);
  }
};

/** makes sure the remarks of these sources are loaded (slips that print without a click can wait for it) */
export const loadRemarkCs = (sources) => {
  const want = (sources || []).flatMap(keysOf).filter((k) => !fresh(k));
  const waits = [...new Set(want.filter((k) => inflight.has(k)).map((k) => inflight.get(k)))]; // already being loaded: wait for that request
  const ask = want.filter((k) => !inflight.has(k));
  if (ask.length) {
    if (!pending) {
      const keys = new Set();
      // the lines rendered in the same moment go in one request
      const promise = new Promise((resolve) => setTimeout(resolve, 0))
        .then(() => { pending = null; return fetchKeys([...keys]); })
        .finally(() => keys.forEach((k) => { if (inflight.get(k) === promise) inflight.delete(k); }));
      pending = { keys, promise };
    }
    ask.forEach((k) => { pending.keys.add(k); inflight.set(k, pending.promise); });
    waits.push(pending.promise);
  }
  return Promise.all(waits).then(() => undefined);
};

/** the text for these sources from what is loaded ("" when none) */
export const remarkCsText = (sources) => {
  const texts = [];
  (sources || []).forEach((s) => {
    const hit = keysOf(s).map((k) => cache.get(k)?.text).find(Boolean);
    if (hit && !texts.includes(hit)) texts.push(hit);
  });
  return texts.join(" / ");
};

/** the Remark CS text of these sources ("" while loading / when none) — for a slip that shows it in its own row */
export const useRemarkCs = (sources) => {
  const list = sources || [];
  const sig = JSON.stringify(list.map(keysOf));
  const [text, setText] = useState(() => remarkCsText(list));
  useEffect(() => {
    let alive = true;
    loadRemarkCs(list).then(() => { if (alive) setText(remarkCsText(list)); });
    return () => { alive = false; };
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  return text;
};

/**
 * One line "Remark CS: …" for a slip.
 *   sources = [{ mappingId, hu, mat, batch }] (a material made of several: all of them) — or the same fields as props for one source
 */
export const RemarkCsLine = ({ sources, mappingId, hu, mat, batch, label = "Remark CS", style, className }) => {
  const text = useRemarkCs(sources || [{ mappingId, hu, mat, batch }]);
  return (
    <div className={className ? `remark-cs-line ${className}` : "remark-cs-line"} style={{ margin: "2px 0", overflowWrap: "break-word", ...style }}>
      <b>{label}:</b> {text || "-"}
    </div>
  );
};

export default RemarkCsLine;
