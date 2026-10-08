/**
 * Delay alert worker — tells a LINE group about raw materials that are YELLOW or RED (same colour rule as the Master Sheet).
 * One PM2 process (fork, 1 instance). Every minute it reads the Master Sheet data from the API and counts the DBS (lib/dbs.mjs, running clocks included):
 *   - IMMEDIATE: a short message with the rows whose colour just got worse (green -> yellow, yellow -> red, or new and already yellow/red)
 *   - HOURLY SUMMARY: one message with ALL yellow and red rows (red first, worst first), once an hour (the first one right after the worker starts, to prove LINE works)
 * Colour: the DBS of the stage the row is in (before cold room DBS1 · in cold room DBS2 · out of cold room DBS3 · finished DBS4), a stage without value falls back to DBS4.
 *
 * .env
 *   LINE_CHANNEL_ACCESS_TOKEN   channel access token of the LINE bot (Messaging API)       (required)
 *   LINE_GROUP_ID               id of the LINE group the bot was added to (starts with C)  (required)
 *   DELAY_ALERT_DBS             optional: 1..4 = use that DBS for every row instead of the stage rule
 *   DELAY_ALERT_GREEN_PCT       green while the remaining time is above this %   (default 50)
 *   DELAY_ALERT_YELLOW_PCT      yellow while the remaining time is above this %  (default 0; at or below = red)
 *   DELAY_ALERT_SUMMARY_MIN     minutes between the summaries (default 60; 0 = no summary)
 *   DELAY_ALERT_API             base URL of the backend (default http://127.0.0.1:<PORT>)
 *   DELAY_ALERT_INTERVAL_SEC    how often to check (default 60)
 *   DELAY_ALERT_LINK            optional link printed at the end of the message (e.g. the Master Sheet address)
 * The first run only remembers the colours of the rows (no immediate messages), so starting the worker does not flood the group.
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const cfg = () => ({
  token: process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
  group: process.env.LINE_GROUP_ID || "",
  pushUrl: process.env.LINE_PUSH_URL || "https://api.line.me/v2/bot/message/push",
  api: process.env.DELAY_ALERT_API || `http://127.0.0.1:${process.env.PORT || 3001}`,
  dbs: process.env.DELAY_ALERT_DBS ? Math.min(Math.max(parseInt(process.env.DELAY_ALERT_DBS, 10) || 4, 1), 4) - 1 : "stage",
  greenPct: Number.isFinite(parseFloat(process.env.DELAY_ALERT_GREEN_PCT)) ? parseFloat(process.env.DELAY_ALERT_GREEN_PCT) : 50,
  yellowPct: Number.isFinite(parseFloat(process.env.DELAY_ALERT_YELLOW_PCT)) ? parseFloat(process.env.DELAY_ALERT_YELLOW_PCT) : 0,
  summaryMs: (Number.isFinite(parseFloat(process.env.DELAY_ALERT_SUMMARY_MIN)) ? parseFloat(process.env.DELAY_ALERT_SUMMARY_MIN) : 60) * 60000,
  intervalMs: Math.max(15, parseInt(process.env.DELAY_ALERT_INTERVAL_SEC, 10) || 60) * 1000,
  link: process.env.DELAY_ALERT_LINK || "",
  stateFile: process.env.DELAY_ALERT_STATE || path.join(__dirname, "logs", "delay-alert-state.json"),
});

const RANK = { green: 0, yellow: 1, red: 2 };
const LABEL = { yellow: "🟡 เหลือง", red: "🔴 แดง" };

const levelFor = (d, c) => {
  if (!d || d.text === "-" || d.minutes === null || d.minutes === undefined || !d.std) return null;
  const remaining = ((d.std - d.minutes) / d.std) * 100;
  const level = remaining > c.greenPct ? "green" : remaining > c.yellowPct ? "yellow" : "red";
  return { level, remaining, d };
};
/** same rule as rowColorOf of the Master Sheet */
const levelOf = (dbs, row, c, stageDbsIndex) => {
  if (!dbs?.length) return null;
  const idx = c.dbs === "stage" ? stageDbsIndex(row) : c.dbs;
  const hit = levelFor(dbs[idx], c) ?? (c.dbs === "stage" ? levelFor(dbs[3], c) : null);
  return hit ? { ...hit, dbsNo: (dbs[idx] && levelFor(dbs[idx], c) ? idx : 3) + 1 } : null;
};

const readState = (file) => {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
};
const writeState = (file, state) => {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(state));
  } catch (err) { console.error("❌ [delayAlert] เขียน state ไม่สำเร็จ:", err.message); }
};

const fmtStd = (min) => `${Math.floor(min / 60)} ชม.${Math.round(min % 60) ? ` ${Math.round(min % 60)} นาที` : ""}`;
const line = (r, hit, c) => {
  const bits = [r.mat_name || r.mat || `รายการ ${r.mapping_id}`, r.batch_after ? `Batch ${r.batch_after}` : "", r.tro_id ? `รถเข็น ${r.tro_id}` : "", r.hu ? `HU ${r.hu}` : "", r.code || ""].filter(Boolean);
  const left = Math.max(0, Math.round(hit.remaining));
  return `• ${bits.join(" | ")}\n   DBS${hit.dbsNo} ${hit.d.text} / มาตรฐาน ${fmtStd(hit.d.std)} (เหลือ ${hit.remaining < 0 ? 0 : left}%) · รายการ ${r.mapping_id}`;
};

