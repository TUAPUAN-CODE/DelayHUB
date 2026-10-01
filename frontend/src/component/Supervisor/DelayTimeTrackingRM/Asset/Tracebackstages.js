// ─────────────────────────────────────────────────────────────────────────────
// tracebackStages.js
// แปลงคอลัมน์วันเวลาทั้งหมดใน [PFCMv2].[dbo].[History] ให้เป็น timeline + ช่วงดีเลย์
// ใช้ในแท็บ Detailed Protocol
// ─────────────────────────────────────────────────────────────────────────────
import { parseDate, diffMinutes, delayLevel } from './tracebackUI';

// group: ลำดับของกระบวนการ ใช้จัดสีและจัดกลุ่มใน timeline
export const STAGE_GROUPS = {
  receive: { label: 'รับเข้า/เตรียม', color: '#2563EB' },
  defrost: { label: 'ละลาย (Defrost)', color: '#0891B2' },
  mix: { label: 'ผสม/ปรุง', color: '#7C3AED' },
  cook: { label: 'ต้ม/อบ', color: '#EA580C' },
  cold: { label: 'ห้องเย็น', color: '#0EA5E9' },
  qc: { label: 'QC', color: '#16A34A' },
  withdraw: { label: 'เบิก/ส่งออก', color: '#D97706' },
  pack: { label: 'บรรจุ', color: '#DB2777' },
  rework: { label: 'Rework', color: '#DC2626' },
};

// key ต้องตรงกับชื่อคอลัมน์ที่ backend ส่งมา (CONVERT VARCHAR 120)
export const STAGE_DEFS = [
  { key: 'rmit_date', label: 'รับวัตถุดิบเข้าเตรียม', group: 'receive', receiverKey: 'receiver' },
  { key: 'rmit_date_mix', label: 'รับเข้าห้องผสม', group: 'receive' },

  { key: 'start_defrost_date', label: 'เริ่มละลาย ครั้งที่ 1', group: 'defrost' },
  { key: 'end_defrost_date', label: 'ละลายเสร็จ ครั้งที่ 1', group: 'defrost' },
  { key: 'start_defrost_date_two', label: 'เริ่มละลาย ครั้งที่ 2', group: 'defrost' },
  { key: 'end_defrost_date_two', label: 'ละลายเสร็จ ครั้งที่ 2', group: 'defrost' },
  { key: 'start_defrost_date_three', label: 'เริ่มละลาย ครั้งที่ 3', group: 'defrost' },
  { key: 'end_defrost_date_three', label: 'ละลายเสร็จ ครั้งที่ 3', group: 'defrost' },
  { key: 'start_defrost_date_four', label: 'เริ่มละลาย ครั้งที่ 4', group: 'defrost' },
  { key: 'end_defrost_date_four', label: 'ละลายเสร็จ ครั้งที่ 4', group: 'defrost' },
  { key: 'cs_come_after_df_date', label: 'เข้าห้องเย็นหลังละลาย', group: 'defrost' },

  { key: 'start_mixed_date', label: 'เริ่มผสม', group: 'mix' },
  { key: 'mixed_date', label: 'ผสมเสร็จ', group: 'mix' },
  { key: 'mix_date', label: 'วันที่ผสม (บันทึก)', group: 'mix' },
  { key: 'start_gravy_date', label: 'เริ่มทำน้ำเกรวี่', group: 'mix' },
  { key: 'gm_date', label: 'GM', group: 'mix' },

  { key: 'cooked_date', label: 'ต้ม/อบเสร็จ', group: 'cook' },

  { key: 'come_cold_date', label: 'เข้าห้องเย็น ครั้งที่ 1', group: 'cold' },
  { key: 'out_cold_date', label: 'ออกห้องเย็น ครั้งที่ 1', group: 'cold', receiverKey: 'receiver_out_cold' },
  { key: 'come_cold_date_two', label: 'เข้าห้องเย็น ครั้งที่ 2', group: 'cold' },
  { key: 'out_cold_date_two', label: 'ออกห้องเย็น ครั้งที่ 2', group: 'cold', receiverKey: 'receiver_out_cold_two' },
  { key: 'come_cold_date_three', label: 'เข้าห้องเย็น ครั้งที่ 3', group: 'cold' },
  { key: 'out_cold_date_three', label: 'ออกห้องเย็น ครั้งที่ 3', group: 'cold', receiverKey: 'receiver_out_cold_three' },

  { key: 'qc_date', label: 'QC ตรวจสอบ', group: 'qc', receiverKey: 'receiver_qc' },

  { key: 'withdraw_date', label: 'เบิกออก ครั้งที่ 1', group: 'withdraw' },
  { key: 'withdraw_date_two', label: 'เบิกออก ครั้งที่ 2', group: 'withdraw' },
  { key: 'withdraw_date_three', label: 'เบิกออก ครั้งที่ 3', group: 'withdraw' },
  { key: 'withdraw_date_four', label: 'เบิกออก ครั้งที่ 4', group: 'withdraw' },
  { key: 'summary_withdraw_date', label: 'สรุปการเบิก', group: 'withdraw' },

  { key: 'pack_checkin_date', label: 'เช็คอินห้องบรรจุ', group: 'pack' },
  { key: 'sc_pack_date', label: 'บรรจุเสร็จ', group: 'pack', receiverKey: 'receiver_pack_edit' },

  { key: 'rework_date', label: 'Rework', group: 'rework' },
];

