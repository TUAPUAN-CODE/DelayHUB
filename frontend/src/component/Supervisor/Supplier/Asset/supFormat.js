// Display helpers of the supplier page (data: /api/supplier, read from WISEUP).
// Dates/numbers reuse the work-order helpers: SQL datetimes come as ISO "...Z" but are factory wall-clock times.
export { fmtDate, fmtDateTime, fmtNum } from "../../WorkOrder/Asset/woFormat";

const pad = (n) => String(n).padStart(2, "0");
const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** { from, to } of the last `days` days, as yyyy-MM-dd (the API accepts at most 366 days). */
export const lastDays = (days) => {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86400000);
  return { from: isoDay(from), to: isoDay(to) };
};

export const fmtInt = (v) => (v === null || v === undefined ? "-" : Number(v).toLocaleString());

/**
 * Quality decision (Usage Decision) of an inspection lot → tone of its badge.
 * AR comes from the SAP catalog: R = reject, A = accept; A03 / A04 are accepted with a condition / with a complaint.
 */
export const decisionTone = (code, ar) => {
  if (!code) return "pending";
  if (ar === "R") return "reject";
  if (code === "A03") return "condition";
  if (code === "A04") return "complaint";
  if (ar === "A") return "accept";
  return "other";
};

export const TONE_CLASS = {
  accept: "bg-emerald-50 text-emerald-700",
  condition: "bg-amber-50 text-amber-700",
  complaint: "bg-orange-50 text-orange-700",
  reject: "bg-red-50 text-red-700",
  pending: "bg-slate-100 text-slate-500",
  other: "bg-blue-50 text-blue-700",
};

/** Result of one inspection characteristic: catalog text when the value was picked from a list, else the measured value. */
export const resultTone = (ar) => (ar === "R" ? "reject" : ar === "A" ? "accept" : "other");
