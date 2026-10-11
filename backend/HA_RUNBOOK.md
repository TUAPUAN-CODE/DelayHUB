# คู่มือรันสองเครื่อง (High Availability)

เอกสารนี้อธิบายสิ่งที่โค้ดรองรับแล้ว และสิ่งที่ต้องตั้งค่านอกโค้ด (load balancer, Redis, SQL Server) เพื่อให้เครื่องหนึ่งดับแล้วอีกเครื่องรับงานต่อ
**ไม่มีอะไรในเอกสารนี้ถูกบังคับใช้เอง** — ค่าเริ่มต้นทั้งหมดทำให้เครื่องเดียวทำงานเหมือนเดิม

## 1. ภาพรวม

```
ผู้ใช้ ──► Load balancer (sticky ตาม IP, health check /health/ready)
              ├──► เครื่อง A : backend(cluster) + frontend(static) + [RFID, delay-alert, print-agent]
              └──► เครื่อง B : backend(cluster) + frontend(static) + [RFID, delay-alert]
                         │                │
                         └── Redis ร่วม ──┘          (socket.io adapter, ล็อกผู้นำ, rate limit, metrics, auth)
                         └── SQL Server (เครื่องเดียว หรือ Always On listener)
```

## 2. ค่าใน `.env` (ทั้งสองเครื่อง)

| ตัวแปร | ความหมาย | ค่าเริ่มต้น |
|---|---|---|
| `AUTH_JWT_SECRET` | **ต้องเหมือนกันทั้งสองเครื่อง** (token ตรวจได้ทุกเครื่อง) | อนุมานจากค่า DB |
| `REDIS_HOST` / `REDIS_PORT` | Redis ร่วมของทั้งสองเครื่อง (ไม่ใช่ `127.0.0.1` ของแต่ละเครื่อง!) | `127.0.0.1` / `6379` |
| `REDIS_PASSWORD` / `REDIS_USERNAME` / `REDIS_TLS=true` | ถ้า Redis ตั้งรหัส/ใช้ TLS | ไม่ตั้ง |
| `DB_SERVER` | เครื่อง SQL Server หรือชื่อ AG listener | — |
| `DB_MULTI_SUBNET_FAILOVER=true` | ใช้เมื่อ `DB_SERVER` เป็น AG listener | ปิด |
| `DB_REQUEST_TIMEOUT_MS` / `DB_CONNECT_TIMEOUT_MS` | เวลารอ query / รอเชื่อมต่อ | `30000` / `15000` |
| `DB_PORT` | พอร์ต SQL Server | `1433` |
| `TRUST_PROXY` | จำนวน proxy ที่เชื่อ (เช่น `1` ถ้ามี nginx ตัวเดียว) | เชื่อ proxy วงในทั้งหมด |
| `RFID_LEADER_LOCK=true` | เปิดล็อกผู้นำของ RFID (ดูข้อ 4) — **ตั้งเฉพาะตอนรันสองเครื่อง** | ปิด |
| `LEADER_FALLBACK=run\|standby` | Redis ใช้ไม่ได้ตอนใช้ล็อกผู้นำ: `run` ทำงานต่อ (ค่าเริ่มต้น), `standby` หยุดรอ | `run` |
| `DELAY_ALERT_STALE_MIN` | สถานะแจ้งเตือนเก่ากว่านี้ (นาที) = เริ่มใหม่ ไม่ส่งซ้ำท่วมกลุ่ม | `30` |

## 3. งานที่รันบนแต่ละเครื่อง

| งาน (pm2) | รันกี่เครื่อง | หมายเหตุ |
|---|---|---|
| `PFCMv2-backend` | ทั้งสอง | stateless (token) ใช้ Redis/DB ร่วม |
| `PFCMv2-frontend` | ทั้งสอง | **build เดียวกันทั้งสองเครื่อง** deploy ให้ครบทั้งคู่ก่อนเปิดทาง LB |
| `reset-rsrv-worker` | ทั้งสองได้ | ทำซ้ำได้โดยไม่เสียหาย |
| `delay-alert-worker` | ทั้งสองได้ | ล็อกผู้นำใน Redis: มีเครื่องเดียวที่ส่ง LINE (ไม่ต้องตั้งค่าเพิ่ม) |
| `rfidc1-service` | ทั้งสองได้ **ถ้าตั้ง `RFID_LEADER_LOCK=true`** | reader รับ connection ได้ตัวเดียว — เครื่องที่ได้ล็อกเท่านั้นที่ต่อ อีกเครื่องรอรับช่วง (~30 วินาทีหลังผู้นำดับ) ถ้าไม่ตั้ง ห้ามรันสองเครื่อง |
| `print-agent` | เครื่องที่ต่อเครื่องพิมพ์เท่านั้น | ย้ายเครื่องพิมพ์ = ย้าย agent และแก้ `PRINT_AGENT_URL` |

## 4. Load balancer (ตัวอย่าง nginx — ปรับให้ตรงกับของจริงก่อนใช้)

Socket.IO เริ่มด้วย polling แล้วอัปเกรดเป็น websocket จึงต้องส่ง client คนเดิมไปเครื่องเดิม (sticky) และต้องส่งต่อ header `Upgrade`