// คู่ เข้า/ออก ห้องเย็น ทุกชุด (ปกติ / RFID / cold storage cs_)
export const COLD_PAIRS = [
  { label: 'ห้องเย็น รอบ 1', inKey: 'come_cold_date', outKey: 'out_cold_date', src: 'manual' },
  { label: 'ห้องเย็น รอบ 2', inKey: 'come_cold_date_two', outKey: 'out_cold_date_two', src: 'manual' },
  { label: 'ห้องเย็น รอบ 3', inKey: 'come_cold_date_three', outKey: 'out_cold_date_three', src: 'manual' },
  { label: 'ห้องเย็น รอบ 1 (RFID)', inKey: 'come_cold_date_RFID', outKey: 'out_cold_date_RFID', src: 'RFID' },
  { label: 'ห้องเย็น รอบ 2 (RFID)', inKey: 'come_cold_date_two_rfid', outKey: 'out_cold_date_two_rfid', src: 'RFID' },
  { label: 'ห้องเย็น รอบ 3 (RFID)', inKey: 'com_cold_date_three_rfid', outKey: 'out_cold_date_three_rfid', src: 'RFID' },
  { label: 'Cold Storage รอบ 1', inKey: 'cs_come_cold_date', outKey: 'cs_out_cold_date', src: 'CS' },
  { label: 'Cold Storage รอบ 2', inKey: 'cs_come_cold_date_two', outKey: 'cs_out_cold_date_two', src: 'CS' },
  { label: 'Cold Storage รอบ 3', inKey: 'cs_come_cold_date_three', outKey: 'cs_out_cold_date_three', src: 'CS' },
  { label: 'Cold Storage รอบ 4', inKey: 'cs_come_cold_date_four', outKey: 'cs_out_cold_date_four', src: 'CS' },
  { label: 'Cold Storage รอบ 5', inKey: 'cs_come_cold_date_five', outKey: 'cs_out_out_date_five', src: 'CS' },
  { label: 'Cold Storage รอบ 6', inKey: 'cs_come_cold_date_six', outKey: 'cs_out_cold_date_six', src: 'CS' },
  { label: 'Cold Storage รอบ 7', inKey: 'cs_come_cold_date_seven', outKey: 'cs_out_cold_date_seven', src: 'CS' },
  { label: 'Cold Storage รอบ 8', inKey: 'cs_come_cold_date_eight', outKey: 'cs_out_cold_date_eight', src: 'CS' },
  { label: 'Cold Storage รอบ 9', inKey: 'cs_come_cold_date_nine', outKey: 'cs_out_cold_date_nine', src: 'CS' },
  { label: 'Cold Storage รอบ 10', inKey: 'cs_come_cold_date_ten', outKey: 'cs_out_cold_date_ten', src: 'CS' },
];

