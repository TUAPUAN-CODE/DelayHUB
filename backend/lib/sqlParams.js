// ตัวช่วยทำ IN (...) แบบ parameterized — ห้ามต่อค่าจาก request เข้า SQL ตรงๆ (CLAUDE.md ข้อ 2 / หัวข้อ 6)
//   const ph = placeholders("rm_type_", ids);              // "@rm_type_0,@rm_type_1"  (ใส่ใน SQL ได้ เพราะเป็นแค่ชื่อพารามิเตอร์)
//   bindList(pool.request(), "rm_type_", ids, sql.VarChar)  // ผูกค่าจริงเข้ากับ @rm_type_0 ...  คืน request ให้ต่อ .query(...) ได้
// รายการว่างได้ "NULL" (IN (NULL) ไม่เจอแถวใด) แทนการสร้าง SQL ที่ผิดไวยากรณ์
const MAX_ITEMS = 2000; // SQL Server จำกัด 2100 พารามิเตอร์ต่อคำสั่ง

const asArray = (values) => (Array.isArray(values) ? values : values === undefined || values === null ? [] : [values]);

const placeholders = (prefix, values) => {
  const list = asArray(values);
  if (list.length > MAX_ITEMS) throw new Error(`รายการมากเกินไป (${list.length} > ${MAX_ITEMS})`);
  return list.length ? list.map((_, i) => `@${prefix}${i}`).join(",") : "NULL";
};

const bindList = (request, prefix, values, type) => {
  asArray(values).forEach((value, i) => (type ? request.input(`${prefix}${i}`, type, value) : request.input(`${prefix}${i}`, value)));
  return request;
};

/** จำนวนเต็มบวกเท่านั้น (id) — ค่าที่ไม่ใช่ตัวเลขทำให้ throw แทนที่จะถูกส่งเข้า SQL */
const toIntList = (values, label = "id") =>
  asArray(values).map((v) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0) throw new Error(`${label} ไม่ถูกต้อง: ${String(v).slice(0, 30)}`);
    return n;
  });

/** ตัวเลข (ทศนิยมได้) เท่านั้น — ใช้กับค่าที่ต้องต่อเป็น literal เช่น VALUES (...) */
const toNumber = (value, label = "number") => {
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n) || String(value).trim() === "") throw new Error(`${label} ไม่ถูกต้อง: ${String(value).slice(0, 30)}`);
  return n;
};

module.exports = { placeholders, bindList, toIntList, toNumber };
