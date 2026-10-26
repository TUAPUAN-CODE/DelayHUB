// รัน: npm test — กติกาการหาคำแปลของ src/i18n/lookup.js (ตัวเดียวกับที่หน้าเว็บและ npm run check:i18n ใช้)
import test from "node:test";
import assert from "node:assert/strict";
import { createLookup } from "../src/i18n/lookup.js";

const dict = {
  "ยกเลิก": ["Cancel", "ပယ်ဖျက်မည်", "បោះបង់"],
  "ห้องเย็น": ["Cold room", "ခဲသိုက်ခန်း", "បន្ទប់ត្រជាក់"],
  "ไม่มีข้อมูลจาก Modal{n}": ["No data from Modal{n}"],
  "รถเข็น {x} อยู่ที่ {x}": ["Trolley {x} is at {x}", "လက်တွန်းလှည်း {x} သည် {x} တွင်ရှိသည်", "រទេះរុញ {x} នៅ {x}"],
  "{x} ช่อง {x}": ["{x} slot {x}"],
  "ป้ายนี้รับเข้าเมื่อ {x} โดย {x}": ["Received by {x2} at {x1}"],
  "แผนการผลิต": ["Production plan"],
  "เกิดข้อผิดพลาด": ["Error", "အမှား", "កំហុស"],
  "รอบรรจุเสร็จ": ["Waiting to finish packing"],
  "{x} คัน": ["{x} trolleys"],
  "สถานะ": ["Status"],
  "{x}": ["should never be used"],
};
const missing = [];
const lookup = createLookup(dict, { onPieceMissing: (p) => missing.push(p) });

test("exact text, and Burmese / Khmer fall back to English when they have no text", () => {
  assert.equal(lookup("ยกเลิก", 0), "Cancel");
  assert.equal(lookup("ยกเลิก", 2), "បោះបង់");
  assert.equal(lookup("แผนการผลิต", 1), "Production plan");
  assert.equal(lookup("ไม่รู้จัก", 0), null);
});

test("{n} = a number", () => {
  assert.equal(lookup("ไม่มีข้อมูลจาก Modal3", 0), "No data from Modal3");
});

test("{x} = a value put in by the code; a Thai value the dictionary knows is translated too", () => {
  assert.equal(lookup("รถเข็น 0755 อยู่ที่ ห้องเย็น", 0), "Trolley 0755 is at Cold room");
  assert.equal(lookup("รถเข็น 0755 อยู่ที่ ห้องเย็น", 2), "រទេះរុញ 0755 នៅ បន្ទប់ត្រជាក់");
  assert.equal(lookup("CSR 3 ช่อง A-12", 0), "CSR 3 slot A-12");
  // {x1} {x2}: the values in another order than in Thai
  assert.equal(lookup("ป้ายนี้รับเข้าเมื่อ 24/10 07:36 โดย สุธา", 0), "Received by สุธา at 24/10 07:36");
  // a key that is only "{x}" (no Thai) is never used
  assert.equal(lookup("อะไรก็ได้", 0), null);
});

test("a {x} key whose Thai value is unknown is the last try: the label / pieces rules go first", () => {
  // "{x} คัน" alone would give "สถานะ: รอ 5 trolleys"
  assert.equal(lookup("สถานะ: รอ 5 คัน", 0), "Status: รอ 5 trolleys");
  assert.equal(lookup("ห้องเย็น 12 คัน", 0), "ห้องเย็น 12 trolleys");
});

test('"label:" and "label: value" put together by the code; a time (07:36) is not cut at its colon', () => {
  assert.equal(lookup("แผนการผลิต:", 0), "Production plan:");
  assert.equal(lookup("เกิดข้อผิดพลาด: Network Error", 0), "Error: Network Error");
  assert.equal(lookup("เกิดข้อผิดพลาด: ห้องเย็น", 0), "Error: Cold room");
  assert.equal(lookup("เวลา 07:36", 0), null);
});

test('"text (12)": a count put after a known text', () => {
  assert.equal(lookup("ห้องเย็น (3)", 0), "Cold room (3)");
  assert.equal(lookup("ห้องเย็น (3)", 1), "ခဲသိုက်ခန်း (3)");
  assert.equal(lookup("ไม่รู้จัก (3)", 0), null);
});

test('pieces joined with " · ": each piece on its own, the unknown ones are reported', () => {
  missing.length = 0;
  assert.equal(lookup("รอบรรจุเสร็จ · รถเข็นเปล่า", 0), "Waiting to finish packing · รถเข็นเปล่า");
  assert.deepEqual(missing, ["รถเข็นเปล่า"]);
  assert.equal(lookup("ไม่รู้ · ไม่รู้จัก", 0), null);
});
