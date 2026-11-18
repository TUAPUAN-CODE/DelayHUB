// Dictionary: Thai source text -> [English, Burmese, Khmer]. "{x}" stands for any value the code puts in (see ../lookup.js).
// Production plans picked from the recipe database (WC): the tag in the plan lists, ensurePlan (Layout/ensurePlan.js) and POST /api/production/ensurePlan.
// English only for now: the Burmese / Khmer screens show the English text until someone adds the translations here.
export default {
  "ใหม่จากระบบสูตร": ["New from the formula system"],
  "สร้างแผนการผลิตไม่สำเร็จ": ["Could not create the production plan"],
  "กรุณาระบุ wc_code_id เป็นตัวเลข": ["Please give wc_code_id as a number"],
  "ไม่พบรหัสสินค้านี้ในระบบสูตร": ["Product code not found in the formula system"],
  "{x} รายการ (แสดง {x} แรก)": ["{x1} items (showing the first {x2})"], // the list of the WO page (/sup/WorkOrder) shows at most 100
  "สร้างแผนการผลิตใหม่": ["Create a new production plan"],
  "แผนนี้มาจากระบบสูตรและยังไม่มีใน PFCM เลือกประเภทไลน์ก่อนบันทึก": ["This plan comes from the formula system and is not in PFCM yet. Pick the line type before saving."],
  "แนะนำจากบรรจุภัณฑ์": ["Suggested from the package"],
  "บันทึกแผนการผลิต": ["Save the production plan"],
  "ประเภทไลน์ไม่ถูกต้อง": ["Invalid line type"],
  "ไม่มีรหัสสินค้า": ["No product code"],
  "ไม่มีเลขที่เอกสาร": ["No document no."],
  "เลขที่เอกสารยาวเกิน {x} ตัวอักษร": ["Document no. is longer than {x} characters"],
  "รหัสสินค้ายาวเกิน {x} ตัวอักษร": ["Product code is longer than {x} characters"],
};