// คู่เข้า/ออก สายการผลิต (PD) และเข้า cold direct (CD)
export const PD_PAIRS = [
  { label: 'เข้า–ออก ผลิต รอบ 1', inKey: 'input_pd_date', outKey: 'output_pd_date' },
  { label: 'เข้า–ออก ผลิต รอบ 2', inKey: 'input_pd_date_two', outKey: 'output_pd_date_two' },
  { label: 'เข้า–ออก ผลิต รอบ 3', inKey: 'input_pd_date_three', outKey: 'output_pd_date_three' },
];

export const DEFROST_PAIRS = [
  { label: 'ละลาย รอบ 1', inKey: 'start_defrost_date', outKey: 'end_defrost_date' },
  { label: 'ละลาย รอบ 2', inKey: 'start_defrost_date_two', outKey: 'end_defrost_date_two' },
  { label: 'ละลาย รอบ 3', inKey: 'start_defrost_date_three', outKey: 'end_defrost_date_three' },
  { label: 'ละลาย รอบ 4', inKey: 'start_defrost_date_four', outKey: 'end_defrost_date_four' },
];

// ค่า QC / พารามิเตอร์กระบวนการ ที่อยากโชว์ในหน้า detail
export const PARAM_FIELDS = [
  { key: 'weight_RM', label: 'น้ำหนักวัตถุดิบ', unit: 'kg', num: true },
  { key: 'weight', label: 'น้ำหนัก (ชั่งซ้ำ)', unit: 'kg', num: true },
  { key: 'tray_count', label: 'จำนวนถาด', num: true },
  { key: 'Temp', label: 'อุณหภูมิ', unit: '°C', num: true },
  { key: 'temps', label: 'อุณหภูมิ (ชุดที่ 2)', unit: '°C', num: true },
  { key: 'Moisture', label: 'ความชื้น', unit: '%', num: true },
  { key: 'percent_fine', label: '% Fine', unit: '%', num: true },
  { key: 'viscosity', label: 'ความหนืด', num: true },
  { key: 'weight_per_cup', label: 'น้ำหนักต่อถ้วย', unit: 'g', num: true },
  { key: 'histamine', label: 'Histamine', num: true },
  { key: 'histamine_2', label: 'Histamine (2)', num: true },
  { key: 'histamine_3', label: 'Histamine (3)', num: true },
  { key: 'md_time', label: 'MD Time' },
  { key: 'mix_time', label: 'เวลาผสม (ระบบ)' },
  { key: 'rework_time', label: 'เวลา Rework (ระบบ)' },
  { key: 'cold_to_pack_time', label: 'ห้องเย็น → บรรจุ (ระบบ)' },
  { key: 'prep_to_pack_time', label: 'เตรียม → บรรจุ (ระบบ)' },
];

export const INFO_FIELDS = [
  { key: 'rmm_line_name', label: 'ไลน์ผลิต' },
  { key: 'location', label: 'สถานที่' },
  { key: 'stay_place', label: 'จุดพัก' },
  { key: 'dest', label: 'ปลายทาง' },
  { key: 'cold_dest', label: 'ปลายทางห้องเย็น' },
  { key: 'rm_status', label: 'สถานะวัตถุดิบ' },
  { key: 'prepare_mor_night', label: 'กะเตรียม' },
  { key: 'storage_purpose', label: 'วัตถุประสงค์จัดเก็บ' },
  { key: 'storage_purpose_2', label: 'วัตถุประสงค์จัดเก็บ (2)' },
  { key: 'storage_purpose_3', label: 'วัตถุประสงค์จัดเก็บ (3)' },
  { key: 'at_pd_storage_purpose', label: 'จัดเก็บที่ผลิต' },
  { key: 'hu', label: 'HU' },
  { key: 'tro_id', label: 'รถเข็น (TRO)' },
  { key: 'qccheck_cold', label: 'QC ตรวจห้องเย็น' },
  { key: 'first_prod', label: 'ผลิตครั้งที่ 1' },
  { key: 'two_prod', label: 'ผลิตครั้งที่ 2' },
  { key: 'three_prod', label: 'ผลิตครั้งที่ 3' },
];