const MAX_ROWS_PER_COLOUR = 30;
/** text messages (<= 4500 chars each, LINE allows 5 per push). title = first line; rows are red first, the worst (least remaining time) first */
const buildMessages = (items, c, title = "⚠️ แจ้งเตือน Delay วัตถุดิบ") => {
  const by = (lv) => items.filter((i) => i.level === lv).sort((a, b) => a.hit.remaining - b.hit.remaining);
  const groups = { red: by("red"), yellow: by("yellow") };
  const blocks = [];
  ["red", "yellow"].forEach((lv) => {
    if (!groups[lv].length) return;
    blocks.push(`${LABEL[lv]} (${groups[lv].length} รายการ)`);
    groups[lv].slice(0, MAX_ROWS_PER_COLOUR).forEach((i) => blocks.push(line(i.row, i.hit, c)));
    if (groups[lv].length > MAX_ROWS_PER_COLOUR) blocks.push(`   …และอีก ${groups[lv].length - MAX_ROWS_PER_COLOUR} รายการ (ดูทั้งหมดในตารางรวมวัตถุดิบ)`);
  });
  if (c.link) blocks.push(`ดูตาราง: ${c.link}`);
  const msgs = []; let cur = title;
  blocks.forEach((b) => {
    if ((cur + "\n" + b).length > 4500) { msgs.push(cur); cur = b; } else cur += "\n" + b;
  });
  msgs.push(cur);
  return msgs.slice(0, 5).map((text) => ({ type: "text", text }));
};

const push = async (messages, c) => {
  await axios.post(c.pushUrl, { to: c.group, messages }, { headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" }, timeout: 20000 });
};

let libPromise = null;
const loadLib = () => { if (!libPromise) libPromise = import("./lib/dbs.mjs"); return libPromise; };

/**
 * One check; returns { sent, summary } (used by the timer and by the test).
 * state file: { levels: { mapping_id: "green"|"yellow"|"red" }, summaryAt: ms of the last summary }
 */
const runOnce = async (now = Date.now()) => {
  const c = cfg();
  const { getDbs, stageDbsIndex } = await loadLib();
  const res = await axios.get(`${c.api}/api/sheet/rows`, { params: { days: 7, include_open: 1 }, timeout: 60000 });
  if (!res.data?.success) throw new Error(res.data?.error || "โหลดข้อมูลตารางไม่สำเร็จ");

  const prev = readState(c.stateFile);
  const baseline = prev === null;           // first run: no immediate messages, only remember
  const next = {};
  const worse = [];
  const coloured = [];                      // every yellow / red row (for the summary)
  for (const row of res.data.mappings || []) {
    let hit = null;
    try { hit = levelOf(getDbs(row, now), row, c, stageDbsIndex); } catch (err) { console.error("❌ [delayAlert] คำนวณ DBS รายการ", row.mapping_id, err.message); }
    if (!hit) continue;
    next[row.mapping_id] = hit.level;
    if (hit.level === "green") continue;
    coloured.push({ row, hit, level: hit.level });
    const before = prev?.levels?.[row.mapping_id];
    const beforeRank = before === undefined ? -1 : RANK[before];
    if (!baseline && RANK[hit.level] > beforeRank) worse.push({ row, hit, level: hit.level });
  }

  const summaryDue = c.summaryMs > 0 && now - (prev?.summaryAt || 0) >= c.summaryMs;   // no summaryAt yet = due now (first run)
  const toSend = summaryDue ? coloured : worse;
  let sent = 0;
  if (toSend.length) {
    if (!c.token || !c.group) {
      console.error("⚠️ [delayAlert] ยังไม่ได้ตั้ง LINE_CHANNEL_ACCESS_TOKEN / LINE_GROUP_ID — ไม่ส่งแจ้งเตือน");
      return { sent: 0, summary: false };
    }
    const title = summaryDue
      ? `📋 สรุป Delay วัตถุดิบ: 🔴 ${coloured.filter((i) => i.level === "red").length} · 🟡 ${coloured.filter((i) => i.level === "yellow").length} รายการ`
      : "⚠️ แจ้งเตือน Delay วัตถุดิบ (เพิ่งเปลี่ยนสี)";
    await push(buildMessages(toSend, c, title), c);   // throws on failure: the state is NOT saved, so the next check tries again
    sent = toSend.length;
    console.log(`✅ [delayAlert] ส่ง${summaryDue ? "สรุป" : "แจ้งเตือน"} ${sent} รายการ`);
  }
  writeState(c.stateFile, { levels: next, summaryAt: summaryDue ? now : (prev?.summaryAt || 0) });
  return { sent, summary: summaryDue && sent > 0 };
};

const start = () => {
  const c = cfg();
  if (!c.token || !c.group) console.error("⚠️ [delayAlert] ยังไม่ได้ตั้ง LINE_CHANNEL_ACCESS_TOKEN / LINE_GROUP_ID ใน .env — ตัวตรวจจับทำงานแต่จะยังไม่ส่ง LINE");
  console.log(`🔌 [delayAlert] เริ่มทำงาน: ตรวจทุก ${c.intervalMs / 1000} วินาที ใช้ ${c.dbs === "stage" ? "DBS ตามขั้นตอนของแถว" : `DBS${c.dbs + 1}`} · สรุปทุก ${c.summaryMs / 60000} นาที (เขียว >${c.greenPct}% · เหลือง >${c.yellowPct}%)`);
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try { await runOnce(); } catch (err) {
      const why = err.response ? `${err.response.status} ${JSON.stringify(err.response.data || {}).slice(0, 300)}` : err.message;
      console.error("❌ [delayAlert] ตรวจไม่สำเร็จ:", why);
    } finally { busy = false; }
  };
  setTimeout(tick, 15000);   // let the API come up first
  setInterval(tick, c.intervalMs);
};

if (require.main === module) start();
module.exports = { runOnce, levelOf, buildMessages };
