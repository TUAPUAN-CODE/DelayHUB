// Shift / factory day of a finished row by the time packing was done (pure functions, no React: also used by the tests)
//   DS = 06:00 – 17:30 · NS = 17:30 – 06:00 (the night runs into the next day: 00:00 – 05:59 is still the NS of the day before)
const DS_FROM = 6 * 60;        // 06:00
const DS_TO = 17 * 60 + 30;    // 17:30

export const toDate = (v) => {
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

const p2 = (n) => String(n).padStart(2, "0");
/** factory day (yyyy-MM-dd) of a time: the night shift after midnight (00:00 – 05:59) still belongs to the day before; "" when there is no time */
export const workDayOf = (v) => {
  const d = toDate(v);
  if (!d) return "";
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (d.getHours() * 60 + d.getMinutes() < DS_FROM ? 1 : 0));
  return `${x.getFullYear()}-${p2(x.getMonth() + 1)}-${p2(x.getDate())}`;
};

