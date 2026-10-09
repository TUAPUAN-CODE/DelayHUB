// Status names grouped into zones (agreed with the users): the order here is the order of the status dropdown / sort,
// and every zone has its own colour. Status names that are not listed come after the zones, in the order of OTHER.

export const STATUS_ZONES = [
  {
    id: "bigcold", title: "กิจกรรมพื้นที่ห้องเย็นใหญ่", color: "#FFFFFF", bg: "#1D4ED8", dot: "#1D4ED8",
    labels: ["กำลังละลาย", "ละลายเสร็จแล้ว", "จ่ายลงไลน์แล้ว"],
  },
  {
    id: "cold", title: "กิจกรรมพื้นที่ห้องเย็น", color: "#075985", bg: "#BAE6FD", dot: "#38BDF8",
    labels: ["อยู่ในห้องเย็น", "อยู่ในห้องเย็นใหญ่", "รอห้องเย็นรับเข้า", "รอรับเข้าห้องเย็น"],
  },
];

const OTHER = [
  "รอเตรียมวัตถุดิบใหม่", "รอเตรียมผสมวัตถุดิบ", "อยู่ที่ไลน์", "รอ QC Check", "รอแก้ไข", "รอบรรจุเสร็จ", "รอบรรจุจัดส่ง", "Done", "ยังไม่มีความเคลื่อนไหว",
];

const META = new Map();
let rank = 0;
STATUS_ZONES.forEach((z) => z.labels.forEach((label) => { rank += 1; META.set(label, { rank, zone: z }); }));
OTHER.forEach((label) => { rank += 1; META.set(label, { rank, zone: null }); });

/** { rank, zone } of a status name (names that are not listed go last) */
export const statusMeta = (label) => META.get(label) || { rank: 1000, zone: null };
export const statusRank = (label) => statusMeta(label).rank;
