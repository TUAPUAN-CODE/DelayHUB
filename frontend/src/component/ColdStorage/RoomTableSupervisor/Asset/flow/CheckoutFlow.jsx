import { forwardRef, useCallback, useImperativeHandle, useState } from "react";
import axios from "axios";
import { Alert, Snackbar } from "@mui/material";
import ModalEditPD from "../checkout/ModalEditPD";
import { calculateMaterialDelayTime } from "../checkout/delayTime";

axios.defaults.withCredentials = true;
const API_URL = import.meta.env.VITE_API_URL;

/**
 * Check-out ("ส่งออก") of a trolley from the cold room: the dialogs of the old check-out page (quality check + slip + out of the cold room).
 * Those dialogs work on a whole trolley (all its materials), so the trolley is loaded from the same two APIs the old page used and
 * then handed to ModalEditPD exactly as before. Open it through the ref:  ref.current.open(row)
 */
  const buildEditData = (data) => {
    // ตรวจสอบ ptc_time จากทั้งระดับบนสุดและใน materials
    const mainPtcTime = data.ptc_time; // ptc_time จากข้อมูลหลัก
    const materialPtcTime = data.materials?.[0]?.ptc_time; // ptc_time จากวัตถุดิบชิ้นแรก
    const effectivePtcTime = mainPtcTime || materialPtcTime || "-"; // ใช้ค่าใดค่าหนึ่งที่มีอยู่
    
    // ตรวจสอบว่าเป็นวัตถุดิบผสมหรือไม่
    const isMixed = data.rawMatType === 'mixed';
    
    // กำหนดค่ารหัสวัตถุดิบและชื่อวัตถุดิบตามประเภท
    const materialCode = isMixed ? data.mix_code : data.materials?.[0]?.material_code;
    const materialName = isMixed ? `Mixed: ${data.mix_code}` : data.materials?.[0]?.materialName;
    
    return ({
      batch: data.batch || data.materials?.[0]?.batch,
      mat: materialCode, // ใช้ mix_code ถ้าเป็นวัตถุดิบผสม
      mat_name: materialName, // ใช้ "Mixed: [mix_code]" ถ้าเป็นวัตถุดิบผสม
      production: data.production, // ส่งข้อมูล production
      rmm_line_name: data.rmm_line_name, // เพิ่มการส่งค่า rmm_line_name
      remark_rework : data.remark_rework,
      remark_rework_cold : data.remark_rework_cold,
      edit_rework: data.edit_rework,
      qccheck_cold : data.qccheck_cold,
      prepare_mor_night : data.prepare_mor_night,
      rmfp_id: data.rmfp_id,
      rm_cold_status: data.trolleyStatus,
      rm_status: data.materials?.[0]?.materialStatus,
      tro_id: data.tro_id,
      slot_id: data.slot_id,
      ComeColdDateTime: data.latestComeColdDate,
      ptc_time: effectivePtcTime, // ใช้ค่า ptc_time ที่มีประสิทธิภาพ
      cold: data.cold || "-",
      batch_after: data.batch_after,
      batch_before: data.batch_before,
      level_eu: data.materials?.[0]?.levelEu,
      
      // เพิ่มข้อมูลอื่นๆ ที่อาจจำเป็น
      weight_RM: data.weight_RM,
      tray_count: data.tray_count,
      name_edit_prod_two : data.name_edit_prod_two || data.materials?.[0]?.name_edit_prod_two,
      name_edit_prod_three : data.name_edit_prod_three || data.materials?.[0]?.name_edit_prod_three,
      first_prod : data.first_prod || data.materials?.[0]?.first_prod,
      two_prod : data.two_prod || data.two_prod?.[0]?.two_prod,
      three_prod : data.three_prod || data.three_prod?.[0]?.three_prod,
      remark_rework : data.remark_rework || data.materials?.[0]?.remark_rework,
      remark_rework_cold : data.remark_rework_cold || data.materials?.[0]?.remark_rework_cold,
      edit_rework : data.edit_rework || data.materials?.[0]?.edit_rework,
      receiver_qc_cold : data.receiver_qc_cold || data.materials?.[0]?.receiver_qc_cold,
      approver : data.approver || data.materials?.[0]?.approver,
      qccheck_cold : data.qccheck_cold || data.materials?.[0]?.qccheck_cold,
      prepare_mor_night : data.prepare_mor_night || data.materials?.[0]?.prepare_mor_night,
      // ข้อมูลอื่นๆ ยังคงเหมือนเดิม
      cooked_date: data.cooked_date,
      rmit_date: data.rmit_date,
      standard_ptc: data.standard_ptc,
      mapping_id: data.mapping_id,
      remaining_rework_time: data.remaining_rework_time,
      standard_rework_time: data.standard_rework_time,
      
      formattedDelayTime: data.formattedDelayTime,
      latestComeColdDate: data.latestComeColdDate,
      
      // ข้อมูลเพิ่มเติมสำหรับวัตถุดิบแบบผสม
      mix_code: data.mix_code,
      prod_mix: data.prod_mix,
      mix_time: data.mix_time,
      mixed_date: data.mixed_date,
      come_cold_date: data.come_cold_date,
      come_cold_date_two: data.come_cold_date_two,
      come_cold_date_three: data.come_cold_date_three,
      rawMatType: data.rawMatType, // เพิ่มประเภทของวัตถุดิบ
      
      // Add QC information
      sq_remark: data.sq_remark || data.materials?.[0]?.sq_remark,
      md_remark: data.md_remark || data.materials?.[0]?.md_remark,
      defect_remark: data.defect_remark || data.materials?.[0]?.defect_remark,
      qccheck: data.qccheck || data.materials?.[0]?.qccheck,
      mdcheck: data.mdcheck || data.materials?.[0]?.mdcheck,
      defectcheck: data.defectcheck || data.materials?.[0]?.defectcheck,
      machine_MD: data.machine_MD,
      sq_acceptance: data.sq_acceptance,
      defect_acceptance: data.defect_acceptance,
      withdraw_date: data.withdraw_date || data.materials?.[0]?.withdraw_date,
      
      
      materials: data.materials ? data.materials.map(material => {
        // กำหนดค่ารหัสวัตถุดิบและชื่อวัตถุดิบสำหรับแต่ละวัตถุดิบตามประเภท
        const isMaterialMixed = material.rawMatType === 'mixed' || data.rawMatType === 'mixed';
        const materialCode = isMaterialMixed ? (material.mix_code || data.mix_code) : material.material_code;
        const materialName = isMaterialMixed ? `Mixed: ${material.mix_code || data.mix_code}` : material.materialName;
        
        return {
          ...material,
          material_code: materialCode, // ปรับปรุงรหัสวัตถุดิบ
          materialName: materialName, // ปรับปรุงชื่อวัตถุดิบ
          ptc_time: material.ptc_time || effectivePtcTime, // ใช้ค่า ptc_time ของแต่ละวัตถุดิบหรือค่าหลักถ้าไม่มี
          formattedDelayTime: material.formattedDelayTime || data.cold || "-",
          cooked_date: material.cooked_date || data.cooked_date || "-",
          rmit_date: material.rmit_date || data.rmit_date,
          mapping_id: material.mapping_id || data.mapping_id,
          remaining_rework_time: material.remaining_rework_time || data.remaining_rework_time,
          standard_rework_time: material.standard_rework_time || data.standard_rework_time,
          withdraw_date : material.withdraw_date || data.withdraw_date,
          weight_RM: material.weight_RM || data.weight_RM,
          tray_count: material.tray_count|| data.tray_count,
          name_edit_prod_two : material.name_edit_prod_two || data.name_edit_prod_two,
          name_edit_prod_three : material.name_edit_prod_three || data.name_edit_prod_three,
          first_prod : material.first_prod || data.first_prod,
          two_prod : material.two_prod || data.two_prod,
          three_prod : material.three_prod || data.three_prod,
          remark_rework : material.remark_rework || data.remark_rework,
          remark_rework_cold : material.remark_rework_cold || data.remark_rework_cold,
          edit_rework : material.edit_rework || data.edit_rework,
        receiver_qc_cold : material.receiver_qc_cold || data.receiver_qc_cold,
        approver : material.approver || data.approver,
        qccheck_cold : material.qccheck_cold || data.qccheck_cold,
        prepare_mor_night : material.prepare_mor_night || data.prepare_mor_night,

          // Pass QC information for each material
          sq_remark: material.sq_remark || data.sq_remark || "-",
          md_remark: material.md_remark || data.md_remark || "-",
          defect_remark: material.defect_remark || data.defect_remark || "-",
          qccheck: material.qccheck || data.qccheck || "-",
          mdcheck: material.mdcheck || data.mdcheck || "-",
          defectcheck: material.defectcheck || data.defectcheck || "-",
          machine_MD: material.machine_MD || data.machine_MD,
          sq_acceptance: material.sq_acceptance || data.sq_acceptance || "-",
          defect_acceptance: material.defect_acceptance || data.defect_acceptance || "-",
        };
      }) : []
    });
    
};

