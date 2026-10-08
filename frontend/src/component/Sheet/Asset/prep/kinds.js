// Which old list a mapping belongs to (rules copied from the queries of the old Prep pages)
//   A = "วัตถุดิบรอแก้ไข" (รับฝาก-รอแก้ไข)   B = "กลับมาเตรียม" (รอกลับมาเตรียม / QcCheck ... sent back to prep)
export const reworkKind = (r) => {
  if (r.__kind !== "map") return null;
  const st = String(r.rm_status || "");
  if (["ออกห้องเย็น", "บรรจุ", "หม้ออบ", "จุดเตรียม"].includes(r.stay_place) && ["จุดเตรียม", "เข้าห้องเย็น", "ไปบรรจุ"].includes(r.dest) && st === "รับฝาก-รอแก้ไข") return "A";
  if (
    ["ออกห้องเย็น", "หม้ออบ", "จุดเตรียม", "ออกห้องเย็นใหญ่"].includes(r.stay_place) && ["จุดเตรียม", "ส่งกลับจากห้องเย็นใหญ่"].includes(r.dest)
    && ["QcCheck รอกลับมาเตรียม", "QcCheck รอ MD", "รอกลับมาเตรียม", "รอ Qc", "QcCheck"].includes(st)
  ) return "B";
  return null;
};
