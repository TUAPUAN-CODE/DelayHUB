const noTro = (v) => v === null || v === undefined || String(v).trim() === "" || String(v).trim() === "0";

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
  // out of a cold room to be checked in ("รอCheckin"), but its trolley is gone (prep put a new load on that trolley number: tro_id cleared, tl_status 1707):
  // it can only come back to prep. Without this it matched no status that has no trolley and was not shown anywhere.
  // Keep in sync with GET /api/prep/plan/pending-return (backend PreparationRoutes.js)
  if (r.stay_place === "ออกห้องเย็น" && r.dest === "รอCheckin" && noTro(r.tro_id) && ["รอกลับมาเตรียม", "QcCheck รอกลับมาเตรียม"].includes(st)) return "B";
  return null;
};
