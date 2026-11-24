// Date labels shared by the daily charts of the stock summary page (days come as "yyyy-MM-dd").
const toDate = (day) => new Date(`${day}T00:00:00`);

export const tickLabel = (days) => (day) => {
  const d = toDate(day);
  return days <= 7
    ? d.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "numeric" })
    : d.toLocaleDateString("th-TH", { day: "numeric", month: "numeric" });
};
export const fullLabel = (day) => toDate(day).toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long" });
export const shortDay = (day) => toDate(day).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
export const signedNum = (n) => (n > 0 ? `+${n}` : String(n));

export const RANGES = [
  { value: 7, label: "7 วัน" },
  { value: 14, label: "14 วัน" },
  { value: 30, label: "30 วัน" },
];
