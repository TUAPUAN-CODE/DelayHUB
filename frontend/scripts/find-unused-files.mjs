#!/usr/bin/env node
// ตรวจโค้ด frontend จาก main.jsx ตาม import จริง (รวม lazy(() => import("...")))
//   1) import ที่หาไฟล์ไม่เจอ              → build จะล้ม
//   2) import ที่ตัวพิมพ์เล็ก/ใหญ่ไม่ตรง   → ทำงานบน Windows แต่ build บน Linux ล้ม
//   3) ไฟล์ใน src/component ที่ไม่มีใครเรียกถึง (ไม่ถูกใช้ตอนรัน)
// ใช้:  node scripts/find-unused-files.mjs            รายงานอย่างเดียว
//       node scripts/find-unused-files.mjs --delete   ลบไฟล์ข้อ 3 (ใช้ git rm ถ้าไฟล์ถูกติดตามอยู่) — ทำหลังข้อ 1 ว่างแล้วเท่านั้น
// ข้อควรระวัง: ถ้ามีหน้าที่อยู่เฉพาะบนเครื่อง server (ยังไม่ถูก commit — ข้อ 1) หน้านั้นอาจ import ไฟล์ที่ดูเหมือนไม่ถูกใช้
//              จึงต้อง commit ให้รีโปครบก่อน แล้วค่อยรันและลบ
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(process.argv[1], "..", "..");
const SRC = path.join(ROOT, "src");
const ENTRY = path.join(SRC, "main.jsx");
const EXTS = ["", ".js", ".jsx", ".json", ".css", "/index.js", "/index.jsx"];
const IMPORT_RE = /(?:from\s+|import\s*\(\s*|import\s+|require\(\s*)["'](\.{1,2}\/[^"']+)["']/g;

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
};
const all = walk(SRC);
const byLower = new Map(all.map((p) => [p.toLowerCase(), p]));
const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };

const resolve = (fromDir, spec) => {
  const base = path.normalize(path.join(fromDir, spec.split("?")[0]));
  for (const e of EXTS) if (isFile(base + e)) return { file: base + e, caseFix: false };
  for (const e of EXTS) { const hit = byLower.get((base + e).toLowerCase()); if (hit && isFile(hit)) return { file: hit, caseFix: true }; }
  return null;
};

const graph = new Map();
const missing = new Map();
const caseFix = [];
for (const file of all.filter((p) => /\.(jsx?|mjs)$/.test(p))) {
  const text = fs.readFileSync(file, "utf8").split("\n").filter((l) => !l.trimStart().startsWith("//")).join("\n");
  const deps = [];
  for (const m of text.matchAll(IMPORT_RE)) {
    const r = resolve(path.dirname(file), m[1]);
    if (r) { deps.push(r.file); if (r.caseFix) caseFix.push({ file, spec: m[1], actual: r.file }); }
    else { const key = path.normalize(path.join(path.dirname(file), m[1])); (missing.get(key) || missing.set(key, []).get(key)).push(file); }
  }
  graph.set(file, deps);
}

const seen = new Set();
const stack = [ENTRY];
while (stack.length) { const x = stack.pop(); if (seen.has(x)) continue; seen.add(x); stack.push(...(graph.get(x) || [])); }

const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
console.log(`ไฟล์ที่ถูกใช้จริง (เข้าถึงจาก main.jsx): ${seen.size} / ไฟล์โค้ดทั้งหมด ${graph.size}\n`);

const bad = [...missing.entries()].map(([k, v]) => [k, v.filter((f) => seen.has(f))]).filter(([, v]) => v.length);
console.log(`1) import ที่หาไฟล์ไม่เจอ (ทำให้ build ล้ม): ${bad.length}`);
bad.forEach(([k, v]) => console.log(`   ${rel(k)}  ← ${rel(v[0])}`));
const cf = caseFix.filter((c) => seen.has(c.file));
console.log(`\n2) import ที่ตัวพิมพ์เล็ก/ใหญ่ไม่ตรงชื่อไฟล์จริง: ${cf.length}`);
cf.forEach((c) => console.log(`   ${rel(c.file)} import "${c.spec}" → จริงคือ ${rel(c.actual)}`));

const unused = [...graph.keys()].filter((p) => !seen.has(p) && rel(p).startsWith("src/component/")).sort();
console.log(`\n3) ไฟล์ใน src/component ที่ไม่มีใครเรียกถึง: ${unused.length}`);
const byDir = new Map();
unused.forEach((p) => { const d = rel(p).split("/").slice(2, 4).join("/"); byDir.set(d, (byDir.get(d) || 0) + 1); });
[...byDir.entries()].sort((a, b) => b[1] - a[1]).forEach(([d, n]) => console.log(`   ${String(n).padStart(3)}  ${d}`));

if (process.argv.includes("--delete")) {
  if (bad.length) { console.error("\nยังมี import ที่หาไฟล์ไม่เจอ (ข้อ 1) — แก้/commit ไฟล์ที่หายไปก่อนจึงจะลบได้"); process.exit(1); }
  for (const p of unused) {
    try { execFileSync("git", ["rm", "-q", "--", rel(p)], { cwd: path.resolve(ROOT, ".."), stdio: "pipe" }); }
    catch { fs.rmSync(p, { force: true }); }
  }
  console.log(`\nลบแล้ว ${unused.length} ไฟล์ (ตรวจด้วย git status แล้ว npm run build ก่อน commit)`);
} else if (unused.length) {
  console.log("\n(รายงานอย่างเดียว — เพิ่ม --delete เพื่อลบข้อ 3 หลังข้อ 1 ว่างแล้ว)");
}
