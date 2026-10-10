// ตัวชี้วัดของแต่ละ worker: counter, histogram ของเวลา และ gauge
// ทุก worker เขียน snapshot ลง Redis ทุก 10 วินาที (หมดอายุเอง 30 วินาที) แล้ว GET /metrics อ่านมารวมทุก worker — ไม่ต้องพึ่งว่า request ตกที่ worker ไหน
const BUCKETS_MS = [50, 100, 250, 500, 1000, 2500, 5000, 10000];
const counters = new Map(); // "name|k=v,k=v" -> number
const hists = new Map();    // name -> { buckets:[..counts], sum, count }
const gaugeFns = new Map(); // name -> () => number | object

const keyOf = (name, labels) => {
  if (!labels) return name;
  const parts = Object.keys(labels).sort().map((k) => `${k}=${String(labels[k]).replace(/[|,="\n]/g, "_")}`);
  return parts.length ? `${name}|${parts.join(",")}` : name;
};

const inc = (name, labels, by = 1) => {
  const k = keyOf(name, labels);
  counters.set(k, (counters.get(k) || 0) + by);
};

const observe = (name, ms) => {
  let h = hists.get(name);
  if (!h) { h = { buckets: new Array(BUCKETS_MS.length + 1).fill(0), sum: 0, count: 0 }; hists.set(name, h); }
  let i = BUCKETS_MS.findIndex((b) => ms <= b);
  if (i === -1) i = BUCKETS_MS.length;
  h.buckets[i] += 1; h.sum += ms; h.count += 1;
};

const registerGauge = (name, fn) => gaugeFns.set(name, fn);

// event loop lag: ช่วงที่ Node "ค้าง" ตอบคำขอไม่ได้ (query หนักใน process, JSON ใหญ่ ฯลฯ)
let lagMax = 0;
let lagTimer = null;
const startLagProbe = () => {
  if (lagTimer) return;
  let last = Date.now();
  lagTimer = setInterval(() => {
    const now = Date.now();
    lagMax = Math.max(lagMax, Math.max(0, now - last - 500));
    last = now;
  }, 500);
  lagTimer.unref();
};

const snapshot = () => {
  const gauges = {};
  for (const [name, fn] of gaugeFns) {
    try { gauges[name] = fn(); } catch { /* gauge ที่อ่านไม่ได้ข้ามไป */ }
  }
  gauges.eventloop_lag_ms_max = lagMax;
  gauges.memory_rss_bytes = process.memoryUsage().rss;
  gauges.heap_used_bytes = process.memoryUsage().heapUsed;
  const snap = { pid: process.pid, at: Date.now(), counters: Object.fromEntries(counters), hists: Object.fromEntries(hists), gauges };
  lagMax = 0; // รายงานค่าสูงสุดต่อรอบ
  return snap;
};

const REDIS_PREFIX = "pfcm:metrics:";
let flushTimer = null;
const startFlush = (redis) => {
  if (flushTimer || !redis) return;
  startLagProbe();
  const flush = async () => {
    try {
      if (!redis.isOpen) return;
      await redis.set(`${REDIS_PREFIX}${process.pid}`, JSON.stringify(snapshot()), { EX: 30 });
    } catch { /* Redis ไม่พร้อมชั่วคราว: ข้ามรอบนี้ */ }
  };
  flushTimer = setInterval(flush, 10000);
  flushTimer.unref();
  flush();
};

const readAll = async (redis) => {
  try {
    if (redis && redis.isOpen) {
      const keys = await redis.keys(`${REDIS_PREFIX}*`);
      if (keys.length) {
        const values = await redis.mGet(keys);
        const snaps = values.filter(Boolean).map((v) => JSON.parse(v));
        if (snaps.length) return snaps;
      }
    }
  } catch { /* ใช้ของ process นี้แทน */ }
  return [snapshot()];
};

const esc = (v) => String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const labelText = (labelStr) => {
  if (!labelStr) return "";
  return `{${labelStr.split(",").map((p) => { const [k, ...v] = p.split("="); return `${k}="${esc(v.join("="))}"`; }).join(",")}}`;
};

/** snapshots ของทุก worker -> ข้อความ Prometheus */
const renderPrometheus = (snaps) => {
  const out = [];
  const sums = new Map();
  for (const s of snaps) for (const [k, v] of Object.entries(s.counters)) sums.set(k, (sums.get(k) || 0) + v);
  const byName = new Map();
  for (const [k, v] of sums) { const [name, labels] = k.split("|"); if (!byName.has(name)) byName.set(name, []); byName.get(name).push([labels, v]); }
  for (const [name, rows] of byName) {
    out.push(`# TYPE pfcm_${name} counter`);
    rows.forEach(([labels, v]) => out.push(`pfcm_${name}${labelText(labels)} ${v}`));
  }
  const hnames = new Set(snaps.flatMap((s) => Object.keys(s.hists)));
  for (const name of hnames) {
    const total = { buckets: new Array(BUCKETS_MS.length + 1).fill(0), sum: 0, count: 0 };
    snaps.forEach((s) => { const h = s.hists[name]; if (!h) return; h.buckets.forEach((c, i) => { total.buckets[i] += c; }); total.sum += h.sum; total.count += h.count; });
    out.push(`# TYPE pfcm_${name} histogram`);
    let acc = 0;
    BUCKETS_MS.forEach((b, i) => { acc += total.buckets[i]; out.push(`pfcm_${name}_bucket{le="${b}"} ${acc}`); });
    out.push(`pfcm_${name}_bucket{le="+Inf"} ${total.count}`, `pfcm_${name}_sum ${total.sum}`, `pfcm_${name}_count ${total.count}`);
  }
  out.push("# TYPE pfcm_workers gauge", `pfcm_workers ${snaps.length}`);
  for (const s of snaps) {
    for (const [g, v] of Object.entries(s.gauges)) {
      if (typeof v === "number") out.push(`pfcm_${g}{pid="${s.pid}"} ${v}`);
      else if (v && typeof v === "object") for (const [sub, n] of Object.entries(v)) if (typeof n === "number") out.push(`pfcm_${g}_${sub}{pid="${s.pid}"} ${n}`);
    }
  }
  return `${out.join("\n")}\n`;
};

const counterValue = (name, labels) => counters.get(keyOf(name, labels)) || 0;
const counterSumByPrefix = (name) => { let t = 0; for (const [k, v] of counters) if (k === name || k.startsWith(`${name}|`)) t += v; return t; };

module.exports = { inc, observe, registerGauge, startFlush, readAll, renderPrometheus, snapshot, counterValue, counterSumByPrefix, startLagProbe };
