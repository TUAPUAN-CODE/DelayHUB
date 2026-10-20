// Shift of a finished row, by the time packing was done (sc_pack_date):
//   DS = 06:00 – 17:30 · NS = 17:30 – 06:00 (the night runs into the next day: 00:00 – 05:59 is still the NS of the day before)
const DS_FROM = 6 * 60;        // 06:00
const DS_TO = 17 * 60 + 30;    // 17:30

const toDate = (v) => {
  if (v === null || v === undefined || v === "" || v === "-") return null;
  const d = new Date(String(v).replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
};

/** "DS" | "NS" | null (not packed yet) */
export const shiftOf = (v) => {
  const d = toDate(v);
  if (!d) return null;
  const m = d.getHours() * 60 + d.getMinutes();
  return m >= DS_FROM && m < DS_TO ? "DS" : "NS";
};

const LOOK = {
  DS: { color: "#92400E", bg: "#FEF3C7", title: "DS 06:00–17:30" },
  NS: { color: "#3730A3", bg: "#E0E7FF", title: "NS 17:30–06:00" },
};

/** column "กะ" of the Done table: sort = DS first (or NS first), then by the time packing was done · the dropdown filters DS / NS */
export const SHIFT_COLUMN = {
  key: "shift", label: "กะ (บรรจุเสร็จ)", group: "pack", kind: "data", type: "text", width: 110,
  text: (r) => shiftOf(r.sc_pack_date) || "",
  sortValue: (r) => {
    const d = toDate(r.sc_pack_date);
    if (!d) return null;
    return (shiftOf(r.sc_pack_date) === "DS" ? 0 : 1) * 1e13 + d.getTime();
  },
  sortLabels: ["DS → NS", "NS → DS"],
  render: (r) => {
    const s = shiftOf(r.sc_pack_date);
    if (!s) return <span style={{ color: "#B0BAC9" }}>-</span>;
    const l = LOOK[s];
    return <span title={l.title} style={{ background: l.bg, color: l.color, border: `1px solid ${l.color}40`, borderRadius: 6, padding: "2px 8px", fontSize: 11.5, fontWeight: 700 }}>{s}</span>;
  },
};
