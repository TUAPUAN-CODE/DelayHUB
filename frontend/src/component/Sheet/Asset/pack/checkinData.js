// Builds the data of the Pack check-in form (Pack/CheckIn/Asset/ModalEditPD) from the sheet rows of ONE trolley.
// Same shape the old check-in page produced: trolley level fields + materials[] (one per mapping in that trolley).

export const CHECKIN_DEST = ["รอCheckin", "บรรจุ", "ไปบรรจุ"];

const MATERIAL_FIELDS = [
  "remaining_rework_time", "standard_rework_time", "mapping_id", "cooked_date", "rmit_date", "come_cold_date", "come_cold_date_two", "come_cold_date_three",
  "withdraw_date", "mix_code", "prod_mix", "weight_RM", "tray_count", "name_edit_prod_two", "name_edit_prod_three", "first_prod", "two_prod", "three_prod",
  "remark_rework", "remark_rework_cold", "edit_rework", "receiver_qc_cold", "approver", "qccheck_cold", "prepare_mor_night", "mixed_date", "mix_time",
  "sq_remark", "md_remark", "defect_remark", "qccheck", "mdcheck", "defectcheck", "machine_MD", "sq_acceptance", "defect_acceptance",
];

const toMaterial = (r) => {
  const m = {
    batch: r.batch_after || r.batch,
    material_code: r.mix_code && !r.mat ? r.mix_code : r.mat,
    materialName: r.mat_name,
    production: r.code,
    levelEu: r.level_eu,
    materialStatus: r.rm_status,
    cold_time: r.cold,
    standard_cold: r.standard_cold,
    ptc_time: r.remaining_ptp_time,
    standard_ptc: r.standard_ptp_time,
    rawMatType: r.mix_code ? "mixed" : "regular",
  };
  MATERIAL_FIELDS.forEach((k) => { m[k] = r[k]; });
  return m;
};

export const toCheckinEditData = (row, allRows) => {
  const same = (allRows || []).filter((r) => r.__kind === "map" && r.tro_id && r.tro_id === row.tro_id && CHECKIN_DEST.includes(r.dest));
  const group = same.length ? same : [row];
  const head = group[0];
  const materials = group.map(toMaterial);
  const first = materials[0] || {};
  const isMixed = head.mix_code ? true : false;
  return {
    tro_id: head.tro_id,
    slot_id: head.slot_id,
    mapping_id: head.mapping_id,
    production: head.code,
    rmm_line_name: head.rmm_line_name,
    rawMatType: isMixed ? "mixed" : "regular",
    batch: first.batch,
    mat: isMixed ? head.mix_code : first.material_code,
    mat_name: isMixed ? `Mixed: ${head.mix_code}` : first.materialName,
    rmfp_id: head.rmfp_id,
    rm_cold_status: head.rm_status,
    rm_status: first.materialStatus,
    ptc_time: head.remaining_ptp_time || "-",
    cold: "-",
    batch_after: head.batch_after,
    level_eu: first.levelEu,
    weight_RM: head.weight_RM,
    tray_count: head.tray_count,
    name_edit_prod_two: head.name_edit_prod_two,
    name_edit_prod_three: head.name_edit_prod_three,
    first_prod: head.first_prod,
    two_prod: head.two_prod,
    three_prod: head.three_prod,
    remark_rework: head.remark_rework,
    remark_rework_cold: head.remark_rework_cold,
    edit_rework: head.edit_rework,
    receiver_qc_cold: head.receiver_qc_cold,
    approver: head.approver,
    qccheck_cold: head.qccheck_cold,
    prepare_mor_night: head.prepare_mor_night,
    cooked_date: head.cooked_date,
    rmit_date: head.rmit_date,
    standard_ptc: head.standard_ptp_time,
    remaining_rework_time: head.remaining_rework_time,
    standard_rework_time: head.standard_rework_time,
    mix_code: head.mix_code,
    prod_mix: head.prod_mix,
    mixed_date: head.mixed_date,
    come_cold_date: head.come_cold_date,
    come_cold_date_two: head.come_cold_date_two,
    come_cold_date_three: head.come_cold_date_three,
    latestComeColdDate: head.come_cold_date_three || head.come_cold_date_two || head.come_cold_date,
    ComeColdDateTime: head.come_cold_date,
    withdraw_date: head.withdraw_date,
    materials,
  };
};
