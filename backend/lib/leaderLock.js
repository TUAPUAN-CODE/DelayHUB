// ล็อกผู้นำ (leader lease) ผ่าน Redis: มีเครื่อง/process เดียวที่ได้ทำงาน "ต้องมีตัวเดียว" เช่น แจ้งเตือน LINE, เชื่อมต่อ RFID reader
// ใช้ได้ทั้งเครื่องเดียวและสองเครื่อง — ล็อกว่างเมื่อไหร่ได้ทันที (เครื่องเดียวทำงานเหมือนเดิม) อีกเครื่องรอรับช่วงต่อภายใน ~ttl เมื่อผู้นำตาย
//   ล็อกหมดอายุเอง (PX ttl) และต่ออายุทุก ttl/3; ปล่อยล็อกเมื่อปิดโปรแกรมปกติ (stop)
//   Redis ใช้ไม่ได้: LEADER_FALLBACK=run (ค่าเริ่มต้น) = ทำงานต่อหลังเงียบเกิน grace → ระบบเครื่องเดียวไม่หยุด (สองเครื่องอาจทำซ้ำชั่วคราว)
//                    LEADER_FALLBACK=standby = รอจนกว่า Redis กลับมา (ปลอดภัยกว่าถ้าห้ามซ้ำเด็ดขาด แต่ Redis ล่ม = งานหยุด)
const crypto = require("crypto");
const os = require("os");
const { createRedis } = require("./redisClient");
const logger = require("./logger");

const RENEW_LUA = 'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("pexpire", KEYS[1], ARGV[2]) else return 0 end';
const RELEASE_LUA = 'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';

const createLeader = ({ name, ttlMs = 30000, fallback = process.env.LEADER_FALLBACK || "run", graceMs: graceOption, onChange } = {}) => {
  const key = `pfcm:leader:${name}`;
  const id = `${os.hostname()}:${process.pid}:${crypto.randomBytes(4).toString("hex")}`;
  const graceMs = graceOption || Math.max(ttlMs, 15000); // Redis เงียบนานเท่านี้จึงถือว่า "ใช้ไม่ได้จริง" (กันกระพริบตอนเพิ่งเริ่มเชื่อมต่อ)
  const redis = createRedis(`leader:${name}`);
  let leader = false;
  let unreachableSince = Date.now();
  let timer = null;

  const setLeader = (value, reason) => {
    if (leader === value) return;
    leader = value;
    logger.info(value ? "leader_acquired" : "leader_lost", { name, id, reason });
    if (onChange) { try { onChange(value); } catch (err) { logger.error("leader_onchange_failed", { name, error: err.message }); } }
  };

  const tick = async () => {
    try {
      if (!redis.isReady) throw new Error("redis not ready");
      if (leader) {
        const renewed = await redis.eval(RENEW_LUA, { keys: [key], arguments: [id, String(ttlMs)] });
        if (renewed === 1) { unreachableSince = null; return; }
        setLeader(false, "lease_taken_by_other"); // ล็อกถูกเครื่องอื่นถือ (หรือหมดอายุ) — ลองขอใหม่ด้านล่าง
      }
      const got = await redis.set(key, id, { NX: true, PX: ttlMs });
      unreachableSince = null;
      if (got === "OK") setLeader(true, "acquired");
    } catch (err) {
      if (unreachableSince === null) unreachableSince = Date.now();
      const down = Date.now() - unreachableSince;
      if (down >= graceMs) {
        if (fallback === "run") setLeader(true, `redis_unavailable_${Math.round(down / 1000)}s_fallback_run`);
        else if (leader && down >= ttlMs) setLeader(false, "redis_unavailable_standby");
      }
    }
  };

  return {
    isLeader: () => leader,
    id,
    start() {
      if (timer) return;
      redis.connect().catch((err) => logger.error("leader_redis_connect_failed", { name, error: err.message }));
      timer = setInterval(tick, Math.max(1000, Math.floor(ttlMs / 3)));
      timer.unref();
      tick();
    },
    async stop() {
      if (timer) { clearInterval(timer); timer = null; }
      try { if (leader && redis.isReady) await redis.eval(RELEASE_LUA, { keys: [key], arguments: [id] }); } catch { /* ปล่อยให้หมดอายุเอง */ }
      leader = false;
      try { await redis.quit(); } catch { /* ปิดอยู่แล้ว */ }
    },
  };
};

module.exports = { createLeader };
