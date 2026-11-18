// Dictionary: Thai source text -> [English, Burmese, Khmer]. "{x}" stands for any value the code puts in (see ../lookup.js).
// Production plans picked from the recipe database (WC): the tag in the plan lists, ensurePlan (Layout/ensurePlan.js) and POST /api/production/ensurePlan.
// English only for now: the Burmese / Khmer screens show the English text until someone adds the translations here.
export default {
  "ใหม่จากระบบสูตร": ["New from the formula system"],
  "สร้างแผนการผลิตไม่สำเร็จ": ["Could not create the production plan"],
  "กรุณาระบุ wc_code_id เป็นตัวเลข": ["Please give wc_code_id as a number"],
  "ไม่พบรหัสสินค้านี้ในระบบสูตร": ["Product code not found in the formula system"],
  "ไม่มีรหัสสินค้า": ["No product code"],
  "ไม่มีเลขที่เอกสาร": ["No document no."],
  "เลขที่เอกสารยาวเกิน {x} ตัวอักษร": ["Document no. is longer than {x} characters"],
  "รหัสสินค้ายาวเกิน {x} ตัวอักษร": ["Product code is longer than {x} characters"],
};
