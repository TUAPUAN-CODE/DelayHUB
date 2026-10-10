// ที่เก็บตัวนับของ express-rate-limit ใน Redis เพื่อให้ "ทุก worker / ทุกเครื่อง" นับร่วมกัน (เดิมนับในหน่วยความจำของแต่ละ process
// → ขีดจำกัดจริง = ค่าที่ตั้ง × จำนวน worker × จำนวนเครื่อง) — เขียนเองด้วย Lua สั้นๆ ไม่ต้องเพิ่ม package
// Redis ไม่พร้อม/ผิดพลาด → ใช้ตัวนับในหน่วยความจำของ process นี้แทน (fail-open: ระบบไม่ล่มเพราะ rate limit)
const INCR_LUA = `
local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return { n, redis.call('PTTL', KEYS[1]) }
`;

class RedisRateLimitStore {
  constructor({ getRedis, prefix }) {
    this.getRedis = getRedis;
    this.prefix = `pfcm:rl:${prefix}:`;
    this.windowMs = 15 * 60 * 1000;
    this.memory = new Map(); // key -> { hits, resetAt }
    this.localKeys = false;
  }

  init(options) {
    this.windowMs = options.windowMs;
    const sweeper = setInterval(() => {
      const now = Date.now();
      for (const [k, v] of this.memory) if (v.resetAt <= now) this.memory.delete(k);
    }, 60000);
    sweeper.unref();
  }

  redis() {
    const r = this.getRedis && this.getRedis();
    return r && r.isReady ? r : null;
  }

  async increment(key) {
    const r = this.redis();
    if (r) {
      try {
        const [hits, ttl] = await r.eval(INCR_LUA, { keys: [this.prefix + key], arguments: [String(this.windowMs)] });
        return { totalHits: hits, resetTime: new Date(Date.now() + (ttl > 0 ? ttl : this.windowMs)) };
      } catch { /* ใช้ตัวนับในหน่วยความจำด้านล่าง */ }
    }
    const now = Date.now();
    let rec = this.memory.get(key);
    if (!rec || rec.resetAt <= now) { rec = { hits: 0, resetAt: now + this.windowMs }; this.memory.set(key, rec); }
    rec.hits += 1;
    return { totalHits: rec.hits, resetTime: new Date(rec.resetAt) };
  }

  async decrement(key) {
    const r = this.redis();
    if (r) { try { const v = await r.get(this.prefix + key); if (v && Number(v) > 0) await r.decr(this.prefix + key); return; } catch { /* ตกไปที่ memory */ } }
    const rec = this.memory.get(key);
    if (rec && rec.hits > 0) rec.hits -= 1;
  }

  async resetKey(key) {
    const r = this.redis();
    if (r) { try { await r.del(this.prefix + key); } catch { /* ข้าม */ } }
    this.memory.delete(key);
  }
}

module.exports = { RedisRateLimitStore };
