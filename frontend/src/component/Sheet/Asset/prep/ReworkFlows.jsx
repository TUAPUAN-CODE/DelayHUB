import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import axios from "axios";
// forms of the old page "วัตถุดิบรอแก้ไข" (rework) and "กลับมาเตรียม" (import) — each list had its own set of forms and save endpoints
import RwModal1 from "../../../Prep/MatRework/Asset/Modal1";
import RwModal2 from "../../../Prep/MatRework/Asset/Modal2";
import RwModal3 from "../../../Prep/MatRework/Asset/Modal3";
import RwEdit from "../../../Prep/MatRework/Asset/ModalEditPD";
import ImModal1 from "../../../Prep/MatImport/Asset/Modal1";
import ImModal2 from "../../../Prep/MatImport/Asset/Modal2";
import ImModal3 from "../../../Prep/MatImport/Asset/Modal3";
import ImEdit from "../../../Prep/MatImport/Asset/ModalEditPD";
import { isFlowGroup } from "../dbs";

axios.defaults.withCredentials = true;
const API_URL = import.meta.env.VITE_API_URL;

// Batch แปลงที่กรอกได้ในฟอร์ม (เหมือนปุ่ม "ใส่รถเข็น" ของแผนผลิต: แสดงช่องทุกประเภทวัตถุดิบ ค่าเดิมใส่ไว้ให้แก้;
// บังคับครบ 10 ตัวอักษรเฉพาะประเภท 3, 6, 7, 8 — ประเภทอื่นเว้นว่างได้ = ใช้ค่าเดิม) — [{ before: Batch ตั้งต้น, after: Batch แปลงเดิม, required }]
const BATCH_REQUIRED_TYPES = [3, 6, 7, 8];
const batchPairs = (row) => {
  const required = BATCH_REQUIRED_TYPES.includes(Number(row?.rm_type_id));
  const split = (v) => String(v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const before = split(row.batch_before);
  const after = split(row.batch_after);
  if (!before.length && !after.length) return [];
  if (before.length === after.length) return before.map((b, i) => ({ before: b, after: after[i], required }));
  if (before.length <= 1 && after.length <= 1) return [{ before: before[0] || after[0], after: after[0] || before[0], required }];
  return [];   // the lists do not line up: leave Batch แปลง alone instead of guessing which is which
};

const SOURCES = {
  rework: ["/api/prep/mat/rework/fetchRMForProd", "/api/prep/mat/rework/fetchRMForProdNoBatchAfter"],
  import: ["/api/prep/matimport/fetchRMForProd"],
};

/**
 * Put the material in a trolley again (modal chain 1→2→3), edit its production plan. The full row of the old list is loaded on click,
 * so the forms get exactly the data they got on the old page. Methods: cart(row, 'rework'|'import'), edit(row, 'rework'|'import').
 */
const ReworkFlows = forwardRef(({ onDone }, ref) => {
  const [kind, setKind] = useState("rework");
  const [m1, setM1] = useState(null);
  const [m2, setM2] = useState(null);
  const [m3, setM3] = useState(null);
  const [edit, setEdit] = useState(null);
  const batchAfterRef = useRef(null);   // Batch แปลงที่กรอกในขั้นแรก ส่งต่อไปขั้นบันทึก
  const im = kind === "import";
  const M1 = im ? ImModal1 : RwModal1;
  const M2 = im ? ImModal2 : RwModal2;
  const M3 = im ? ImModal3 : RwModal3;
  const Edit = im ? ImEdit : RwEdit;

  const loadRow = async (k, row) => {
    const results = await Promise.all(SOURCES[k].map((u) => axios.get(`${API_URL}${u}`, { params: { rm_type_ids: row.rm_type_id } }).catch((err) => { console.error("[ReworkFlows] load error:", err); return null; })));
    const found = results.flatMap((r) => (r?.data?.success ? r.data.data : [])).find((x) => x.mapping_id === row.mapping_id);
    if (found) return found;
    // not in the old queue of this kind (the status "รอเตรียมวัตถุดิบใหม่" also covers rows the old queues do not list): build the form data from the sheet row itself
    console.warn("[ReworkFlows] row not in the old queue, using the sheet row:", row.mapping_id, k);
    return {
      mapping_id: row.mapping_id, tro_id: row.tro_id, rm_status: row.rm_status, qccheck_cold: row.qccheck_cold, remark_rework: row.remark_rework, remark_rework_cold: row.remark_rework_cold,
      rm_type_id: row.rm_type_id, CookedDateTime: row.cooked_date, batch: row.batch_after || row.batch, edit_rework: row.edit_rework, rmfp_id: row.rmfp_id,
      mat: row.mat, mat_name: row.mat_name, production: row.code || row.production,
    };
  };

  const clear = () => { setM1(null); setM2(null); setM3(null); batchAfterRef.current = null; };

  useImperativeHandle(ref, () => ({
    cart: async (row, k) => {
      const d = await loadRow(k, row);
      if (!d) { onDone?.(); return; }
      setKind(k);
      batchAfterRef.current = null;
      const batches = batchPairs(row);
      setM1(k === "import"
        ? { rm_type_id: d.rm_type_id, mapping_id: d.mapping_id, tro_id: d.tro_id, CookedDateTime: d.CookedDateTime, batch: d.batch, edit_rework: d.edit_rework, rmfp_id: d.rmfp_id, isFlow: isFlowGroup(row), batches }
        : { mapping_id: d.mapping_id, tro_id: d.tro_id, rm_status: d.rm_status, qccheck_cold: d.qccheck_cold, remark_rework: d.remark_rework, remark_rework_cold: d.remark_rework_cold, batches });
    },
    edit: async (row, k) => {
      const d = await loadRow(k, row);
      if (!d) { onDone?.(); return; }
      setKind(k);
      setEdit({ batch: d.batch, mat: d.mat, mat_name: d.mat_name, production: d.production, mapping_id: d.mapping_id, batches: batchPairs(row) });
    },
  }));

  const next2 = (data) => {
    batchAfterRef.current = data?.batchAfterArray?.length ? data.batchAfterArray : null;
    setM2(im
      ? { ...data, batch: data.batch, mapping_id: m1?.mapping_id, tro_id: m1?.tro_id, CookedDateTime: m1?.CookedDateTime, rm_type_id: m1?.rm_type_id, edit_rework: m1?.edit_rework, isFlow: m1?.isFlow }
      : { ...data, mapping_id: m1?.mapping_id, tro_id: m1?.tro_id, rm_status: m1?.rm_status, qccheck_cold: m1?.qccheck_cold, remark_rework_cold: m1?.remark_rework_cold, remark_rework: m1?.remark_rework });
    setM1((v) => v && { ...v, __closed: true });
  };
  const next3 = (data) => {
    // Batch แปลงที่กรอก: ส่งไปบันทึกพร้อมรถเข็น (กลับมาเตรียม: newBatch = Batch แปลงใหม่ที่แสดง/บันทึกเป็นตัวหลักของ mapping ใหม่)
    const batchAfterArray = batchAfterRef.current || undefined;
    const newBatch = batchAfterArray ? batchAfterArray.map((b) => b.batch_after).join(", ") : undefined;
    setM3(im
      ? { ...data, mapping_id: m1?.mapping_id, tro_id: m1?.tro_id, edit_rework: m1?.edit_rework, isFlow: m1?.isFlow, batchAfterArray, newBatch }
      : { ...data, mapping_id: m1?.mapping_id, tro_id: m1?.tro_id, rm_status: m1?.rm_status, qccheck_cold: m1?.qccheck_cold, remark_rework_cold: m1?.remark_rework_cold, remark_rework: m1?.remark_rework, batchAfterArray, newBatch });
    setM2(null);
  };

  const onEditSaved = async (updated) => {
    if (im) {
      try { await axios.put(`${API_URL}/api/oven/toCold/updateProduction`, updated); } catch (err) { console.error("[ReworkFlows] update error:", err); }
    }
    setEdit(null);
    onDone?.();
  };

  const modal1Open = !!m1 && !m1.__closed;
  return (
    <>
      <M1
        open={modal1Open} onClose={() => setM1(null)} onNext={next2} data={m1}
        mapping_id={m1?.mapping_id} tro_id={m1?.tro_id} rm_type_id={m1?.rm_type_id} batch={m1?.batch} rmfp_id={m1?.rmfp_id} batches={m1?.batches}
      />
      <M2
        open={!!m2} onClose={() => clear()} onNext={next3} data={m2} clearData={clear}
        batch={m2?.batch} batch_before={m2?.batch_before} rm_type_id={m2?.rm_type_id} CookedDateTime={m2?.CookedDateTime}
      />
      {m3 && (
        <M3
          open CookedDateTime={m3?.CookedDateTime} onClose={() => { clear(); onDone?.(); }} data={m3} clearData={clear}
          onEdit={() => { setM2(m3); setM3(null); }}
        />
      )}
      {edit && <Edit open onClose={() => setEdit(null)} onNext={() => setEdit(null)} data={edit} onSuccess={onEditSaved} />}
    </>
  );
});
ReworkFlows.displayName = "ReworkFlows";

export default ReworkFlows;
