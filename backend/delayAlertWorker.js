/**
 * Delay alert worker — tells a LINE group when a raw material turns YELLOW or RED (same colour rule as the Master Sheet).
 * One PM2 process (fork, 1 instance): it reads the Master Sheet data from the API every minute, counts the DBS (lib/dbs.mjs, running clocks included)
 * and sends ONE message per minute that lists the materials whose colour got worse (green -> yellow, yellow -> red, or new and already yellow/red).
 *
 * .env
 *   LINE_CHANNEL_ACCESS_TOKEN   channel access token of the LINE bot (Messaging API)       (required)
 *   LINE_GROUP_ID               id of the LINE group the bot was added to (starts with C)  (required)
 *   DELAY_ALERT_DBS             which DBS decides the colour: 1..4            (default 4 = DBS4, same as the table's default)
 *   DELAY_ALERT_GREEN_PCT       green while the remaining time is above this %   (default 50)
 *   DELAY_ALERT_YELLOW_PCT      yellow while the remaining time is above this %  (default 0; at or below = red)
 *   DELAY_ALERT_API             base URL of the backend (default http://127.0.0.1:<PORT>)
 *   DELAY_ALERT_INTERVAL_SEC    how often to check (default 60)
 *   DELAY_ALERT_LINK            optional link printed at the end of the message (e.g. the Master Sheet address)
 * The first run only remembers the colours (nothing is sent), so starting the worker does not flood the group with everything that is already late.
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
  dbs: Math.min(Math.max(parseInt(process.env.DELAY_ALERT_DBS, 10) || 4, 1), 4) - 1,
  greenPct: Number.isFinite(Number(process.env.DELAY_ALERT_GREEN_PCT)) && process.env.DELAY_ALERT_GREEN_PCT !== undefined && process.env.DELAY_ALERT_GREEN_PCT !== "" ? Number(process.env.DELAY_ALERT_GREEN_PCT) : 50,
  yellowPct: Number.isFinite(Number(process.env.DELAY_ALERT_YELLOW_PCT)) && process.env.DELAY_ALERT_YELLOW_PCT !== undefined && process.env.DELAY_ALERT_YELLOW_PCT !== "" ? Number(process.env.DELAY_ALERT_YELLOW_PCT) : 0,
  intervalMs: Math.max(15, parseInt(process.env.DELAY_ALERT_INTERVAL_SEC, 10) || 60) * 1000,
  link: process.env.DELAY_ALERT_LINK || "",
  stateFile: process.env.DELAY_ALERT_STATE || path.join(__dirname, "logs", "delay-alert-state.json"),
});

const RANK = { green: 0, yellow: 1, red: 2 };
const LABEL = { yellow: "🟡 เหลือง", red: "🔴 แดง" };

/** same rule as rowColorOf of the Master Sheet: remaining time / standard of the chosen DBS */
const levelOf = (dbs, c) => {
  const d = dbs?.[c.dbs];
  if (!d || d.text === "-" || d.minutes === null || d.minutes === undefined || !d.std) return null;
  const remaining = ((d.std - d.minutes) / d.std) * 100;
  if (remaining > c.greenPct) return { level: "green", remaining, d };
  if (remaining > c.yellowPct) return { level: "yellow", remaining, d };
  return { level: "red", remaining, d };
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
  return `• ${bits.join(" | ")}\n   DBS${c.dbs + 1} ${hit.d.text} / มาตรฐาน ${fmtStd(hit.d.std)} (เหลือ ${hit.remaining < 0 ? 0 : left}%) · รายการ ${r.mapping_id}`;
};

/** text messages (<= 4500 chars each, LINE allows 5 per push) */
const buildMessages = (items, c) => {
  const groups = { red: items.filter((i) => i.level === "red"), yellow: items.filter((i) => i.level === "yellow") };
  const blocks = [];
  ["red", "yellow"].forEach((lv) => {
    if (!groups[lv].length) return;
    blocks.push(`${LABEL[lv]} (${groups[lv].length} รายการ)`);
    groups[lv].forEach((i) => blocks.push(line(i.row, i.hit, c)));
  });
  if (c.link) blocks.push(`ดูตาราง: ${c.link}`);
  const msgs = []; let cur = "⚠️ แจ้งเตือน Delay วัตถุดิบ";
  blocks.forEach((b) => {
    if ((cur + "\n" + b).length > 4500) { msgs.push(cur); cur = b; } else cur += "\n" + b;
  });
  msgs.push(cur);
  return msgs.slice(0, 5).map((text) => ({ type: "text", text }));
};

const push = async (messages, c) => {
  await axios.post(c.pushUrl, { to: c.group, messages }, { headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" }, timeout: 20000 });
};

let getDbsPromise = null;
const loadGetDbs = () => { if (!getDbsPromise) getDbsPromise = import("./lib/dbs.mjs").then((m) => m.getDbs); return getDbsPromise; };

/** one check; returns { sent, changed } (used by the timer and by the test) */
const runOnce = async (now = Date.now()) => {
  const c = cfg();
  const getDbs = await loadGetDbs();
  const res = await axios.get(`${c.api}/api/sheet/rows`, { params: { days: 7, include_open: 1 }, timeout: 60000 });
  if (!res.data?.success) throw new Error(res.data?.error || "โหลดข้อมูลตารางไม่สำเร็จ");

  const prev = readState(c.stateFile);
  const baseline = prev === null;           // first run: remember only
  const next = {};
  const worse = [];
  for (const row of res.data.mappings || []) {
    let hit = null;
    try { hit = levelOf(getDbs(row, now), c); } catch (err) { console.error("❌ [delayAlert] คำนวณ DBS รายการ", row.mapping_id, err.message); }
    if (!hit) continue;
    next[row.mapping_id] = hit.level;
    const before = prev?.[row.mapping_id];
    const beforeRank = before === undefined ? -1 : RANK[before];
    if (!baseline && hit.level !== "green" && RANK[hit.level] > beforeRank) worse.push({ row, hit, level: hit.level });
  }

  if (worse.length) {
    if (!c.token || !c.group) {
      console.error("⚠️ [delayAlert] ยังไม่ได้ตั้ง LINE_CHANNEL_ACCESS_TOKEN / LINE_GROUP_ID — ไม่ส่งแจ้งเตือน");
      return { sent: 0, changed: worse.length };
    }
    worse.sort((a, b) => RANK[b.level] - RANK[a.level]);
    await push(buildMessages(worse, c), c);   // throws on failure: the state is NOT saved, so the next check tries again
    console.log(`✅ [delayAlert] ส่งแจ้งเตือน ${worse.length} รายการ`);
  }
  writeState(c.stateFile, next);
  return { sent: worse.length, changed: worse.length };
};

const start = () => {
  const c = cfg();
  if (!c.token || !c.group) console.error("⚠️ [delayAlert] ยังไม่ได้ตั้ง LINE_CHANNEL_ACCESS_TOKEN / LINE_GROUP_ID ใน .env — ตัวตรวจจับทำงานแต่จะยังไม่ส่ง LINE");
  console.log(`🔌 [delayAlert] เริ่มทำงาน: ตรวจทุก ${c.intervalMs / 1000} วินาที ใช้ DBS${c.dbs + 1} (เขียว >${c.greenPct}% · เหลือง >${c.yellowPct}%)`);
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