export const PEOPLE_FIELDS = [
  { key: 'receiver', label: 'ผู้รับเข้าเตรียม' },
  { key: 'receiver_prep_two', label: 'ผู้รับเข้าเตรียม (2)' },
  { key: 'receiver_qc', label: 'ผู้ตรวจ QC' },
  { key: 'receiver_qc_cold', label: 'ผู้ตรวจ QC ห้องเย็น' },
  { key: 'receiver_out_cold', label: 'ผู้เบิกออกห้องเย็น 1' },
  { key: 'receiver_out_cold_two', label: 'ผู้เบิกออกห้องเย็น 2' },
  { key: 'receiver_out_cold_three', label: 'ผู้เบิกออกห้องเย็น 3' },
  { key: 'receiver_oven_edit', label: 'ผู้แก้ไขข้อมูลเตาอบ' },
  { key: 'receiver_pack_edit', label: 'ผู้แก้ไขข้อมูลบรรจุ' },
  { key: 'name_edit_prod_two', label: 'ผู้แก้ไขผลิตครั้งที่ 2' },
  { key: 'name_edit_prod_three', label: 'ผู้แก้ไขผลิตครั้งที่ 3' },
];

export const REMARK_FIELDS = [
  { key: 'remark', label: 'หมายเหตุ' },
  { key: 'remark_dalay', label: 'หมายเหตุกรณีดีเลย์' },
  { key: 'remark_pack_edit', label: 'หมายเหตุการแก้ไขบรรจุ' },
  { key: 'remark_rework', label: 'หมายเหตุ Rework' },
  { key: 'remark_rework_cold', label: 'หมายเหตุ Rework ห้องเย็น' },
  { key: 'at_pd_cold_remark', label: 'หมายเหตุห้องเย็นที่ผลิต' },
  { key: 'at_pd_cold_remark_2', label: 'หมายเหตุห้องเย็นที่ผลิต (2)' },
  { key: 'at_pd_cold_remark_3', label: 'หมายเหตุห้องเย็นที่ผลิต (3)' },
];

/** ดึงเฉพาะ stage ที่มีค่า แล้วเรียงตามเวลาจริง */
export function buildTimeline(h) {
  if (!h) return [];
  return STAGE_DEFS
    .map(s => ({ ...s, value: h[s.key], date: parseDate(h[s.key]), by: s.receiverKey ? h[s.receiverKey] : null }))
    .filter(s => s.date)
    .sort((a, b) => a.date - b.date);
}

/** ช่วงห่างระหว่าง stage ที่ติดกัน = ช่วงดีเลย์ */
export function buildGaps(timeline) {
  const gaps = [];
  for (let i = 1; i < timeline.length; i++) {
    const from = timeline[i - 1], to = timeline[i];
    const mins = diffMinutes(from.value, to.value);
    gaps.push({
      from: from.label, fromValue: from.value,
      to: to.label, toValue: to.value,
      minutes: mins, level: delayLevel(mins),
      group: to.group,
    });
  }
  return gaps;
}

/** ช่วงที่มีความหมายเชิงคุณภาพ (pair) เช่น เวลาอยู่ในห้องเย็น / เวลาละลาย */
export function buildPairs(h, defs) {
  if (!h) return [];
  return defs
    .map(p => {
      const inV = h[p.inKey], outV = h[p.outKey];
      if (!inV && !outV) return null;
      const mins = diffMinutes(inV, outV);
      return { ...p, inValue: inV, outValue: outV, minutes: mins, level: delayLevel(mins) };
    })
    .filter(Boolean);
}

/** ดีเลย์รวม = เวลาตั้งแต่ stage แรกถึง stage สุดท้าย */
export function totalLeadMinutes(timeline) {
  if (timeline.length < 2) return null;
  return diffMinutes(timeline[0].value, timeline[timeline.length - 1].value);
}

/** ช่วงที่ดีเลย์นานที่สุด */
export function worstGap(gaps) {
  if (!gaps.length) return null;
  return gaps.reduce((a, b) => ((b.minutes ?? -1) > (a.minutes ?? -1) ? b : a));
}