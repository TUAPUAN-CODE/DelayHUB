// Column registry of the Master Delay Sheet. Every row (HU or mapping) is shown with the same columns; empty cells mean "not done yet".
// Time columns use the DB field name as key, so a HU row (SAP_Receive) and a mapping row (History) fill the same column.

export const GROUPS = [
  { key: "info", label: "ข้อมูลวัตถุดิบ", color: "#1552F0" },
  { key: "prep", label: "เตรียม / QC", color: "#B45309" },
  { key: "cs1", label: "ห้องเย็น (รอบ 1–3)", color: "#0277BD" },
  { key: "cs2", label: "ห้องเย็นใหญ่ (รอบ 1–4)", color: "#4527A0" },
  { key: "sap", label: "วัตถุดิบไม่แปรรูป (HU)", color: "#00796B" },
  { key: "pack", label: "บรรจุ", color: "#2E7D32" },
  { key: "dbs", label: "DBS (Delay)", color: "#C62828" },
];

const t = (key, label, group, width = 112) => ({ key, label, group, type: "time", width });
const x = (key, label, group, width = 110, extra = {}) => ({ key, label, group, type: "text", width, ...extra });

export const COLUMNS = [
  // ข้อมูล
  x("hu", "HU", "info", 100),
  x("mapping_id", "Mapping", "info", 80),
  x("tro_id", "รถเข็น", "info", 80),
  x("batch", "Batch", "info", 110, { get: (r) => r.batch_after || r.batch }),
  x("mat", "รหัสวัตถุดิบ", "info", 100),
  x("mat_name", "ชื่อวัตถุดิบ", "info", 190),
  x("code", "แผนผลิต", "info", 130),
  x("rmm_line_name", "ไลน์", "info", 90),
  x("weight_RM", "น้ำหนัก", "info", 80, { get: (r) => r.weight_RM ?? r.weight, align: "right" }),
  x("tray_count", "ถาด", "info", 60, { align: "right" }),
  x("rm_status", "สถานะวัตถุดิบ", "info", 130),
  x("dest", "ปลายทาง", "info", 110),
  x("cs_name", "ห้อง", "info", 90),
  x("slot_id", "ช่อง", "info", 70),
  // เตรียม / QC
  t("cooked_date", "ต้ม/อบเสร็จ", "prep"),
  t("rmit_date", "เตรียมเสร็จ", "prep"),
  t("withdraw_date", "เบิก / จ่ายลงไลน์ 1", "prep"),
  t("start_mixed_date", "เริ่มผสม", "prep"),
  t("start_gravy_date", "เริ่มใส่ Gravy", "prep"),
  t("gm_date", "เริ่มบด", "prep"),
  t("qc_date", "QC ตรวจ", "prep"),
  // ห้องเย็น 1-3
  t("come_cold_date", "เข้าห้องเย็น 1", "cs1"),
  t("out_cold_date", "ออกห้องเย็น 1", "cs1"),
  t("come_cold_date_two", "เข้าห้องเย็น 2", "cs1"),
  t("out_cold_date_two", "ออกห้องเย็น 2", "cs1"),
  t("come_cold_date_three", "เข้าห้องเย็น 3", "cs1"),
  t("out_cold_date_three", "ออกห้องเย็น 3", "cs1"),
  // ห้องเย็นใหญ่ 1-4
  t("cs_come_cold_date", "เข้าห้องเย็นใหญ่ 1", "cs2"),
  t("cs_out_cold_date", "ออกห้องเย็นใหญ่ 1", "cs2"),
  t("cs_come_cold_date_two", "เข้าห้องเย็นใหญ่ 2", "cs2"),
  t("cs_out_cold_date_two", "ออกห้องเย็นใหญ่ 2", "cs2"),
  t("cs_come_cold_date_three", "เข้าห้องเย็นใหญ่ 3", "cs2"),
  t("cs_out_cold_date_three", "ออกห้องเย็นใหญ่ 3", "cs2"),
  t("cs_come_cold_date_four", "เข้าห้องเย็นใหญ่ 4", "cs2"),
  t("cs_out_cold_date_four", "ออกห้องเย็นใหญ่ 4", "cs2"),
  // HU (SAP)
  t("start_defrost_date", "เริ่มละลาย 1", "sap"),
  t("end_defrost_date", "ละลายเสร็จ 1", "sap"),
  t("input_pd_date", "ไลน์รับเข้า 1", "sap"),
  t("output_pd_date", "ไลน์ส่งคืน 1", "sap"),
  t("input_cd_date", "รับเข้าห้องเย็น 1", "sap"),
  t("withdraw_date_two", "จ่ายลงไลน์ 2", "sap"),
  t("start_defrost_date_two", "เริ่มละลาย 2", "sap"),
  t("end_defrost_date_two", "ละลายเสร็จ 2", "sap"),
  t("input_pd_date_two", "ไลน์รับเข้า 2", "sap"),
  t("output_pd_date_two", "ไลน์ส่งคืน 2", "sap"),
  t("input_cd_date_two", "รับเข้าห้องเย็น 2", "sap"),
  t("withdraw_date_three", "จ่ายลงไลน์ 3", "sap"),
  t("start_defrost_date_three", "เริ่มละลาย 3", "sap"),
  t("end_defrost_date_three", "ละลายเสร็จ 3", "sap"),
  t("input_pd_date_three", "ไลน์รับเข้า 3", "sap"),
  t("output_pd_date_three", "ไลน์ส่งคืน 3", "sap"),
  t("input_cd_date_three", "รับเข้าห้องเย็น 3", "sap"),
  t("withdraw_date_four", "จ่ายลงไลน์ 4", "sap"),
  t("start_defrost_date_four", "เริ่มละลาย 4", "sap"),
  t("end_defrost_date_four", "ละลายเสร็จ 4", "sap"),
  // บรรจุ
  t("sc_pack_date", "ยืนยันบรรจุ", "pack"),
  x("remark_dalay", "หมายเหตุ Delay", "pack", 160),
  // DBS
  { key: "DBS1", label: "DBS1 เตรียม→ห้องเย็น", group: "dbs", type: "dbs", dbsIndex: 0, width: 120 },
  { key: "DBS2", label: "DBS2 อยู่ห้องเย็น", group: "dbs", type: "dbs", dbsIndex: 1, width: 120 },
  { key: "DBS3", label: "DBS3 ห้องเย็น→บรรจุ", group: "dbs", type: "dbs", dbsIndex: 2, width: 120 },
  { key: "DBS4", label: "DBS4 รวม", group: "dbs", type: "dbs", dbsIndex: 3, width: 120 },
];

