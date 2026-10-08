import { forwardRef, useCallback, useImperativeHandle, useState } from "react";
import axios from "axios";
import AddTrolleyDialog from "./AddTrolleyDialog";
// QC check (ใช้ฟอร์มเดิมของ role QC)
import QcEditModal from "../../../../QC/QCCheck/Asset/ModalEditPD";
import QcPrintModal from "../../../../QC/QCCheck/Asset/Modal3";
// ส่งรถเข็นไปปลายทาง
import SendModal from "../../../PackTro/Asset/ModalSuccess";
// ผสมวัตถุดิบ
import MixSelectModal from "../../../IncludeRawmatPack/Asset/Modal4";
import MixScanModal from "../../../IncludeRawmatPack/Asset/ModalScanSAP";
import MixConfirmModal from "../../../IncludeRawmatPack/Asset/ModalConfirmSAP";

axios.defaults.withCredentials = true;
const API_URL = import.meta.env.VITE_API_URL;

// map แถวรูปแบบ qc/fetchRMForProd -> data ของฟอร์ม QC (เหมือน handleOpenEditModal ของหน้า QC เดิม)
const toQcEditData = (data) => ({
  batch: data.batch,
  mat: data.mat,
  mat_name: data.mat_name,
  production: data.production,
  rmfp_id: data.rmfp_id,
  mapping_id: data.mapping_id,
  weight_in_trolley: data.weight_in_trolley,
  process_name: data.process_name,
  CookedDateTime: data.CookedDateTime,
  withdraw_date_formatted: data.withdraw_date_formatted,
  tray_count: data.tray_count,
  withdraw_date: data.withdraw_date,
  rmit_date: data.rmit_date,
  edit_rework: data.edit_rework,
  remark_rework: data.remark_rework,
  remark_rework_cold: data.remark_rework_cold,
  ptp_time: data.prep_to_pack,
  rework_time: data.rework_time,
  tro_id: data.tro_id,
  rmfp_line_name: data.rmm_line_name,
  rm_status: data.rm_status,
  dest: data.dest,
  remark: data.remark,
  batch_after: data.batch_after,
  batch_before: data.batch_before,
  level_eu: data.level_eu,
  Moisture: data.Moisture,
  percent_fine: data.percent_fine,
  Temp: data.Temp,
  weight_RM: data.weight_RM,
  rmm_line_name: data.rmm_line_name,
  stay_place: data.stay_place,
  first_prod: data.first_prod,
  two_prod: data.two_prod,
  three_prod: data.three_prod,
  name_edit_prod_two: data.name_edit_prod_two,
  name_edit_prod_three: data.name_edit_prod_three,
  mat_2x: data.mat_2x,
});

/**
 * รวมขั้นตอนที่เคยอยู่คนละหน้า (QC / เพิ่มรถเข็น / ส่งรถเข็น / ผสมวัตถุดิบ) ให้เรียกจากตาราง Delay หน้าเดียว
 * ref: qc(row) · send(troId) · addTrolley() · mix()
 */