/** Same grouping as the old check-out table: the flat rows of one trolley become one trolley object with materials[]. */
const groupTrolley = (items) => {
  const trolleyMap = new Map();
  items.forEach((item) => {
        const troId = item.tro_id;

        if (!trolleyMap.has(troId)) {
          // สร้างข้อมูลรถเข็นใหม่
          trolleyMap.set(troId, {
            tro_id: troId,
            slot_id: item.slot_id,
            mapping_id: item.mapping_id,
            production: item.production,
            rmm_line_name: item.rmm_line_name,
            trolleyStatus: item.rm_cold_status,
            cold: item.cold,
            cooked_date: item.cooked_date,
            rmit_date: item.rmit_date,
            standard_cold: item.standard_cold,
            remaining_rework_time: item.remaining_rework_time,
            standard_rework_time: item.standard_rework_time,
            come_cold_date: item.come_cold_date,
            come_cold_date_two: item.come_cold_date_two,
            come_cold_date_three: item.come_cold_date_three,
            ptc_time: item.ptc_time,
            standard_ptc: item.standard_ptc,
            rawMatType: item.rawMatType, // เพิ่มประเภทของวัตถุดิบ
            mix_time: item.mix_time, // เพิ่ม mix_time สำหรับวัตถุดิบผสม
            mixed_date: item.mixed_date, // เพิ่ม mixed_date
            mix_code: item.mix_code, // เพิ่ม mix_code สำหรับรถเข็น
            prod_mix: item.prod_mix, // เพิ่ม prod_mix
            name_edit_prod_two: item.name_edit_prod_two,
            name_edit_prod_three: item.name_edit_prod_three,
            first_prod: item.first_prod,
            two_prod: item.two_prod,
            three_prod: item.three_prod,
            remark_rework: item.remark_rework,
            remark_rework_cold: item.remark_rework_cold,
            edit_rework: item.edit_rework,
            receiver_qc_cold: item.receiver_qc_cold,
            approver: item.approver,
            qccheck_cold: item.qccheck_cold,
            prepare_mor_night: item.prepare_mor_night,
            batch_before: item.batch_before,
            materials: []
          });
        }

        // เพิ่มข้อมูลวัตถุดิบลงในรถเข็น
        // ในส่วนของ useEffect ที่จัดการข้อมูล
        trolleyMap.get(troId).materials.push({
          batch: item.batch,
          material_code: item.mat,
          materialName: item.mat_name,
          production: item.production,
          levelEu: item.level_eu,
          materialStatus: item.rm_status,
          cold_time: item.cold,
          standard_cold: item.standard_cold,
          remaining_rework_time: item.remaining_rework_time,
          standard_rework_time: item.standard_rework_time,
          mapping_id: item.mapping_id,
          cooked_date: item.cooked_date,
          rmit_date: item.rmit_date,
          come_cold_date: item.come_cold_date,
          out_cold_date: item.out_cold_date,
          come_cold_date_two: item.come_cold_date_two,
          out_cold_date_two: item.out_cold_date_two,
          come_cold_date_three: item.come_cold_date_three,
          out_cold_date_three: item.out_cold_date_three,
          cs_come_cold_date: item.cs_come_cold_date,
          cs_out_cold_date: item.cs_out_cold_date,
          cs_come_cold_date_two: item.cs_come_cold_date_two,
          cs_out_cold_date_two: item.cs_out_cold_date_two,
          cs_come_cold_date_three: item.cs_come_cold_date_three,
          cs_out_cold_date_three: item.cs_out_cold_date_three,
          cs_come_cold_date_four: item.cs_come_cold_date_four,
          cs_out_cold_date_four: item.cs_out_cold_date_four,
          cs_come_cold_date_five: item.cs_come_cold_date_five,
          cs_out_out_date_five: item.cs_out_out_date_five,
          cs_come_cold_date_six: item.cs_come_cold_date_six,
          cs_out_cold_date_six: item.cs_out_cold_date_six,
          cs_come_cold_date_seven: item.cs_come_cold_date_seven,
          cs_out_cold_date_seven: item.cs_out_cold_date_seven,
          cs_come_cold_date_eight: item.cs_come_cold_date_eight,
          cs_out_cold_date_eight: item.cs_out_cold_date_eight,
          cs_come_cold_date_nine: item.cs_come_cold_date_nine,
          cs_out_cold_date_nine: item.cs_out_cold_date_nine,
          cs_come_cold_date_ten: item.cs_come_cold_date_ten,
          cs_out_cold_date_ten: item.cs_out_cold_date_ten,
          withdraw_date: item.withdraw_date,
          ptc_time: item.ptc_time,
          standard_ptc: item.standard_ptc,
          sq_remark: item.sq_remark,
          md_remark: item.md_remark,
          defect_remark: item.defect_remark,
          qccheck: item.qccheck,
          mdcheck: item.mdcheck,
          defectcheck: item.defectcheck,
          machine_MD: item.machine_MD,
          sq_acceptance: item.sq_acceptance,
          defect_acceptance: item.defect_acceptance,
          rawMatType: item.rawMatType,
          mix_time: item.mix_time,
          mixed_date: item.mixed_date,
          mix_code: item.mix_code,
          prod_mix: item.prod_mix,
          weight_RM: item.weight_RM, // เพิ่มข้อมูลน้ำหนักวัตถุดิบ
          tray_count: item.tray_count, // เพิ่มข้อมูลจำนวนถาด
          name_edit_prod_two: item.name_edit_prod_two,
          name_edit_prod_three: item.name_edit_prod_three,
          first_prod: item.first_prod,
          two_prod: item.two_prod,
          three_prod: item.three_prod,
          remark_rework: item.remark_rework,
          remark_rework_cold: item.remark_rework_cold,
          edit_rework: item.edit_rework,
          receiver_qc_cold: item.receiver_qc_cold,
          approver: item.approver,
          qccheck_cold: item.qccheck_cold,
          prepare_mor_night: item.prepare_mor_night,
          batch_before: item.batch_before,
        });
      });
  return Array.from(trolleyMap.values())[0];
};

