// Feed of the alerts the LINE alert worker made ("การแจ้งเตือนล่าสุด" page): one Redis list, newest first. The worker writes (delayAlertWorker.js),
// the backend reads (GET /api/sheet/delay-alert/feed). Recording costs no LINE quota: everybody who is logged in can read it on the web.
const crypto = require("crypto");

const FEED_KEY = "delayalert:feed";
const FEED_MAX = 300;                 // entries kept
const FEED_TTL_S = 30 * 86400;        // the list expires 30 days after the last alert
const MAX_BLOCKS = 60;                // rows kept per entry (the rest is only counted)
const KINDS = ["red", "fish", "transit_late", "transit_arrived"];

/** blocks = one text per row (every field on its own line); line = "sent" | "not-configured" | "failed <http status>" */
const makeEntry = ({ kind, title, blocks, line }) => ({
  id: crypto.randomUUID(),
  at: Date.now(),
  kind,
  title,
  count: blocks.length,
  blocks: blocks.slice(0, MAX_BLOCKS),
  more: Math.max(0, blocks.length - MAX_BLOCKS),
  line,
});

const addEntry = async (redis, entry) => {
  await redis.multi().lPush(FEED_KEY, JSON.stringify(entry)).lTrim(FEED_KEY, 0, FEED_MAX - 1).expire(FEED_KEY, FEED_TTL_S).exec();
};

/** { limit, before (ms: only entries older than this), kind } -> { entries, hasMore } */
const readFeed = async (redis, { limit = 30, before = 0, kind = "" } = {}) => {
  const raw = await redis.lRange(FEED_KEY, 0, FEED_MAX - 1);
  const all = raw.map((s) => { try { return JSON.parse(s); } catch { return null; } })
    .filter((e) => e && (!kind || e.kind === kind) && (!before || e.at < before));
  const n = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100);
  return { entries: all.slice(0, n), hasMore: all.length > n };
};

module.exports = { FEED_KEY, FEED_MAX, KINDS, makeEntry, addEntry, readFeed };
