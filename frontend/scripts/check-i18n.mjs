#!/usr/bin/env node
/* eslint-env node */
// ตรวจว่าข้อความภาษาไทยในโค้ด (ที่หน้าเว็บใช้จริง เริ่มจาก main.jsx) มีคำแปลใน src/i18n/dict ครบหรือยัง — ใช้กติกาเดียวกับหน้าเว็บ (src/i18n/lookup.js)
//   ข้อความที่ตรวจ: ข้อความใน JSX · attribute ที่แสดงบนจอ (placeholder, title, label ...) · string ในโค้ด (ข้อความแจ้งเตือน, ชื่อคอลัมน์ ...)
//   · template `...${x}...` และ "..." + x  → คีย์ใน dict ใช้ {x} แทนค่าที่โค้ดใส่ (ดู src/i18n/lookup.js)
//   ไม่ตรวจ: string ที่ใช้เทียบค่า (=== / includes / case) · คีย์ของ object · console.* · ไฟล์ที่สร้าง PDF / Excel (*Pdf.js, *Excel.js, *Export.js — ไม่ขึ้นบนจอ ตัวแปลภาษาของหน้าเว็บไม่เห็น)
//   backend (../backend): ข้อความที่ส่งกลับไปขึ้นบนจอ — res.json({ error / message ... }), new Error(...), ค่าที่ SQL เขียนลงฐานข้อมูล (N'สถานะ')
// ใช้:  npm run check:i18n                 สรุปต่อหน้า (route) + ส่วนกลาง
//       npm run check:i18n -- --files      แสดงข้อความที่ขาดทุกไฟล์
//       npm run check:i18n -- --json out.json   เขียนผลทั้งหมดเป็น JSON (ข้อความที่ขาด + ไฟล์ที่ใช้)
// ข้อความที่มีแต่ภาษาอังกฤษ (ยังไม่มีพม่า/เขมร) นับแยก — หน้าเว็บแสดงภาษาอังกฤษแทนให้
// ข้อความที่ไม่ต้องแปล (ชื่อไฟล์, ค่าที่ใช้เทียบในโค้ด ...) ใส่ใน scripts/i18n-ignore.json
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createLookup, TH_RE } from "../src/i18n/lookup.js";

const ROOT = path.resolve(process.argv[1], "..", "..");
const SRC = path.join(ROOT, "src");
const require = createRequire(path.join(ROOT, "package.json"));
let parse, traverse;
try {
  ({ parse } = require("@babel/parser"));
  traverse = require("@babel/traverse").default;
} catch {
  console.error("ต้องมี @babel/parser และ @babel/traverse (มากับ @vitejs/plugin-react) — รัน npm install ก่อน");
  process.exit(1);
}
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] ?? true : null; };
const PARSE = { sourceType: "module", plugins: ["jsx", "classProperties", "optionalChaining", "nullishCoalescingOperator", "dynamicImport", "objectRestSpread"], errorRecovery: true };
const EXTS = ["", ".js", ".jsx", "/index.js", "/index.jsx"];
const rel = (p) => path.relative(SRC, p).split(path.sep).join("/");

