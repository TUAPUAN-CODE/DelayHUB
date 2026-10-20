// ปรับฐานข้อมูลทันที (งานเดียวกับที่ backend ทำเองหลังเปิด — lib/dbTuning.js)
//   cd backend && node scripts/db-tune.js             ทำจริง แล้วสรุปผล
//   node scripts/db-tune.js --dry-run                  แสดงคำสั่ง SQL ที่จะทำ ไม่เปลี่ยนอะไร (คัดลอกไปรันใน SSMS เองได้)
const { runTuning } = require("../lib/dbTuning");

const dryRun = process.argv.includes("--dry-run");
(async () => {
  const r = await runTuning({ dryRun, print: (line) => console.log(line) });
  console.log("\n== สรุป ==");
  console.log(`สคริปต์ auto: ${r.sqlFiles.map((f) => `${f.file} ${f.ok}/${f.batches}`).join(", ") || "-"}`);
  console.log(`ดัชนีที่ขาด${dryRun ? " (จะสร้าง)" : " (สร้างแล้ว)"}: ${r.indexes.length}`);
  console.log(`อัปเดตสถิติ: ${r.stats.length}`);
  console.log(`MAXDOP: ${r.maxdop ? `${r.maxdop.from} → ${r.maxdop.to}` : "ไม่เปลี่ยน"}`);
  if (r.errors.length) { console.log(`ผิดพลาด ${r.errors.length}:`); r.errors.forEach((e) => console.log("  ", JSON.stringify(e))); }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
