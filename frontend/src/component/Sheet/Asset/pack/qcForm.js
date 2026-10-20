// Result of a QC check typed in a form (same questions as the QC check modal of the QC page) and how it is sent to the server.
// Used by "เพิ่ม RM" of the Pack sheet: POST /api/pack/create/rm/manual { ..., qc: toQcPayload(qc) }

export const emptyQc = () => ({
  color: "", odor: "", texture: "", sq_remark: "", Sensoryacceptance: false,
  md: "", workArea: null, mdNo: null, md_time: null, md_remark: "",
  defect: "", defect_remark: "", Defectacceptance: false,
  Moisture: "", Temp: "", percent_fine: "", general_remark: "", shift: "",
});

const fmt = (d) => (d && d.isValid && d.isValid() ? d.format("YYYY-MM-DD HH:mm:ss") : null);

/** { ok, errors } — the same rules as the QC modal: every question answered, a remark when something fails, MD area + machine when MD passed */
export const validateQc = (qc) => {
  const e = {};
  if (qc.color === "") e.color = true;
  if (qc.odor === "") e.odor = true;
  if (qc.texture === "") e.texture = true;
  const sensoryFail = [qc.color, qc.odor, qc.texture].includes("0");
  if (sensoryFail && !qc.sq_remark.trim()) e.sq_remark = "กรุณาระบุหมายเหตุ Sensory ที่ไม่ผ่าน";
  if (qc.md === "") e.md = true;
  if (qc.md === "1" && !qc.workArea) e.workArea = "กรุณาเลือกพื้นที่เครื่อง MD";
  if (qc.md === "1" && !qc.mdNo) e.mdNo = "กรุณาเลือกเครื่อง MD";
  if (qc.defect === "") e.defect = true;
  if (qc.defect === "0" && !qc.defect_remark.trim()) e.defect_remark = "กรุณาระบุหมายเหตุ Defect ที่ไม่ผ่าน";
  return { ok: Object.keys(e).length === 0, errors: e };
};

export const toQcPayload = (qc) => ({
  color: Number(qc.color), odor: Number(qc.odor), texture: Number(qc.texture),
  sq_remark: qc.sq_remark.trim() || null, Sensoryacceptance: qc.Sensoryacceptance ? 1 : 0,
  md: Number(qc.md), md_remark: qc.md_remark.trim() || null,
  md_no: qc.md === "1" ? qc.mdNo?.md_no || null : null, WorkAreaCode: qc.md === "1" ? qc.workArea?.WorkAreaCode || null : null,
  md_time: qc.md === "1" ? fmt(qc.md_time) : null,
  defect: Number(qc.defect), defect_remark: qc.defect_remark.trim() || null, Defectacceptance: qc.Defectacceptance ? 1 : 0,
  Moisture: qc.Moisture.trim() || null, Temp: qc.Temp.trim() || null, percent_fine: qc.percent_fine.trim() || null,
  general_remark: qc.general_remark.trim() || null, prepare_mor_night: qc.shift || null,
});