// The large cold room module (/coldStorages) reuses this flow with its own API prefix, delay calculation and dialog.
const CheckoutFlow = forwardRef(function CheckoutFlow(
  { onDone, apiBase = "/api/coldstorage", Modal = ModalEditPD, delayFn = calculateMaterialDelayTime },
  ref,
) {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async (row) => {
    try {
      const [regular, mixed] = await Promise.all([
        axios.get(`${API_URL}${apiBase}/export/fetchSlotRawMat`),
        // not every module has a mixed-material export list: treat a missing one as "no mixed materials"
        axios.get(`${API_URL}${apiBase}/mix/export/fetchSlotRawMat`).catch(() => ({ data: { success: false } })),
      ]);
      const regularList = (regular.data?.success ? regular.data.data : []).map((x) => ({ ...x, rawMatType: "regular" }));
      const mixedList = (mixed.data?.success ? mixed.data.data : []).map((x) => ({ ...x, rawMatType: "mixed" }));
      const items = [...regularList, ...mixedList].filter((x) => x.tro_id === row.tro_id);
      const trolley = items.length ? groupTrolley(items) : null;
      if (!trolley) { setMessage(`ไม่พบรถเข็น ${row.tro_id} ในรายการส่งออก (อาจถูกส่งออกไปแล้ว)`); return; }
      const materials = (trolley.materials || []).map((m) => {
        const { statusMessage, color } = delayFn(m);
        return { ...m, delayTime: statusMessage, delayTimeColor: color };
      });
      setData(buildEditData({ ...trolley, ptc_time: trolley.ptc_time, materials }));
      setOpen(true);
    } catch (err) {
      console.error("โหลดรายการส่งออกไม่สำเร็จ:", err);
      setMessage("โหลดข้อมูลส่งออกไม่สำเร็จ");
    }
  }, [apiBase, delayFn]);

  useImperativeHandle(ref, () => ({ open: load }), [load]);

  return (
    <>
      {data && <Modal open={open} onClose={() => setOpen(false)} onNext={() => setOpen(false)} data={data} onSuccess={() => { setOpen(false); onDone?.(); }} />}
      <Snackbar open={Boolean(message)} autoHideDuration={5000} onClose={() => setMessage("")} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="warning" onClose={() => setMessage("")}>{message}</Alert>
      </Snackbar>
    </>
  );
});

export default CheckoutFlow;