// ── dictionary + the lookup of the web page ──
const DICT_DIR = path.join(SRC, "i18n", "dict");
const dictionary = {};
for (const f of fs.readdirSync(DICT_DIR).filter((x) => /^part\d+\.js$/.test(x)).sort()) Object.assign(dictionary, (await import(path.join(DICT_DIR, f))).default);
const lookup = createLookup(dictionary);
// the same lookup with only the Burmese / only the Khmer texts (no English to fall back on): null = that language is missing
const only = (col) => createLookup(Object.fromEntries(Object.entries(dictionary).map(([k, v]) => [k, [v[col] ?? null]])));
const lookupMy = only(1);
const lookupKm = only(2);
// covered = the text as the screen shows it is translated, with no Thai left (a text in pieces "a · b" can be translated only in part);
// a {x} shape is tried with a value that is a code and with a number
const done = (out) => out !== null && !TH_RE.test(out);
const status = (key) => {
  const samples = key.includes("{x}") ? [key.replace(/\{x\}/g, "X9"), key.replace(/\{x\}/g, "1")] : [key];
  for (const s of samples) {
    if (done(lookup(s, 0))) return done(lookupMy(s, 0)) && done(lookupKm(s, 0)) ? "ok" : "en-only";
  }
  return "missing";
};
let ignored = new Set();
try { ignored = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", "i18n-ignore.json"), "utf8"))); } catch { /* no list */ }

// ── files the app really uses: imports that are referenced, lazy import(), re-exports ──
const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
const resolveSpec = (fromDir, spec) => {
  const base = path.normalize(path.join(fromDir, spec.split("?")[0]));
  for (const e of EXTS) if (isFile(base + e)) return base + e;
  return null;
};
const asts = new Map();
const astOf = (file) => {
  if (!asts.has(file)) {
    let ast = null;
    try { ast = parse(fs.readFileSync(file, "utf8"), PARSE); } catch (e) { console.error(`parse error ${rel(file)}: ${e.message}`); }
    asts.set(file, ast);
  }
  return asts.get(file);
};
const deps = new Map();
const depsOf = (file) => {
  if (deps.has(file)) return deps.get(file);
  const out = [];
  deps.set(file, out);
  const ast = /\.jsx?$/.test(file) ? astOf(file) : null;
  if (!ast) return out;
  const dir = path.dirname(file);
  const add = (spec) => { if (spec && spec.startsWith(".")) { const r = resolveSpec(dir, spec); if (r) out.push(r); } };
  traverse(ast, {
    ImportDeclaration(p) {
      const used = !p.node.specifiers.length || p.node.specifiers.some((s) => { const b = p.scope.getBinding(s.local.name); return !b || b.referenced; });
      if (used) add(p.node.source.value);
    },
    "ExportAllDeclaration|ExportNamedDeclaration"(p) { add(p.node.source?.value); },
    CallExpression(p) {
      const a = p.node.arguments[0];
      if ((p.node.callee.type === "Import" || (p.node.callee.type === "Identifier" && p.node.callee.name === "require")) && a?.type === "StringLiteral") add(a.value);
    },
  });
  return out;
};
const closure = (start) => {
  const seen = new Set();
  const stack = [start];
  while (stack.length) { const x = stack.pop(); if (seen.has(x)) continue; seen.add(x); stack.push(...depsOf(x)); }
  return seen;
};
const used = [...closure(path.join(SRC, "main.jsx"))].filter((f) => /\.jsx?$/.test(f) && !f.startsWith(path.join(SRC, "i18n")));

// ── Thai texts of one file ──
const NOT_SHOWN_ATTRS = new Set(["key", "className", "class", "id", "name", "type", "value", "defaultValue", "href", "to", "src", "style", "sx", "variant", "color", "size",
  "htmlFor", "autoComplete", "inputMode", "pattern", "role", "align", "justify", "direction", "component", "target", "rel", "accept", "method", "action", "form", "lang", "dir",
  "tabIndex", "slot", "mode", "format", "inputFormat", "views", "openTo", "fontFamily", "fill", "stroke", "dataKey", "nameKey", "stackId", "orientation"]);
const COMPARE_METHODS = new Set(["includes", "startsWith", "endsWith", "indexOf", "lastIndexOf", "test", "match", "matchAll", "replace", "replaceAll", "split", "localeCompare", "has", "get", "getItem", "setItem", "removeItem", "querySelector", "querySelectorAll"]);
const jsxText = (raw) => {
  const lines = raw.split(/\r\n|\n|\r/);
  let out = "";
  lines.forEach((line, i) => {
    let l = line.replace(/\t/g, " ");
    if (i !== 0) l = l.replace(/^[ ]+/, "");
    if (i !== lines.length - 1) l = l.replace(/[ ]+$/, "");
    if (l) out += (out ? " " : "") + l;
  });
  return out;
};
const inConsole = (p) => !!p.findParent((x) => x.isCallExpression() && x.node.callee.type === "MemberExpression" && x.node.callee.object.type === "Identifier" && x.node.callee.object.name === "console");
const isData = (p) => {
  const par = p.parentPath;
  if (!par) return false;
  if (par.isBinaryExpression() && ["===", "!==", "==", "!="].includes(par.node.operator)) return true;
  if ((par.isObjectProperty() || par.isObjectMethod()) && par.node.key === p.node) return true;
  if (par.isSwitchCase() || par.isImportDeclaration() || par.isExportAllDeclaration() || par.isExportNamedDeclaration()) return true;
  if (par.isMemberExpression() && par.node.property === p.node) return true;
  if (par.isCallExpression() && par.node.callee.type === "MemberExpression" && COMPARE_METHODS.has(par.node.callee.property?.name)) return true;
  return false;
};
const isPlus = (n) => n?.type === "BinaryExpression" && n.operator === "+";
// "..." + x + `...${y}` → "...{x}...{x}" (null when there is no Thai or only fixed text)
const plusShape = (node) => {
  const parts = [];
  const flat = (n) => { if (isPlus(n)) { flat(n.left); flat(n.right); } else parts.push(n); };
  flat(node);
  let shape = "";
  let dynamic = false;
  for (const n of parts) {
    if (n.type === "StringLiteral") shape += n.value;
    else if (n.type === "NumericLiteral") shape += String(n.value);
    else if (n.type === "TemplateLiteral") {
      n.quasis.forEach((q, i) => { shape += q.value.cooked ?? q.value.raw; if (i < n.expressions.length) { shape += "{x}"; dynamic = true; } });
    } else { shape += "{x}"; dynamic = true; }
  }
  return { shape, dynamic, parts };
};
const textsOf = (file) => {
  const ast = astOf(file);
  const out = [];
  if (!ast) return out;
  const consumed = new WeakSet();
  const add = (node, kind, text) => {
    // HTML put into the page (a slip to print ...): every text between the tags is its own text on the screen
    if (/<\/?[a-z][^>]*>/i.test(text)) { text.split(/<[^>]*>/).forEach((t) => add(node, "html", t)); return; }
    const key = text.trim();
    if (!key || !TH_RE.test(key) || /^(\{x\}\s*)+$/.test(key) || ignored.has(key)) return;
    out.push({ key, kind, line: node.loc?.start.line || 0 });
  };
  traverse(ast, {
    JSXText(p) { add(p.node, "jsx", jsxText(p.node.value)); },
    JSXAttribute(p) {
      const v = p.node.value;
      if (v?.type !== "StringLiteral") return;
      consumed.add(v);
      const name = typeof p.node.name.name === "string" ? p.node.name.name : p.node.name.name?.name;
      if (NOT_SHOWN_ATTRS.has(name) || /^data-|^aria-(?!label)/.test(name || "")) return;
      add(v, "attr", v.value);
    },
    BinaryExpression(p) {
      if (!isPlus(p.node) || isPlus(p.parent) || inConsole(p) || isData(p)) return;
      const { shape, dynamic, parts } = plusShape(p.node);
      if (!TH_RE.test(shape)) return;
      parts.forEach((n) => consumed.add(n));
      add(p.node, dynamic ? "concat" : "str", shape);
    },
    StringLiteral(p) {
      if (consumed.has(p.node) || !TH_RE.test(p.node.value) || inConsole(p) || isData(p)) return;
      add(p.node, "str", p.node.value);
    },
    TemplateLiteral(p) {
      if (consumed.has(p.node) || p.parentPath.isTaggedTemplateExpression() || inConsole(p) || isData(p)) return;
      const q = p.node.quasis.map((x) => x.value.cooked ?? x.value.raw);
      if (!q.some((s) => TH_RE.test(s))) return;
      add(p.node, "tpl", q.reduce((acc, s, i) => acc + s + (i < p.node.expressions.length ? "{x}" : ""), ""));
    },
  });
  return out;
};

const FILE_ONLY = /(pdf|excel|export)\.js$/i; // builds a PDF / Excel file: never on the screen
const byFile = new Map();
for (const f of used.filter((x) => !FILE_ONLY.test(x))) {
  const list = textsOf(f).map((t) => ({ ...t, status: status(t.key) }));
  if (list.length) byFile.set(f, list);
}

// ── pages: <Route path element> / { path, element } of every router file, nested by their "/*" ──
const pages = [];
const componentFiles = (expr, scope, file) => {
  const names = [];
  const visit = (n) => {
    if (!n || typeof n !== "object") return;
    if (n.type === "JSXOpeningElement" && n.name.type === "JSXIdentifier" && /^[A-Z]/.test(n.name.name)) names.push(n.name.name);
    for (const k of Object.keys(n)) if (k !== "loc" && k !== "start" && k !== "end") { const v = n[k]; if (Array.isArray(v)) v.forEach(visit); else if (v && typeof v.type === "string") visit(v); }
  };
  visit(expr);
  const files = [];
  for (const name of names) {
    if (name === "Navigate") return { redirect: true, files: [] };
    const b = scope.getBinding(name);
    if (!b) continue;
    let spec = null;
    if (b.path.isImportDefaultSpecifier() || b.path.isImportSpecifier()) spec = b.path.parent.source.value;
    else if (b.path.isVariableDeclarator()) {
      // const X = lazy(() => import("./x"))
      b.path.traverse({
        CallExpression(c) {
          const a = c.node.arguments[0];
          if (!spec && c.node.callee.type === "Import" && a?.type === "StringLiteral") spec = a.value;
        },
      });
    }
    const r = spec && spec.startsWith(".") && resolveSpec(path.dirname(file), spec);
    if (r) files.push(r);
  }
  return { redirect: false, files };
};
const routesOf = (file) => {
  const ast = astOf(file);
  const found = [];
  if (!ast) return found;
  traverse(ast, {
    JSXOpeningElement(p) {
      if (p.node.name.name !== "Route") return;
      const attr = (n) => p.node.attributes.find((a) => a.type === "JSXAttribute" && a.name.name === n);
      const pa = attr("path")?.value;
      const el = attr("element")?.value;
      if (pa?.type !== "StringLiteral" || el?.type !== "JSXExpressionContainer") return;
      found.push({ path: pa.value, ...componentFiles(el.expression, p.scope, file) });
    },
    ObjectExpression(p) {
      const prop = (n) => p.node.properties.find((x) => x.type === "ObjectProperty" && (x.key.name === n || x.key.value === n));
      const pa = prop("path")?.value;
      const el = prop("element")?.value;
      if (pa?.type !== "StringLiteral" || !el || !/^JSX/.test(el.type)) return;
      found.push({ path: pa.value, ...componentFiles(el, p.scope, file) });
    },
  });
  return found;
};
const join = (a, b) => `${a.replace(/\/\*$/, "").replace(/\/$/, "")}/${b.replace(/^\//, "")}`.replace(/\/+/g, "/");
const walkRoutes = (file, prefix, depth = 0) => {
  for (const r of routesOf(file)) {
    if (r.redirect || !r.files.length) continue;
    const full = prefix ? join(prefix, r.path) : r.path;
    const sub = r.files.filter((f) => routesOf(f).length && depth < 3);
    if (r.path.endsWith("/*") && sub.length) sub.forEach((f) => walkRoutes(f, full, depth + 1));
    else pages.push({ path: full, files: r.files });
  }
};
walkRoutes(path.join(SRC, "App.jsx"), "");

// ── backend texts the page shows as they come: res.json({ error / message ... }), new Error(...) (sent back as err.message),
//    values the SQL writes to the database (statuses, places: N'...') ──
const BACKEND = path.join(ROOT, "..", "backend");
const relB = (p) => path.relative(path.join(ROOT, ".."), p).split(path.sep).join("/");
const RESP_KEYS = new Set(["error", "message", "msg", "detail", "details", "reason", "warning", "title", "text", "note", "hint", "description", "label", "errorMessage"]);
const SQL_WORD = /\b(SELECT|UPDATE|INSERT|DELETE|WHERE|SET)\b/i;
const sqlValues = (sql) => [...sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ").matchAll(/N?'([^'\n]{1,80})'/g)]
  .map((m) => m[1]).filter((v) => TH_RE.test(v) && !v.includes("%"));
const sentToScreen = (p) => {
  if (p.findParent((x) => x.isNewExpression() && /Error$/.test(x.node.callee.name || ""))) return true;
  if (p.findParent((x) => x.isCallExpression() && x.node.callee.type === "MemberExpression" && ["json", "send", "emit"].includes(x.node.callee.property?.name))) return true;
  const par = p.parentPath;
  return par.isObjectProperty() && par.node.value === p.node && RESP_KEYS.has(par.node.key.name ?? par.node.key.value);
};
const backendFiles = (dir, out = []) => {
  let list = [];
  try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of list) {
    if (["node_modules", "logs", "scripts", "migrations", "tests", "test"].includes(e.name) || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) backendFiles(p, out); else if (/\.(c|m)?js$/.test(e.name)) out.push(p);
  }
  return out;
};
const backend = new Map(); // file -> [{ key, kind, line, status }]
for (const f of backendFiles(BACKEND)) {
  let ast;
  try { ast = parse(fs.readFileSync(f, "utf8"), { ...PARSE, sourceType: "unambiguous" }); } catch { continue; }
  const list = [];
  const add = (node, text) => {
    const key = text.trim();
    if (key && TH_RE.test(key) && !ignored.has(key)) list.push({ key, kind: "backend", line: node.loc?.start.line || 0, status: status(key) });
  };
  traverse(ast, {
    StringLiteral(p) {
      const v = p.node.value;
      if (!TH_RE.test(v) || inConsole(p)) return;
      if (SQL_WORD.test(v)) sqlValues(v).forEach((x) => add(p.node, x)); else if (sentToScreen(p)) add(p.node, v);
    },
    TemplateLiteral(p) {
      if (inConsole(p)) return;
      const text = p.node.quasis.map((q) => q.value.cooked ?? q.value.raw).join("{x}");
      if (!TH_RE.test(text)) return;
      if (SQL_WORD.test(text)) sqlValues(text).forEach((x) => add(p.node, x)); else if (sentToScreen(p)) add(p.node, text);
    },
  });
  if (list.length) backend.set(f, list);
}

const SHARED = (f) => rel(f).startsWith("component/Layout/") || rel(f).startsWith("services/") || rel(f).startsWith("hooks/") || rel(f).startsWith("context/") || rel(f).startsWith("Popup/");
const summarize = (files, from = byFile) => {
  const miss = new Set();
  const en = new Set();
  for (const f of files) for (const t of from.get(f) || []) { if (t.status === "missing") miss.add(t.key); else if (t.status === "en-only") en.add(t.key); }
  return { missing: miss.size, enOnly: en.size };
};
const pageRows = pages.map((pg) => {
  const files = new Set();
  pg.files.forEach((f) => closure(f).forEach((x) => { if (!SHARED(x)) files.add(x); }));
  return { path: pg.path, entry: rel(pg.files[0]), files, ...summarize(files) };
});
const sharedFiles = used.filter(SHARED);
const all = summarize(used);

console.log(`ไฟล์ที่หน้าเว็บใช้: ${used.length} · มีข้อความภาษาไทย ${byFile.size} ไฟล์ · หน้า (route) ${pageRows.length}`);
console.log(`ข้อความที่ยังไม่มีคำแปล: ${all.missing} ข้อความ (ไม่ซ้ำ) · มีแต่ภาษาอังกฤษ (พม่า/เขมรแสดงอังกฤษ): ${all.enOnly}\n`);
const bad = pageRows.filter((r) => r.missing || r.enOnly).sort((a, b) => b.missing - a.missing || b.enOnly - a.enOnly);
if (bad.length) {
  console.log("หน้าที่ยังแปลไม่ครบ (ยังไม่มีคำแปล / มีแต่อังกฤษ):");
  bad.forEach((r) => console.log(`  ${String(r.missing).padStart(4)} / ${String(r.enOnly).padStart(3)}  ${r.path}   (${r.entry})`));
}
const sh = summarize(sharedFiles);
if (sh.missing || sh.enOnly) console.log(`  ${String(sh.missing).padStart(4)} / ${String(sh.enOnly).padStart(3)}  ส่วนกลางที่ทุกหน้าใช้ (Layout, services, hooks)`);
const be = summarize([...backend.keys()], backend);
if (be.missing || be.enOnly) console.log(`  ${String(be.missing).padStart(4)} / ${String(be.enOnly).padStart(3)}  ข้อความจาก backend ที่ขึ้นบนจอ (error / message ที่ส่งกลับ, สถานะที่เขียนลงฐานข้อมูล)`);
if (!bad.length && !sh.missing && !sh.enOnly && !be.missing && !be.enOnly) console.log("ทุกหน้ามีคำแปลครบ (รวมข้อความจาก backend)");

const nameOf = (f) => (backend.has(f) ? relB(f) : rel(f));
const allFiles = [...byFile.entries(), ...backend.entries()];
if (args.includes("--files")) {
  for (const [f, list] of allFiles.sort((a, b) => nameOf(a[0]).localeCompare(nameOf(b[0])))) {
    const miss = list.filter((t) => t.status !== "ok");
    if (!miss.length) continue;
    console.log(`\n${nameOf(f)}`);
    miss.forEach((t) => console.log(`  ${String(t.line).padStart(5)}  ${t.status === "en-only" ? "[en]" : "    "} ${t.key}`));
  }
}
const jsonOut = opt("--json");
if (jsonOut && jsonOut !== true) {
  const keys = new Map();
  for (const [f, list] of allFiles) for (const t of list) {
    if (t.status === "ok") continue;
    const k = keys.get(t.key) || { key: t.key, status: t.status, kinds: new Set(), files: new Set() };
    k.kinds.add(t.kind); k.files.add(`${nameOf(f)}:${t.line}`);
    keys.set(t.key, k);
  }
  const missing = [...keys.values()].map((k) => ({ ...k, kinds: [...k.kinds], files: [...k.files] }));
  fs.writeFileSync(jsonOut, JSON.stringify({ missing, pages: pageRows.map((r) => ({ path: r.path, entry: r.entry, missing: r.missing, enOnly: r.enOnly })) }, null, 1));
  console.log(`\nเขียนผลแล้ว: ${jsonOut} (${missing.length} ข้อความ)`);
}
