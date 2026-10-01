# PFCM Infrastructure Flow Documentation

> ระบบ PFCM (Production Facility Control Management) — i-Tail Corporation  
> สภาพแวดล้อม: Windows VM Production · PM2 · Node.js Cluster · React/Vite Dev Server · MSSQL · Redis  
> อัปเดต: พฤษภาคม 2569

---

## สารบัญ

1. [ภาพรวม Infrastructure](#1-ภาพรวม-infrastructure)
2. [Runtime Architecture Diagram](#2-runtime-architecture-diagram)
3. [Deployment Flow](#3-deployment-flow)
4. [Boot / Restart Flow](#4-boot--restart-flow)
5. [Request Lifecycle (HTTP)](#5-request-lifecycle-http)
6. [Frontend Serving Flow](#6-frontend-serving-flow)
7. [Backend Processing Flow](#7-backend-processing-flow)
8. [Database Connection Flow](#8-database-connection-flow)
9. [Redis & Socket.IO Flow](#9-redis--socketio-flow)
10. [PM2 Process Management Flow](#10-pm2-process-management-flow)
11. [Network Communication Flow](#11-network-communication-flow)
12. [Failure & Recovery Flow](#12-failure--recovery-flow)
13. [Logging & Monitoring Flow](#13-logging--monitoring-flow)
14. [Security Architecture](#14-security-architecture)
15. [Bottlenecks & Risk Points](#15-bottlenecks--risk-points)
16. [Recommended Improvements](#16-recommended-improvements)

---

## 1. ภาพรวม Infrastructure

### สภาพแวดล้อมการ Deploy

| องค์ประกอบ | รายละเอียด |
|---|---|
| **Platform** | Windows VM (On-Premise Factory Network) |
| **Server IP** | `172.48.0.115` |
| **Process Manager** | PM2 (ไม่มี Docker / Kubernetes) |
| **Frontend** | React 19 + Vite 5 — รัน Dev Server (ไม่ใช่ Static Build) |
| **Backend** | Node.js + Express — Cluster Mode |
| **Database** | MSSQL at `172.48.0.115:1433` |
| **Cache / PubSub** | Redis Windows Service at `172.48.0.115:6379` |
| **RFID Reader** | TCP Socket ที่ `10.246.145.182:49152` |
| **Reverse Proxy** | ไม่มี (ไม่มี Nginx / IIS เป็น Proxy) |

### Port Mapping

| Service | Port | Protocol |
|---|---|---|
| Backend API | `3000` | HTTP |
| Frontend Dev Server | `5173` | HTTP |
| Redis | `6379` | TCP |
| MSSQL | `1433` | TCP |
| RFID Reader | `49152` | Raw TCP |

---

## 2. Runtime Architecture Diagram

```mermaid
graph TB
    subgraph FACTORY_NETWORK["Factory Network (172.48.0.x / 10.10.x.x / 192.168.x.x)"]
        CLIENT[("Browser<br/>Clients")]
        RFID_DEVICE["RFID Reader<br/>10.246.145.182:49152"]
    end

    subgraph WINDOWS_VM["Windows VM — 172.48.0.115"]
        subgraph PM2["PM2 Process Manager"]
            subgraph CLUSTER["Backend Cluster (numCPUs Workers)"]
                PRIMARY["Primary Process<br/>(Cluster Master + HTTP Server)"]
                W1["Worker 1<br/>Express App"]
                W2["Worker 2<br/>Express App"]
                WN["Worker N<br/>Express App"]
                PRIMARY -->|"fork + sticky<br/>@socket.io/sticky"| W1
                PRIMARY -->|"fork + sticky"| W2
                PRIMARY -->|"fork + sticky"| WN
            end
            RESET["reset-rsrv-worker<br/>(fork, 1 instance)<br/>cron: every 1 min"]
            RFID["rfid-reader<br/>(fork, 1 instance)<br/>MUST be single instance"]
            FRONTEND["PFCMv2-frontend-dev<br/>(fork, 1 instance)<br/>npm run dev -- :5173"]
        end

        subgraph SERVICES["Windows Services"]
            REDIS_SVC["Redis Windows Service<br/>:6379"]
            MSSQL_SVC["MSSQL Server<br/>:1433"]
        end
    end

    CLIENT -->|"HTTP :5173"| FRONTEND
    CLIENT -->|"HTTP :3000 / WS"| PRIMARY
    PRIMARY -->|"pub/sub"| REDIS_SVC
    W1 -->|"pub/sub"| REDIS_SVC
    W2 -->|"pub/sub"| REDIS_SVC
    WN -->|"pub/sub"| REDIS_SVC
    W1 -->|"SQL queries"| MSSQL_SVC
    W2 -->|"SQL queries"| MSSQL_SVC
    WN -->|"SQL queries"| MSSQL_SVC
    RESET -->|"SQL UPDATE"| MSSQL_SVC
    RFID -->|"TCP :49152"| RFID_DEVICE
    RFID -->|"SQL INSERT"| MSSQL_SVC
```

**หมายเหตุ:** Frontend ไม่ผ่าน Backend — Browser เชื่อมต่อ Frontend Dev Server (`:5173`) และ Backend API (`:3000`) โดยตรงแยกกัน

---

## 3. Deployment Flow

```mermaid
flowchart TD
    DEV["นักพัฒนา<br/>แก้ไข Code"] --> PUSH["Push / Copy ไฟล์<br/>ไปยัง Windows VM"]
    PUSH --> STOP["pm2 stop all<br/>(หรือ pm2 reload)"]
    STOP --> INSTALL["npm install<br/>(ถ้ามี dependency ใหม่)"]
    INSTALL --> START["pm2 start ecosystem.config.js<br/>(หรือ pm2 reload ecosystem.config.js)"]
    START --> CHECK["pm2 status<br/>ตรวจสอบ process ทั้งหมด"]
    CHECK --> OK{ทุก process<br/>status = online?}
    OK -->|Yes| DONE["ระบบพร้อมใช้งาน"]
    OK -->|No| LOGS["pm2 logs <app-name><br/>ตรวจสอบ error"]
    LOGS --> FIX["แก้ไข Code / Config"]
    FIX --> STOP

    subgraph NOTE["หมายเหตุ"]
        N1["ไม่มี CI/CD pipeline<br/>Deploy ด้วย manual copy"]
        N2["Frontend ไม่ต้อง build<br/>รัน dev server โดยตรง"]
        N3["Backend cluster reload<br/>ไม่ downtime (0-downtime reload)"]
    end
```

### ขั้นตอน Deploy ทีละขั้น

```
1. หยุด / Reload PM2:
   pm2 reload ecosystem.config.js --update-env

2. ตรวจสอบ:
   pm2 status
   pm2 logs PFCMv2-backend --lines 50

3. ถ้า reload ล้มเหลว:
   pm2 restart ecosystem.config.js

4. ตรวจสอบ Redis (Windows Service):
   services.msc → Redis → Ensure "Running"

5. ตรวจสอบ MSSQL:
   services.msc → SQL Server → Ensure "Running"
```

---

## 4. Boot / Restart Flow

```mermaid
sequenceDiagram
    participant OS as Windows OS Boot
    participant PM2 as PM2 Daemon
    participant REDIS as Redis Service
    participant MSSQL as MSSQL Service
    participant BE as Backend Workers
    participant FE as Frontend Dev Server
    participant DB as db.js Pool

    OS->>REDIS: Windows Service Auto-Start
    OS->>MSSQL: Windows Service Auto-Start
    OS->>PM2: pm2-startup (auto-start after reboot)
    PM2->>BE: start PFCMv2-backend (cluster mode)
    BE->>DB: connectToDatabase() — retry 5× (5s interval)
    DB-->>BE: Pool connected (min=20 connections)
    BE->>REDIS: createAdapter() — Socket.IO Redis adapter
    REDIS-->>BE: Adapter ready
    PM2->>FE: start PFCMv2-frontend-dev (npm run dev)
    FE-->>FE: Vite dev server bound to 172.48.0.115:5173
    PM2->>PM2: start reset-rsrv-worker (fork)
    PM2->>PM2: start rfid-reader (fork)

    Note over BE,REDIS: ถ้า Redis ยังไม่พร้อม — adapter จะ retry<br/>ถ้า MSSQL ยังไม่พร้อม — db.js จะ retry 5 ครั้ง
    Note over PM2: pm2 save → บันทึก process list<br/>pm2 startup → ลงทะเบียน Windows startup
```

### Recovery หลัง Crash

```mermaid
flowchart LR
    CRASH["Process Crash"] --> PM2_DETECT["PM2 ตรวจจับ<br/>process หยุด"]
    PM2_DETECT --> RESTART["PM2 Auto-Restart<br/>(max_restarts: default)"]
    RESTART --> RECONNECT["Worker reconnect<br/>ไปยัง MSSQL + Redis"]
    RECONNECT --> ONLINE["Process = online"]

    CRASH2["MSSQL / Redis Crash"] --> POOL_ERR["Connection Pool Error<br/>/ Adapter Error"]
    POOL_ERR --> RETRY["db.js retry 5× (5s each)<br/>Redis adapter retry built-in"]
    RETRY --> RECONNECT2["Service กลับมา → reconnect"]
```

---

## 5. Request Lifecycle (HTTP)

```mermaid
sequenceDiagram
    participant BR as Browser
    participant BE as Backend :3000
    participant RL as Rate Limiter
    participant CORS as CORS Middleware
    participant COMP as Compression
    participant AUTH as Auth Check
    participant ROUTE as Route Handler
    participant DB as MSSQL Pool
    participant RESP as Response

    BR->>BE: HTTP Request (e.g. GET /api/trolleys)
    BE->>CORS: Check Origin
    alt Origin ไม่ใช่ internal IP
        CORS-->>BR: 403 Forbidden
    end
    BE->>RL: Check Rate Limit (3000 req/15min)
    alt IP ภายใน (192.168.*, 10.*, 172.*)
        RL-->>BE: Skip rate limit
    else เกิน limit
        RL-->>BR: 429 Too Many Requests
    end
    BE->>COMP: gzip compression (>1KB, level 6)
    BE->>AUTH: ตรวจสอบ session / bcrypt
    alt ไม่มีสิทธิ์
        AUTH-->>BR: 401 Unauthorized
    end
    BE->>ROUTE: Route Handler
    ROUTE->>DB: SQL Query (via connection pool)
    DB-->>ROUTE: Result
    ROUTE->>RESP: { success: true, data: [], message: "" }
    RESP->>RESP: Cache-Control: no-store
    RESP-->>BR: JSON Response (compressed if >1KB)
```

### Middleware Stack (เรียงลำดับ)

```
1. Compression (gzip level 6, threshold 1KB)
2. CORS (whitelist: 10.10.x.x, 192.168.x.x, 172.48.x.x)
3. Rate Limiter (3000 req/15min — skip internal IPs)
4. Body Parser JSON (limit: 5MB)
5. Body Parser URL-encoded (limit: 5MB, extended: true)
6. Cache-Control: no-store (all responses)
7. Static Files (ถ้ามี)
8. Route Handlers
9. Error Handler (catch-all)
```

---

## 6. Frontend Serving Flow

```mermaid
flowchart TD
    subgraph VITE["Vite Dev Server — :5173"]
        VITE_ENTRY["index.html<br/>entry point"]
        HMR["Hot Module Replacement<br/>(HMR WebSocket)"]
        BUNDLE["Bundle Splitting<br/>react-vendor / charts-vendor<br/>lodash-vendor / axios-vendor"]
    end

    subgraph REACT["React App (Browser)"]
        ROUTER["React Router DOM<br/>lazy-loaded routes"]
        AXIOS["Axios<br/>→ API :3000"]
        SOCKETIO_CLIENT["Socket.IO Client<br/>→ WS :3000"]
    end

    BR["Browser"] -->|"GET :5173"| VITE_ENTRY
    VITE_ENTRY -->|"serve JS modules"| BUNDLE
    BUNDLE -->|"load"| ROUTER
    ROUTER -->|"HTTP calls"| AXIOS
    ROUTER -->|"WebSocket"| SOCKETIO_CLIENT
    HMR -.->|"dev only: hot reload"| BR

    subgraph NOTE2["การตั้งค่า Vite"]
        V1["host: 172.48.0.115 (bind ที่ IP นี้เท่านั้น)"]
        V2["port: 5173, strictPort: true"]
        V3["target ES2020"]
        V4["optimizeDeps: socket.io-client, @mui/material"]
    end
```

**หมายเหตุสำคัญ:** Frontend รันเป็น **Dev Server** (ไม่ใช่ production build) — หมายความว่า:
- Source maps พร้อมใช้งาน (อาจเปิดเผย source code)
- HMR WebSocket ทำงานในระบบ production
- Performance ต่ำกว่า static build ประมาณ 30-50%

---

## 7. Backend Processing Flow

```mermaid
flowchart TD
    subgraph PRIMARY_PROC["Primary Process (Cluster Master)"]
        HTTP_SERVER["HTTP Server<br/>:3000"]
        STICKY["@socket.io/sticky<br/>Sticky Session Router"]
        CLUSTER_MOD["Node.js cluster module<br/>Worker Manager"]
    end

    subgraph WORKERS["Worker Processes (N = numCPUs)"]
        subgraph W1["Worker 1"]
            APP1["Express App"]
            SOCKET1["Socket.IO Instance"]
            ROUTES1["Route Handlers"]
        end
        subgraph W2["Worker 2"]
            APP2["Express App"]
            SOCKET2["Socket.IO Instance"]
            ROUTES2["Route Handlers"]
        end
    end

    subgraph SHARED["Shared Resources"]
        MSSQL["MSSQL Connection Pool<br/>min=20, max=2000"]
        REDIS_ADAPTER["Redis Adapter<br/>Socket.IO pub/sub"]
    end

    HTTP_SERVER -->|"HTTP requests"| STICKY
    STICKY -->|"consistent routing<br/>by client IP hash"| W1
    STICKY -->|"consistent routing"| W2
    CLUSTER_MOD -->|"fork + manage"| W1
    CLUSTER_MOD -->|"fork + manage"| W2
    APP1 --> ROUTES1
    APP2 --> ROUTES2
    ROUTES1 --> MSSQL
    ROUTES2 --> MSSQL
    SOCKET1 --> REDIS_ADAPTER
    SOCKET2 --> REDIS_ADAPTER
    REDIS_ADAPTER -->|"broadcast across workers"| SOCKET1
    REDIS_ADAPTER -->|"broadcast across workers"| SOCKET2
```

### ทำไมต้องมี Sticky Sessions?

Socket.IO ต้องการให้ client เชื่อมต่อ worker เดิมเสมอ เพราะ:
- WebSocket handshake เก็บ state ใน memory ของ worker นั้น
- ถ้า request ไปผิด worker → `sid not found` error → disconnect

`@socket.io/sticky` แก้ปัญหาโดย hash IP ของ client → routing ไปที่ worker เดิมเสมอ

---

## 8. Database Connection Flow

```mermaid
sequenceDiagram
    participant APP as Worker Process
    participant DBJ as db.js (Singleton)
    participant POOL as MSSQL Connection Pool
    participant DB as MSSQL Server :1433

    APP->>DBJ: connectToDatabase()
    alt Pool ยังไม่ได้สร้าง
        DBJ->>POOL: new sql.ConnectionPool(config)
        Note over DBJ,POOL: config: server=172.48.0.115<br/>min=20, max=2000<br/>idleTimeout=30s
        POOL->>DB: เปิด connection (min 20 connections)
        DB-->>POOL: Connection established
        POOL-->>DBJ: Pool ready
        DBJ-->>APP: return pool
    else Pool มีอยู่แล้ว (Singleton)
        DBJ-->>APP: return existing pool
    end

    APP->>POOL: pool.request().query(sql)
    POOL->>DB: Execute SQL
    DB-->>POOL: Result set
    POOL-->>APP: RecordSet

    Note over DBJ: ถ้า connect ล้มเหลว: retry 5 ครั้ง<br/>(5 วินาที ต่อครั้ง)<br/>ถ้าหมด retry: return null (ไม่ process.exit)
```

### การตั้งค่า Connection Pool

```
Pool Configuration:
  server:          172.48.0.115
  database:        [PFCM DB]
  port:            1433
  user:            [from env]
  password:        [from env]
  
  pool.min:        20   ← connections พร้อมใช้เสมอ
  pool.max:        2000 ← รองรับ load สูงสุด
  idleTimeout:     30,000 ms (30 วินาที)
  
  connectTimeout:  [default mssql]
  requestTimeout:  [default mssql]
```

**ความเสี่ยง:** `max=2000` สูงมาก — MSSQL อาจไม่รองรับ connections มากขนาดนี้พร้อมกัน

---

## 9. Redis & Socket.IO Flow

```mermaid
flowchart TD
    subgraph CLIENTS["Browser Clients"]
        C1["Client A<br/>→ Worker 1"]
        C2["Client B<br/>→ Worker 2"]
        C3["Client C<br/>→ Worker 1"]
    end

    subgraph WORKERS2["Backend Workers"]
        WK1["Worker 1<br/>Socket.IO"]
        WK2["Worker 2<br/>Socket.IO"]
    end

    subgraph REDIS2["Redis :6379"]
        PUB["Publisher Channel"]
        SUB["Subscriber Channel"]
    end

    C1 -->|"WS connected"| WK1
    C2 -->|"WS connected"| WK2
    C3 -->|"WS connected"| WK1

    WK1 -->|"io.emit('event')"| PUB
    PUB -->|"broadcast"| SUB
    SUB -->|"deliver to all workers"| WK1
    SUB -->|"deliver to all workers"| WK2
    WK1 -->|"emit to C1, C3"| C1
    WK2 -->|"emit to C2"| C2

    subgraph IDLE["Idle Timeout Logic (ใน Socket.IO)"]
        HB["Heartbeat ทุก 20 วินาที"]
        WARN["18 นาที → แจ้งเตือน<br/>'idle_warning' event"]
        DISC["20 นาที → Disconnect<br/>'idle_timeout' event"]
        HB --> WARN --> DISC
    end

    subgraph RECOVERY["Connection State Recovery"]
        CR["maxDisconnectionDuration: 2 min<br/>ถ้า reconnect ภายใน 2 นาที<br/>→ ไม่สูญเสีย room / state"]
    end
```

### Socket.IO Events ที่สำคัญ

| Event | ทิศทาง | ความหมาย |
|---|---|---|
| `idle_warning` | Server → Client | ใกล้ timeout (18 นาที) |
| `idle_timeout` | Server → Client | Disconnect เพราะ idle (20 นาที) |
| `user_activity` | Client → Server | รีเซ็ต idle timer |
| `ping` / `pong` | Socket.IO built-in | Heartbeat ทุก 20 วินาที |

---

## 10. PM2 Process Management Flow

```mermaid
graph TD
    subgraph ECOSYSTEM["ecosystem.config.js"]
        subgraph APP1_BLOCK["PFCMv2-backend"]
            A1_MODE["mode: cluster"]
            A1_INST["instances: max (numCPUs)"]
            A1_MEM["max_memory: 2048 MB"]
            A1_NODE["--max-old-space-size=1024"]
        end
        subgraph APP2_BLOCK["reset-rsrv-worker"]
            A2_MODE["mode: fork"]
            A2_INST["instances: 1"]
            A2_MEM["max_memory: 512 MB"]
            A2_CRON["cron: ทุก 1 นาที"]
        end
        subgraph APP3_BLOCK["rfid-reader"]
            A3_MODE["mode: fork"]
            A3_INST["instances: 1 (CRITICAL)"]
            A3_MEM["max_memory: 512 MB"]
            A3_WHY["MUST single instance<br/>เพราะมี 1 TCP socket ไปหา RFID"]
        end
        subgraph APP4_BLOCK["PFCMv2-frontend-dev"]
            A4_MODE["mode: fork"]
            A4_INST["instances: 1"]
            A4_CMD["npm run dev -- :5173 --host"]
            A4_CWD["cwd: ../frontend"]
        end
    end

    PM2_DAEMON["PM2 Daemon"] --> APP1_BLOCK
    PM2_DAEMON --> APP2_BLOCK
    PM2_DAEMON --> APP3_BLOCK
    PM2_DAEMON --> APP4_BLOCK
```

### PM2 Commands ที่ใช้บ่อย

```bash
# ดู status
pm2 status
pm2 monit

# Logs
pm2 logs PFCMv2-backend --lines 100
pm2 logs rfid-reader

# Reload (0-downtime สำหรับ cluster)
pm2 reload PFCMv2-backend

# Restart (มี downtime ชั่วขณะ)
pm2 restart all

# หลัง Windows reboot
pm2 resurrect   # ถ้าตั้ง startup แล้ว
# หรือ
pm2 start ecosystem.config.js
pm2 save
```

---

## 11. Network Communication Flow

```mermaid
graph LR
    subgraph FACTORY["Factory Network"]
        TABLET["Tablet / PC<br/>192.168.x.x / 10.10.x.x"]
        BARCODE["Barcode Scanner<br/>(USB → Browser)"]
        RFID_HW["RFID Reader HW<br/>10.246.145.182:49152"]
    end

    subgraph SERVER["Windows VM 172.48.0.115"]
        FE_PORT[":5173 Frontend"]
        API_PORT[":3000 API + WS"]
        REDIS_PORT[":6379 Redis (Internal only)"]
        MSSQL_PORT[":1433 MSSQL (Internal only)"]
    end

    TABLET -->|"HTTP :5173"| FE_PORT
    TABLET -->|"HTTP / WS :3000"| API_PORT
    BARCODE -.->|"เชื่อมต่อผ่าน Browser"| TABLET
    RFID_HW <-->|"TCP Raw Socket"| SERVER

    subgraph FIREWALL["Firewall / Access Control"]
        CORS_NOTE["CORS: Whitelist<br/>10.10.x.x<br/>192.168.x.x<br/>172.48.x.x"]
        RATE_NOTE["Rate Limit: 3000/15min<br/>(skip internal IPs)"]
        INTERNAL["Redis + MSSQL<br/>ไม่เปิดสู่ภายนอก<br/>(internal network only)"]
    end
```

### การไหลของข้อมูล RFID

```mermaid
sequenceDiagram
    participant RFID_HW as RFID Reader HW<br/>10.246.145.182:49152
    participant RFID_SVC as rfid-reader Process<br/>(fork, single instance)
    participant DB2 as MSSQL Direct Connection<br/>(hardcoded credentials)

    RFID_HW->>RFID_SVC: Raw TCP data (RFID tag)
    RFID_SVC->>RFID_SVC: Parse tag data
    RFID_SVC->>DB2: INSERT / UPDATE SQL
    DB2-->>RFID_SVC: OK

    Note over RFID_SVC,DB2: ⚠️ ใช้ connection ตรง (ไม่ใช้ db.js pool)<br/>⚠️ Credentials hardcoded ใน RFIDc1.js<br/>   user: PFCM_v1.9, server: 172.48.0.115
```

---

## 12. Failure & Recovery Flow

```mermaid
flowchart TD
    subgraph FAILURES["ประเภท Failure"]
        F1["Worker Process Crash"]
        F2["MSSQL Connection Lost"]
        F3["Redis Connection Lost"]
        F4["RFID TCP Disconnect"]
        F5["Windows VM Reboot"]
        F6["PM2 Daemon Crash"]
    end

    F1 -->|"PM2 auto-restart"| R1["Worker restart<br/>→ reconnect pool + Redis"]
    
    F2 -->|"db.js retry 5×"| R2{ภายใน 5 ครั้ง?}
    R2 -->|Yes| R2A["Pool reconnected"]
    R2 -->|No| R2B["return null<br/>→ route handler ต้องจัดการ null"]

    F3 -->|"Redis adapter retry"| R3["Socket.IO adapter reconnect<br/>Workers ยังทำงานได้<br/>แต่ emit ข้าม worker ไม่ได้"]

    F4 -->|"TCP error event"| R4["rfid-reader process<br/>พยายาม reconnect<br/>PM2 restart ถ้า crash"]

    F5 -->|"Windows startup"| R5["Redis Service auto-start<br/>MSSQL Service auto-start<br/>PM2 resurrect (ถ้าตั้งค่าแล้ว)"]

    F6 -->|"ต้อง manual"| R6["pm2 resurrect<br/>หรือ pm2 start ecosystem.config.js"]
```

### Graceful Shutdown Flow

```mermaid
sequenceDiagram
    participant OS as OS / PM2
    participant SRV as Server Process
    participant SOCKETS as Active Sockets
    participant POOL as DB Pool

    OS->>SRV: SIGTERM หรือ SIGINT
    SRV->>SOCKETS: ปิด Socket ทั้งหมด
    SOCKETS-->>SRV: Sockets closed
    SRV->>SRV: server.close() — หยุดรับ request ใหม่
    SRV->>POOL: pool.close() — ปิด DB connections
    SRV-->>OS: process.exit(0)

    Note over SRV: ถ้าภายใน 10 วินาที ยังไม่เสร็จ<br/>→ process.exit(1) force exit
```

---

## 13. Logging & Monitoring Flow

```mermaid
flowchart TD
    subgraph SOURCES["Log Sources"]
        BE_LOG["Backend Workers<br/>console.log / console.error"]
        FE_LOG["Frontend Dev Server<br/>Vite output"]
        RESET_LOG["reset-rsrv-worker<br/>console.log"]
        RFID_LOG["rfid-reader<br/>console.log"]
    end

    subgraph PM2_LOGS["PM2 Log Management"]
        PM2_OUT["~/.pm2/logs/<app>-out.log<br/>(stdout)"]
        PM2_ERR["~/.pm2/logs/<app>-error.log<br/>(stderr)"]
    end

    subgraph MONITORING["Monitoring Tools"]
        PM2_MON["pm2 monit<br/>(CPU, Memory, Restarts)"]
        PM2_STATUS["pm2 status<br/>(Process Status)"]
        WIN_TASK["Windows Task Manager<br/>(OS-level)"]
    end

    BE_LOG --> PM2_OUT
    BE_LOG --> PM2_ERR
    FE_LOG --> PM2_OUT
    RESET_LOG --> PM2_OUT
    RFID_LOG --> PM2_OUT
    PM2_OUT --> PM2_MON
    PM2_ERR --> PM2_MON
    PM2_STATUS --> MONITORING
    WIN_TASK --> MONITORING
```

### Log Commands

```bash
# ดู log แบบ real-time
pm2 logs

# ดู log เฉพาะ app
pm2 logs PFCMv2-backend --lines 200

# ดู error เฉพาะ
pm2 logs PFCMv2-backend --err

# ล้าง log
pm2 flush

# Monitor CPU/Memory
pm2 monit
```

**ข้อจำกัด:** ไม่มีระบบ centralized logging (เช่น ELK, Datadog) — log อยู่ในไฟล์ local บน VM เท่านั้น

---

## 14. Security Architecture

```mermaid
graph TD
    subgraph NETWORK_SEC["Network Security"]
        CORS2["CORS Whitelist<br/>10.10.x.x / 192.168.x.x / 172.48.x.x<br/>→ Block external requests"]
        RATE2["Rate Limiting<br/>3000 req/15min<br/>→ Skip internal IPs"]
        NO_PROXY["ไม่มี Reverse Proxy<br/>→ Port เปิดตรงจาก Node.js"]
    end

    subgraph APP_SEC["Application Security"]
        AUTH2["Authentication<br/>Session-based (ไม่ใช่ JWT)<br/>Bcrypt password hashing"]
        CACHE2["Cache-Control: no-store<br/>→ ป้องกัน cache sensitive data"]
        BODY2["Body Size Limit: 5MB<br/>→ ป้องกัน payload flooding"]
        HTTPS_NOTE["⚠️ ไม่มี HTTPS<br/>→ HTTP เท่านั้น"]
    end

    subgraph CRITICAL_ISSUES["⚠️ ปัญหาด้าน Security ที่พบ"]
        CRED1["RFIDc1.js: Hardcoded credentials<br/>user: PFCM_v1.9<br/>password: 987654321.Com<br/>→ ควรย้ายไป .env"]
        CRED2["RFID ใช้ direct DB connection<br/>ไม่ผ่าน shared pool<br/>→ ไม่สามารถ rotate credentials ได้ง่าย"]
        DEV_SERVER["Frontend รัน Dev Server<br/>→ Source maps เปิดเผย code<br/>→ HMR WebSocket ทำงาน"]
    end
```

### Security Summary

| รายการ | สถานะ | ความเสี่ยง |
|---|---|---|
| CORS Whitelist | ✅ ดี | ต่ำ |
| Rate Limiting | ✅ ดี | ต่ำ |
| Bcrypt Passwords | ✅ ดี | ต่ำ |
| HTTPS | ❌ ไม่มี | สูง |
| Hardcoded Credentials | ❌ มีใน RFIDc1.js | สูง |
| Frontend Dev Server ใน Production | ⚠️ ควรเปลี่ยน | กลาง |
| JWT / Token-based Auth | ❌ ใช้ Session | กลาง |
| Centralized Secret Management | ❌ ไม่มี | กลาง |

---

## 15. Bottlenecks & Risk Points

```mermaid
graph TD
    subgraph BOTTLENECKS["จุดที่อาจเป็น Bottleneck"]
        BN1["MSSQL Pool max=2000<br/>⚠️ SQL Server อาจไม่รองรับ<br/>connection มากขนาดนี้"]
        BN2["Frontend Dev Server<br/>⚠️ ช้ากว่า static build<br/>และมี overhead สูง"]
        BN3["Single Redis Instance<br/>⚠️ Redis ล่ม → Socket.IO<br/>ข้าม worker ไม่ได้"]
        BN4["rfid-reader hardcoded IP<br/>⚠️ ย้าย RFID device → ระบบหยุด"]
        BN5["ไม่มี Load Balancer ภายนอก<br/>⚠️ Single point of failure<br/>ถ้า VM ล่ม"]
        BN6["PM2 บน Windows<br/>⚠️ pm2-startup สำหรับ Windows<br/>อาจไม่ reliable เท่า Linux systemd"]
    end

    subgraph RISKS["ความเสี่ยง"]
        R_DATA["ข้อมูลสูญหาย<br/>ถ้า VM crash ก่อน commit"]
        R_SCALE["Scale ไม่ได้<br/>ถ้าต้องการ VM มากกว่า 1 ตัว"]
        R_SEC["ข้อมูล DB credentials<br/>ถูก expose ถ้า code หลุด"]
        R_DISK["Log ไม่มี rotation<br/>อาจทำให้ disk เต็ม"]
    end
```

### ตาราง Risk Assessment

| ความเสี่ยง | ระดับ | ผลกระทบ |
|---|---|---|
| VM เดียว (no redundancy) | สูงมาก | ระบบทั้งหมดหยุด |
| Hardcoded DB credentials ใน RFIDc1.js | สูง | Credential leak |
| ไม่มี HTTPS | สูง | Data ถูก intercept |
| Frontend Dev Server ใน Production | กลาง | Performance + Source leak |
| Redis single instance | กลาง | Socket.IO cross-worker fail |
| Log ไม่มี rotation | กลาง | Disk เต็ม |
| Pool max=2000 | กลาง | MSSQL connection limit |
| ไม่มี DB backup automation | สูง | ข้อมูลสูญหายถาวร |

---

## 16. Recommended Improvements

```mermaid
flowchart TD
    subgraph PRIORITY_HIGH["Priority: สูง (ทำก่อน)"]
        P1["1. ย้าย RFID credentials<br/>จาก hardcode → .env"]
        P2["2. เปิด HTTPS<br/>ใช้ self-signed cert หรือ internal CA"]
        P3["3. ตั้ง PM2 log rotation<br/>pm2 install pm2-logrotate"]
        P4["4. ทำ MSSQL backup automation<br/>SQL Server Agent / Windows Task"]
    end

    subgraph PRIORITY_MED["Priority: กลาง (ทำต่อ)"]
        P5["5. Build Frontend เป็น Static Files<br/>npm run build → serve ด้วย nginx หรือ serve"]
        P6["6. ลด MSSQL pool max<br/>จาก 2000 → 100-200"]
        P7["7. ตั้ง Redis password<br/>requirepass ใน redis.conf"]
        P8["8. เพิ่ม Health Check Endpoint<br/>GET /health → { ok: true }"]
    end

    subgraph PRIORITY_LOW["Priority: ต่ำ (ระยะยาว)"]
        P9["9. เพิ่ม Reverse Proxy (nginx)<br/>รวม port + SSL termination"]
        P10["10. ย้าย RFID logic ไปใช้ db.js pool<br/>แทน direct connection"]
        P11["11. เพิ่ม Centralized Logging<br/>เช่น Seq, ELK, หรือ file-based rotation"]
        P12["12. Containerize ด้วย Docker<br/>เพื่อ reproducible deployment"]
    end
```

### Quick Wins (ทำได้ทันที)

```bash
# 1. ติดตั้ง PM2 log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true

# 2. ตรวจสอบ PM2 startup (Windows)
pm2 startup
pm2 save

# 3. ทดสอบ Health (เพิ่มใน server.js)
# app.get('/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }))
```

### แผนการย้าย Frontend เป็น Static Build

```
ปัจจุบัน:  PM2 รัน "npm run dev" → Vite Dev Server :5173
เป้าหมาย: npm run build → dist/ → serve ด้วย nginx หรือ "serve" package

ขั้นตอน:
1. npm run build (ใน frontend/)
2. npm install -g serve
3. serve -s dist -l 5173 --no-clipboard
4. อัป ecosystem.config.js: เปลี่ยน script จาก "npm run dev" → "serve -s dist -l 5173"

ประโยชน์:
- เร็วขึ้น ~50% (pre-bundled)
- ไม่มี source maps ใน production
- ไม่มี HMR overhead
- ลด memory ของ PM2 process นี้
```

---

## Appendix: สรุป IP และ Port ทั้งหมด

```
┌─────────────────────────────────────────────────────────┐
│              PFCM Network Map                           │
├─────────────────┬───────┬──────────┬────────────────────┤
│ Service         │ Host  │ Port     │ Protocol           │
├─────────────────┼───────┼──────────┼────────────────────┤
│ Backend API     │ VM    │ 3000     │ HTTP + WebSocket   │
│ Frontend        │ VM    │ 5173     │ HTTP               │
│ Redis           │ VM    │ 6379     │ TCP (internal)     │
│ MSSQL           │ VM    │ 1433     │ TCP (internal)     │
│ RFID Reader     │ remote│ 49152    │ Raw TCP            │
├─────────────────┼───────┼──────────┼────────────────────┤
│ Server VM       │ —     │ 172.48.0.115                  │
│ RFID Device     │ —     │ 10.246.145.182                │
│ Clients         │ —     │ 192.168.x.x / 10.10.x.x      │
└─────────────────┴───────┴──────────┴────────────────────┘
```

---