```nginx
upstream pfcm_backend {
    ip_hash;                                   # sticky ตาม IP ผู้ใช้
    server 10.0.0.11:3000 max_fails=2 fail_timeout=10s;
    server 10.0.0.12:3000 max_fails=2 fail_timeout=10s;
}
upstream pfcm_frontend {
    server 10.0.0.11:5173;
    server 10.0.0.12:5173;
}
server {
    listen 80;
    location /socket.io/ {
        proxy_pass http://pfcm_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 3600s;
    }
    location /api/ {
        proxy_pass http://pfcm_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 120s;                # มากกว่า DB_REQUEST_TIMEOUT_MS
    }
    location / { proxy_pass http://pfcm_frontend; }
}
```

- health check ที่ถูกต้องคือ `GET /health/ready` (200 = ต่อ DB ได้) — **ไม่นับ Redis** เพื่อไม่ให้ Redis ล่มแล้ว LB ถอดทุกเครื่องพร้อมกัน nginx ฟรีไม่มี active check จึงใช้ `max_fails` (passive); ต้องการ active check ใช้ nginx Plus / HAProxy / IIS ARR
- ตั้ง `TRUST_PROXY=1` เพื่อให้ rate limit และ log เห็น IP ผู้ใช้จริง

## 5. Redis และ SQL Server
- **Redis ร่วมตัวเดียว** คือจุดล้มใหม่ แต่โค้ดทนแล้ว: Redis ล่ม → API ยังทำงาน, `realtime` ข้าม worker/เครื่องและ rate limit ร่วมหยุดชั่วคราว, ต่อใหม่เองเมื่อกลับมา (ทดสอบแล้ว) ต้องการให้ Redis เองซ้ำซ้อนจริง ใช้ Redis Sentinel/Cluster ซึ่งโค้ดยังไม่ได้รองรับ (ต้องปรับ `lib/redisClient.js`)
- **SQL Server** เครื่องเดียวยังเป็นจุดล้ม ถ้ามี Always On ให้ตั้ง `DB_SERVER` เป็นชื่อ listener + `DB_MULTI_SUBNET_FAILOVER=true`; โค้ดต่อ DB ใหม่เองหลัง failover (retry 3 ครั้ง, คำขอระหว่าง DB ล่มได้ 503 ทันทีไม่ค้าง)

## 6. ค่า pm2 ที่เสนอ (ยังไม่ได้แก้ — `ecosystem.config.js` ต้องมีแผนหยุดชั่วคราวตาม CLAUDE.md ข้อ 16)

ปัญหาที่เจอใน `PFCMv2-backend` และค่าที่เสนอ:

| รายการ | ตอนนี้ | เสนอ | เหตุผล |
|---|---|---|---|
| `max_restarts` | `5` | `50` พร้อม `min_uptime: '10s'` | crash 5 ครั้งแล้ว pm2 หยุดแอปถาวร |
| `exp_backoff_restart_delay` | ไม่มี | `200` | หน่วงเพิ่มเอง กัน crash-loop ถี่ |
| `max_memory_restart` | `2048M` | `900M` | `--max-old-space-size=1024` ทำให้ Node ตาย (OOM) ก่อนถึง 2 GB; ให้ pm2 รีสตาร์ตก่อน |
| `out_file` / `error_file` | `NUL` | `./logs/backend-out.log` / `./logs/backend-error.log` | ตอนนี้ log (รวม JSON ที่เพิ่ม) หายหมด; CLAUDE.md หัวข้อ 13 ระบุไฟล์เหล่านี้ไว้แล้ว |

ขั้นตอนที่แนะนำ:
1. แจ้งผู้ใช้ช่วงหยุดสั้นๆ (เลือกนอกกะ) · ติดตั้งตัวหมุนไฟล์ log: `pm2 install pm2-logrotate` (`pm2 set pm2-logrotate:max_size 50M`, `pm2 set pm2-logrotate:retain 14`)
2. แก้ `ecosystem.config.js` ตามตาราง แล้ว `pm2 reload ecosystem.config.js --only PFCMv2-backend` (ห้าม `pm2 restart all`)
3. ตรวจ `pm2 logs PFCMv2-backend --lines 50` และ `GET /health/ready`
4. **ถอยกลับ**: `git checkout -- backend/ecosystem.config.js` แล้ว `pm2 reload ecosystem.config.js --only PFCMv2-backend`
5. หลังแก้: `pm2 save` และตรวจว่าเครื่องกลับมารันเองหลัง reboot (Windows: pm2-windows-startup / Task Scheduler)

## 7. รายการทดสอบก่อนใช้จริง (ทำนอกกะ)
1. ทั้งสองเครื่องเปิดอยู่: ผู้ใช้สองคนต่อคนละเครื่อง บันทึกข้อมูลในหน้า Sheet แล้วอีกคนเห็นภายในไม่กี่วินาที (พิสูจน์ว่า Redis ร่วมทำงาน)
2. ปิด backend เครื่อง A: ผู้ใช้ยังใช้งานต่อได้ (หน้าอาจต้องต่อ socket ใหม่ ~ไม่กี่วินาที); `pm2 logs` ของ B ไม่มี error ต่อเนื่อง
3. RFID: ปิด `rfidc1-service` เครื่องที่ถือล็อก → อีกเครื่องรับช่วงต่อภายใน ~30–40 วินาที (ดู log `leader_acquired`) แล้วสแกนรถเข็นทดสอบ
4. หยุด Redis 1 นาที: API ยังตอบ, ไม่มี worker ตาย (`pm2 list` ไม่มีรีสตาร์ต), log มี `redis_error` ไม่เกิน 1 บรรทัดต่อ 30 วินาที; เปิดกลับแล้วมี `redis_ready`
5. LINE: ยืนยันว่ามีข้อความ delay ชุดเดียว ไม่ซ้ำสองชุด
