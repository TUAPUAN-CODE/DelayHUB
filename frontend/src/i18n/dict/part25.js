// Dictionary: Thai source text -> [English, Burmese, Khmer]. "{x}" stands for any value the code puts in (see ../lookup.js).
// Ingredient page /sup/Ingredient (Supervisor/Ingredient) and its API /api/ingredient (backend/routes/IngredientRoutes.js): ingredients from the WC recipes + the alias / remark kept in PFCMv2.
// English only for now: the Burmese / Khmer screens show the English text until someone adds the translations here.
export default {
  // sidebar
  "ส่วนผสม (Ingredient)": ["Ingredients"],

  // list
  "ค้นหารหัส / ชื่อ / ชื่อเรียกส่วนผสม": ["Search code / name / alias"],
  "โหลดรายการส่วนผสมไม่สำเร็จ": ["Could not load the ingredients"],
  "ไม่พบส่วนผสม": ["No ingredient found"],
  "ใช้ใน {x} สินค้า": ["Used in {x} products"],

  // detail: header + alias / remark form
  "เลือกส่วนผสมทางซ้ายเพื่อดูรายละเอียด": ["Pick an ingredient on the left to see the details"],
  "โหลดข้อมูลส่วนผสมไม่สำเร็จ": ["Could not load the ingredient"],
  "ชื่อเรียก": ["Alias"],
  "ชื่อที่หน้างานเรียก": ["The name used on the floor"],
  "เช่น ข้อควรระวัง วิธีเก็บ ผู้ขายที่ใช้": ["e.g. precautions, storage, supplier used"],
  "แก้ไขล่าสุด {x}": ["Last edited {x}"],
  "ยังไม่ได้สร้างตารางเก็บชื่อเรียก/หมายเหตุ (IngredientNote) — ให้ DBA รัน backend/migrations/create_IngredientNote.sql ก่อน จึงจะบันทึกได้": [
    "The table for aliases / remarks (IngredientNote) has not been created yet — ask the DBA to run backend/migrations/create_IngredientNote.sql before saving",
  ],

  // products tab
  "ใช้ในสินค้า": ["Used in products"],
  "ลูกค้า / ตลาด": ["Customer / market"],
  "ประเภทการผสม": ["Mix type"],
  "Std (กก.)": ["Std (kg)"],
  "ไม่มีสินค้าที่ใช้ส่วนผสมนี้": ["No product uses this ingredient"],

  // usage tab
  "การใช้งานจริง": ["Actual usage"],
  "ช่วงวันที่ผสม": ["Mixing date range"],
  "ชั่งทั้งหมด (ครั้ง)": ["Weighings"],
  "นอกช่วง Min / Max": ["Outside Min / Max"],
  "แสดง {x} รายการล่าสุด — เลือกช่วงวันที่ให้แคบลงเพื่อดูรายการอื่น": ["Showing the latest {x} rows — narrow the date range to see others"],
  "ชั่งจริง": ["Weighed"],
  "ไม่มีการชั่งส่วนผสมนี้ในช่วงนี้": ["This ingredient was not weighed in this period"],

  // messages from the API
  "เลือกช่วงวันที่ได้ไม่เกิน {x} วัน": ["You can pick at most {x} days"],
  "กรุณาระบุรหัสส่วนผสม": ["Please give the ingredient code"],
  "ไม่พบส่วนผสมนี้": ["Ingredient not found"],
};