const PackFlows = forwardRef(({ onDone, onNotify }, ref) => {
  // ── QC ──
  const [qcEdit, setQcEdit] = useState(null);
  const [qcPrint, setQcPrint] = useState(null);

  // ── ส่งรถเข็น ──
  const [send, setSend] = useState(null); // { tro_id, tableData }

  // ── เพิ่มรถเข็น ──
  const [addOpen, setAddOpen] = useState(false);

  // ── ผสมวัตถุดิบ ──
  const [mixSelectOpen, setMixSelectOpen] = useState(false);
  const [mixScanOpen, setMixScanOpen] = useState(false);
  const [mixReview, setMixReview] = useState(false);
  const [primaryBatch, setPrimaryBatch] = useState("");
  const [secondaryBatch, setSecondaryBatch] = useState("");
  const [mixMaterials, setMixMaterials] = useState([]);
  const [mixWeight, setMixWeight] = useState("");

  const notify = useCallback((msg) => { onNotify?.(msg); }, [onNotify]);

  const openQc = async (row) => {
    try {
      const res = await axios.get(`${API_URL}/api/qc/fetchRMForProd`, { params: { rm_type_ids: row.rm_type_id } });
      const full = (res.data?.data || []).find((r) => r.mapping_id === row.mapping_id);
      if (!full) {
        notify("ไม่พบข้อมูลรายการนี้ในคิว QC (อาจมีผู้อื่นตรวจแล้ว)");
        onDone?.();
        return;
      }
      setQcEdit(toQcEditData(full));
    } catch (err) {
      console.error("[PackFlows] qc open error:", err);
      notify("โหลดข้อมูล QC ไม่สำเร็จ");
    }
  };

  // หลังบันทึกผล QC -> เปิดหน้าพิมพ์ (เหมือนหน้า QC เดิม)
  const handleQcSaved = async () => {
    if (!qcEdit?.mapping_id) return;
    try {
      const mapping_id = qcEdit.mapping_id;
      const [status, cold] = await Promise.all([
        axios.get(`${API_URL}/api/qc/print/status`, { params: { mapping_id } }),
        axios.get(`${API_URL}/api/history/cold-dates`, { params: { mapping_id } }),
      ]);
      if (status.data?.success) {
        setQcPrint({
          ...qcEdit,
          qcData: status.data.data,
          coldDates: cold.data?.success ? cold.data.data : null,
          hasBothDates: cold.data?.hasBothDates,
          hasBothDates2: cold.data?.hasBothDates2,
          hasBothDates3: cold.data?.hasBothDates3,
        });
      }
    } catch (err) {
      console.error("[PackFlows] qc print error:", err);
    } finally {
      onDone?.();
    }
  };

  const openSend = async (troId) => {
    try {
      const [raw, mix] = await Promise.all([
        axios.get(`${API_URL}/api/pack/main/modal/fetchRawMat`, { params: { tro_id: troId } }),
        axios.get(`${API_URL}/api/pack/main/modal/fetchRawMatMix`, { params: { tro_id: troId } }),
      ]);
      setSend({
        tro_id: troId,
        tableData: {
          rawMaterials: raw.data?.success ? raw.data.data : [],
          mixedMaterials: mix.data?.success ? mix.data.data : [],
        },
      });
    } catch (err) {
      console.error("[PackFlows] send open error:", err);
      notify("โหลดรายการในรถเข็นไม่สำเร็จ");
    }
  };

  useImperativeHandle(ref, () => ({
    qc: openQc,
    send: openSend,
    addTrolley: () => setAddOpen(true),
    mix: () => setMixSelectOpen(true),
  }));

  return (
    <>
      <AddTrolleyDialog open={addOpen} onClose={() => setAddOpen(false)} onAdded={() => { notify("เพิ่มรถเข็นเรียบร้อย"); onDone?.(); }} />

      {qcEdit && (
        <QcEditModal
          open
          data={qcEdit}
          onClose={() => setQcEdit(null)}
          onNext={() => setQcEdit(null)}
          onSuccess={handleQcSaved}
        />
      )}
      {qcPrint && (
        <QcPrintModal
          open
          data={qcPrint}
          CookedDateTime={qcPrint.CookedDateTime}
          withdraw_date_formatted={qcPrint.withdraw_date_formatted}
          coldDates={qcPrint.coldDates}
          hasBothDates={qcPrint.hasBothDates}
          hasBothDates2={qcPrint.hasBothDates2}
          hasBothDates3={qcPrint.hasBothDates3}
          onClose={() => setQcPrint(null)}
          onEdit={() => setQcPrint(null)}
          clearData={() => {}}
        />
      )}

      {send && (
        <SendModal
          open
          tro_id={send.tro_id}
          tableData={send.tableData}
          onClose={() => setSend(null)}
          onSuccess={() => onDone?.()}
          closeParentModal={() => setSend(null)}
        />
      )}

      {mixSelectOpen && (
        <MixSelectModal
          open
          onSuccess={() => onDone?.()}
          onClose={(picked) => {
            setMixSelectOpen(false);
            if (picked && picked.selectedMaterials?.length > 0) {
              setMixMaterials(picked.selectedMaterials);
              setMixWeight(picked.totalWeight || 0);
              setMixScanOpen(true);
            }
          }}
        />
      )}
      <MixScanModal
        open={mixScanOpen}
        onClose={() => setMixScanOpen(false)}
        onConfirm={({ primaryBatch: mat, secondaryBatch: batch, weightTotal, selectedMaterials, hu }) => {
          setPrimaryBatch(mat);
          setSecondaryBatch(batch);
          setMixReview({ material: mat, batch, emulsionweightTotal: weightTotal, hu, selectedMaterials });
          setMixScanOpen(false);
        }}
        primaryBatch={primaryBatch}
        secondaryBatch={secondaryBatch}
        setPrimaryBatch={setPrimaryBatch}
        setSecondaryBatch={setSecondaryBatch}
        selectedMaterials={mixMaterials}
        weightTotal={mixWeight}
      />
      <MixConfirmModal
        open={!!mixReview}
        onClose={() => { setMixReview(false); onDone?.(); }}
        {...(mixReview || {})}
      />
    </>
  );
});

PackFlows.displayName = "PackFlows";
export default PackFlows;