export const COLUMN_BY_KEY = Object.fromEntries(COLUMNS.map((c) => [c.key, c]));

const INFO = ["hu", "mapping_id", "tro_id", "batch", "mat_name", "code", "weight_RM", "rm_status", "dest", "cs_name", "slot_id"];
const DBS = ["DBS1", "DBS2", "DBS3", "DBS4"];

/** columns shown the first time a user opens the sheet (each user can change them with the settings button) */
export const DEFAULT_VISIBLE = {
  prep: [...INFO, "cooked_date", "rmit_date", "start_mixed_date", "qc_date", "come_cold_date", "out_cold_date", ...DBS],
  qc: [...INFO, "cooked_date", "rmit_date", "qc_date", ...DBS],
  cs1: [...INFO, "rmit_date", "come_cold_date", "out_cold_date", "come_cold_date_two", "out_cold_date_two", "come_cold_date_three", "out_cold_date_three", "DBS1", "DBS2"],
  cs2: [...INFO, "withdraw_date", "start_defrost_date", "end_defrost_date", "input_pd_date", "output_pd_date", "input_cd_date", "cs_come_cold_date", "cs_out_cold_date", "cs_come_cold_date_two", "cs_out_cold_date_two", ...DBS],
  pack: [...INFO, "rmit_date", "come_cold_date", "out_cold_date", "qc_date", "sc_pack_date", ...DBS],
  sup: [...INFO, "rmit_date", "come_cold_date", "out_cold_date", "cs_come_cold_date", "cs_out_cold_date", "qc_date", "sc_pack_date", ...DBS],
};

export const ROLE_LABEL = {
  prep: "จุดเตรียม",
  qc: "QC",
  cs1: "ห้องเย็น v1",
  cs2: "ห้องเย็น v2",
  pack: "บรรจุ",
  sup: "Supervisor",
};
