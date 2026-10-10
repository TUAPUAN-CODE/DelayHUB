#!/usr/bin/env node
// สร้าง "ร่าง" ตารางสิทธิ์ route ต่อ Role จากโค้ดจริง: ดูว่าหน้า (โฟลเดอร์) ของ Role ใดเรียก route ไหนของ backend
//   node scripts/derive-role-draft.js   →  เขียน backend/config/rolePolicy.draft.json  และพิมพ์สรุป
// ไม่ได้บังคับอะไร — เป็นจุดเริ่มต้นให้เจ้าของงานตรวจ แล้วเปลี่ยนชื่อเป็น rolePolicy.json (ทุกกฎตั้ง mode=warn ไว้ก่อน)
// ข้อจำกัด: วิเคราะห์จากข้อความในโค้ด (ไม่รันจริง) route ที่ถูกเรียกจากหน้ากลาง (Sheet/Layout/User) จะไม่ถูกจำกัด Role
//   ทางที่แม่นกว่าคือเรียนรู้จากการใช้งานจริง: GET /api/auth/policy-draft (admin) หลังเปิดใช้งานจริงสัก 1–2 สัปดาห์
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const ROUTES_DIR = path.join(ROOT, "backend", "routes");
const COMPONENT_DIR = path.join(ROOT, "frontend", "src", "component");
const OUT = path.join(ROOT, "backend", "config", "rolePolicy.draft.json");

const ROLE_OF_DIR = { Oven: [1], Prep: [2], QC: [3], Pack: [4], ColdStorage: [5], Supervisor: [6], ColdStorages: [7], Master: [8], Other: [9] };
// โฟลเดอร์ย่อยของหน้ากลาง Sheet ที่เป็นเครื่องมือเฉพาะ Role
const ROLE_OF_SHEET_SUB = { cold: [5, 7], pack: [4], prep: [2] };

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(jsx?|tsx?)$/.test(e.name)) out.push(p);
  }
  return out;
};

const rolesOfFile = (file) => {
  const rel = path.relative(COMPONENT_DIR, file).split(path.sep);
  if (rel[0] === "Sheet") return ROLE_OF_SHEET_SUB[rel[2]] || null; // Sheet/Asset/<sub>/...
  return ROLE_OF_DIR[rel[0]] || null; // null = หน้ากลาง (Layout, User, ...) ใช้ได้ทุก Role
};

// 1) route ของ backend
const backend = [];
for (const f of fs.readdirSync(ROUTES_DIR).filter((x) => x.endsWith(".js"))) {
  const text = fs.readFileSync(path.join(ROUTES_DIR, f), "utf8");
  for (const line of text.split("\n")) {
    if (/^\s*\/\//.test(line)) continue;
    const m = line.match(/router\.(get|post|put|delete|patch)\(\s*["'`]([^"'`]+)["'`]/);
    if (!m) continue;
    const p = m[2].startsWith("/api") ? m[2] : `/api${m[2]}`;
    backend.push({ method: m[1].toUpperCase(), path: p, file: f });
  }
}

// 2) ที่ที่ frontend เรียก API
const calls = [];
const urlRe = /(["'`])(?:[^"'`\\]|\\.)*?(\/api\/[A-Za-z0-9_\-/.${}:]+)/g;
for (const file of walk(COMPONENT_DIR)) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  const roles = rolesOfFile(file);
  lines.forEach((line, i) => {
    if (/^\s*\/\//.test(line)) return;
    let m;
    urlRe.lastIndex = 0;
    while ((m = urlRe.exec(line))) {
      const url = m[2].replace(/\$\{[^}]*\}/g, ":x").split("?")[0].replace(/\/+$/, "");
      let method = (line.match(/axios\.(get|post|put|delete|patch)\s*\(/) || line.match(/\.(get|post|put|delete|patch)\s*\(\s*[`"']/) || [])[1];
      if (!method && /fetch\s*\(/.test(line)) {
        const near = lines.slice(i, i + 5).join(" ");
        method = (near.match(/method:\s*["'`](GET|POST|PUT|DELETE|PATCH)["'`]/i) || [])[1] || "get";
      }
      calls.push({ method: method ? method.toUpperCase() : "*", url, roles, file: path.relative(COMPONENT_DIR, file) });
    }
  });
}

// 3) จับคู่
const toRe = (tpl) => new RegExp(`^${tpl.split("/").map((s) => (s.startsWith(":") ? "[^/]+" : s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))).join("/")}$`);
const callMatches = (call, route) => {
  if (call.method !== "*" && call.method !== route.method) return false;
  const re = toRe(route.path);
  if (re.test(call.url.replace(/:x/g, "x"))) return true;
  // url ที่ประกอบจากตัวแปรท้าย path (เช่น /api/coldstorage/${endpoint}) ไม่เดา
  return false;
};

const rules = [];
const sharedRoutes = [];
const noUiCaller = [];
for (const route of backend) {
  const hits = calls.filter((c) => callMatches(c, route));
  if (!hits.length) { noUiCaller.push(`${route.method} ${route.path}`); continue; }
  if (hits.some((h) => h.roles === null)) { sharedRoutes.push(`${route.method} ${route.path}`); continue; }
  const roles = [...new Set(hits.flatMap((h) => h.roles))].sort((a, b) => a - b);
  rules.push({ method: route.method, path: `^${route.path.split("/").map((s) => (s.startsWith(":") ? "[^/]+" : s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))).join("/")}$`, roles, mode: "warn", callers: [...new Set(hits.map((h) => h.file.split(path.sep).slice(0, 2).join("/")))] });
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({
  version: 1,
  note: "ร่างจากการวิเคราะห์โค้ด ไม่ได้บังคับ — ตรวจแล้วเปลี่ยนชื่อเป็น rolePolicy.json (ทุกกฎ mode=warn = log อย่างเดียว ลบ mode เมื่อมั่นใจ); ผู้ดูแล Role 6/8 ผ่านทุกกฎอยู่แล้ว",
  generated_at: new Date().toISOString(),
  rules,
}, null, 2));

const byRole = {};
rules.forEach((r) => r.roles.forEach((x) => { byRole[x] = (byRole[x] || 0) + 1; }));
console.log(`backend routes: ${backend.length}`);
console.log(`  กำหนด Role ได้จากโค้ด (เรียกจากหน้าของ Role เฉพาะ): ${rules.length}`);
console.log(`  ถูกเรียกจากหน้ากลาง (Sheet/Layout/User) → ไม่จำกัด Role: ${sharedRoutes.length}`);
console.log(`  ไม่พบการเรียกจากหน้าเว็บ (ใช้โดย RFID/worker/ประวัติเก่า หรือ URL ประกอบด้วยตัวแปร): ${noUiCaller.length}`);
console.log("  จำนวนกฎที่อนุญาตแต่ละ Role:", JSON.stringify(byRole));
console.log(`เขียนไฟล์: ${path.relative(ROOT, OUT)}`);
