# CLAUDE.md — PFCM Production System

> ไฟล์นี้เป็น ground truth สำหรับ AI agent ทุกตัวที่ทำงานใน codebase นี้
> อ่านให้ครบก่อนแก้ไขโค้ดใดๆ — ระบบนี้เป็น production จริง ความผิดพลาดกระทบสายการผลิต

---

## 1. Project Overview

**PFCM** (Production Facility Control Management) คือระบบจัดการการผลิตอาหารแบบ real-time สำหรับ i-Tail Corporation  
ระบบครอบคลุมทุกขั้นตอนของสายการผลิต ตั้งแต่วัตถุดิบจนถึงบรรจุภัณฑ์

**Feature หลัก:**
- ติดตามวัตถุดิบผ่าน RFID และ barcode scan ตลอด production line
- จัดการห้องเย็น (Cold Storage) พร้อม slot reservation system
- ระบบ Trolley tracking แบบ real-time ผ่าน Socket.IO
- Dashboard Supervisor สำหรับ delay tracking, rawmat management, production reporting
- Quality Control checkpoints ในทุก stage
- นำเข้า/ส่งออกข้อมูลผ่าน CSV, barcode, RFID reader
- รองรับ multi-user concurrent operations บน production floor

**Users ของระบบ:** พนักงานสายการผลิต, QC, Supervisor, Master data admin

---

## 2. Tech Stack

### Backend
| ส่วนประกอบ | เทคโนโลยี | Version |
|-----------|-----------|---------|
| Runtime | Node.js | LTS |
| Framework | Express | ^4.21.2 |
| Real-time | Socket.IO + Redis Adapter | ^4.8.1 |
| Database | Microsoft SQL Server (MSSQL) | — |
| DB Client | mssql | ^11.0.1 |
| Cache/Pub-Sub | Redis (ioredis) | ^5.6.1 |
| Process Manager | PM2 (cluster mode) | ^6.0.6 |
| Security | helmet, express-rate-limit, bcrypt | — |
| Performance | compression | ^1.8.0 |
| File Upload | multer | ^2.0.2 |
| CSV Parsing | papaparse | ^5.5.2 |
| Cron Jobs | node-cron | ^4.2.1 |
| API Docs | swagger-jsdoc + swagger-ui-express | — |

### Frontend
| ส่วนประกอบ | เทคโนโลยี | Version |
|-----------|-----------|---------|
| Framework | React | 19.0.0 |
| Build Tool | Vite | ^5.4.21 |
| Routing | React Router DOM | ^6.25.1 |
| Styling | Tailwind CSS | ^3.4.17 |
| UI Library | Material-UI (MUI) | ^6.5.0 |
| Animation | Framer Motion | ^5.6.0 |
| Charts | Chart.js + Recharts | — |
| Real-time | socket.io-client | ^4.8.1 |
| Form | React Hook Form + Yup | — |
| PDF | jsPDF + jspdf-autotable | — |
| Excel | xlsx | — |
| QR/Barcode | qr-scanner, react-qr-reader | — |
| HTTP Client | axios | ^1.13.2 |
| Font | Prompt (Thai), Kanit (Thai) | — |

---

## 3. Folder Architecture

```
PFCM/
├── backend/
│   ├── server.js              # Entry point — Express + Socket.IO + Cluster setup
│   ├── ecosystem.config.js    # PM2 process configuration (production)
│   ├── database/
│   │   └── db.js              # MSSQL connection pool singleton
│   ├── routes/                # Express route handlers (1 file = 1 domain)
│   │   ├── UserRoutes.js      # Auth, signup, user management
│   │   ├── ColdStorageRoutes.js
│   │   ├── OvenRoutes.js
│   │   ├── PackageRoutes.js
│   │   ├── PreparationRoutes.js
│   │   ├── ProductionRoutes.js
│   │   ├── ProcessRoutes.js
│   │   ├── QualityControlRoutes.js
│   │   ├── RawmatRoutes.js
│   │   ├── TrolleyRoutes.js
│   │   ├── WorkplaceRoutes.js
│   │   ├── HeaderRoutes.js
│   │   ├── Rotes.js           # General routes
│   │   └── historyService.js  # Shared history logic
│   ├── resetRSRVWorker.js     # Background worker: clear stale reservations (1 min interval)
│   ├── RFIDc1.js              # RFID reader service (fork mode only — single instance)
│   ├── autofetch.js           # Data polling service
│   └── logs/                  # PM2 log output directory
│
└── frontend/
    ├── src/
    │   ├── App.jsx            # Root router (lazy-loaded routes)
    │   ├── main.jsx           # ReactDOM entry point
    │   ├── index.css          # Global styles
    │   ├── component/         # Feature modules (domain-based structure)
    │   │   ├── ColdStorage/   # Cold storage v1 (legacy, still active)
    │   │   ├── ColdStorages/  # Cold storage v2 (universal room support)
    │   │   ├── Oven/          # Oven management
    │   │   ├── Pack/          # Packaging
    │   │   ├── Prep/          # Preparation area
    │   │   ├── QC/            # Quality control
    │   │   ├── Supervisor/    # Supervisor dashboard
    │   │   ├── Master/        # Master data management
    │   │   ├── User/          # Login, logout, workplace selection
    │   │   └── Layout/        # Shared UI: Header, Buttom, StatCard
    │   ├── services/
    │   │   └── apiService.js  # Shared API utility functions
    │   ├── hooks/
    │   │   └── useRawMatFetcher.js  # Custom hook: batch fetch raw material data
    │   ├── context/
    │   │   └── AutoFetchPage.jsx    # Page visibility + polling context
    │   ├── Popup/
    │   │   └── AlertSuccess.jsx     # Global success alert popup
    │   └── fonts/
    │       ├── thSarabunBase64.js   # Thai font for PDF export
    │       └── thSarabunBoldBase64.js
    ├── vite.config.js
    ├── tailwind.config.js
    └── .eslintrc.cjs
```

### โครงสร้างภายใน Feature Module (Frontend)

แต่ละ feature module มีโครงสร้างมาตรฐาน:

```
component/[Feature]/
├── App[Feature].jsx      # Router สำหรับ feature นี้ (lazy-loaded routes)
├── Sidebar[Feature].jsx  # Sidebar navigation
├── [SubFeature]/
│   ├── [SubFeature]Page.jsx   # Main page component
│   └── Asset/                 # Shared components ใน subfeature
│       ├── Modal*.jsx         # Dialog/Modal components
│       ├── Table*.jsx         # Table components
│       └── ParentComponent.jsx
└── Modals/                    # Room-level modal components (ห้องเย็น)
```

---

## 4. Backend Coding Standards

### Route File Pattern (Standard)

```javascript
// routes/[Domain]Routes.js
module.exports = (io) => {         // รับ io เมื่อต้องการ Socket.IO
  const express = require("express");
  const { connectToDatabase } = require("../database/db");
  const sql = require("mssql");

  const router = express.Router();

  router.get("/[domain]/[action]", async (req, res) => {
    try {
      const pool = await connectToDatabase();
      const result = await pool.request()
        .input("param", sql.NVarChar, req.query.param)  // ใช้ parameterized query เสมอ
        .query(`SELECT ... WHERE col = @param`);

      res.json({ success: true, data: result.recordset });
    } catch (err) {
      console.error("SQL error", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
};
```

### กฎการเขียน Backend

1. **ทุก route ต้องใช้ `async/await` และ `try/catch`** — ห้ามใช้ `.then()/.catch()` ใน route handlers
2. **ทุก SQL query ต้องใช้ parameterized query** — ใช้ `.input("name", type, value)` เสมอ ห้าม string interpolation
3. **getPool pattern** — เรียก `connectToDatabase()` ใน try block ของแต่ละ route (pool เป็น singleton อยู่แล้ว)
4. **Route naming** — ใช้ `/api/[domain]/[subpath]/[action]` pattern เช่น `/api/coldstorage/main/fetchSlotRawMat`
5. **Socket.IO routes** — routes ที่ต้องการ real-time ให้รับ `io` parameter ใน `module.exports = (io) => {}`
6. **ห้าม hardcode credentials** ใน source code — ใช้ `process.env` เสมอ
7. **console.error** — ใช้สำหรับ error logging เท่านั้น ไม่ใช้ console.log ใน production path
8. **Date formatting** — ใช้ `FORMAT(col, 'yyyy-MM-dd HH:mm:ss')` ใน SQL query หรือ `new Date().toLocaleString('th-TH')` ใน JS

---

## 5. Frontend Coding Standards

### Component Pattern (Standard)

```jsx
// [Feature]/[SubFeature]/[Name]Page.jsx
import Header from "../../Layout/Header";
import Buttom from "../../Layout/Buttom";
const API_URL = import.meta.env.VITE_API_URL;

const MyPage = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/domain/action`);
      setData(res.data.data);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div style={{ backgroundColor: "#..." }} className="flex-1 overflow-auto relative z-10">
      <main className="max-w-8xl mx-auto py-1 px-1 lg:px-8">
        <Header title="ชื่อหน้า" />
      </main>
      <main className="max-w-8xl mx-auto py-1 px-1 lg:px-8">
        {/* content */}
      </main>
      <main className="max-w-8xl mx-auto py-1 px-1 lg:px-8">
        <Buttom title="Copyright © 2025 i-Tail Corporation..." />
      </main>
    </div>
  );
};

export default MyPage;
```

### กฎการเขียน Frontend

1. **`const API_URL = import.meta.env.VITE_API_URL`** — ประกาศที่ระดับ module ทุกไฟล์ที่เรียก API
2. **Lazy loading** — ทุก route ใน App[Feature].jsx ต้องใช้ `lazy(() => import(...))` พร้อม `<Suspense>`
3. **Font** — ใช้ Prompt หรือ Kanit สำหรับ text ภาษาไทย ผ่าน MUI theme หรือ inline style
4. **Layout wrapper** — ทุก page ต้องมี `<Header title="...">` และ `<Buttom title="Copyright ...">` ครอบ
5. **ห้าม direct DOM manipulation** — ใช้ React state เท่านั้น
6. **Socket.IO** — ประกาศ socket ใน component หรือ context ไม่ใช่ global variable
7. **ห้าม inline function ใน JSX ที่ heavy** — แยกเป็น named function เพื่อ performance
8. **MUI + Tailwind ใช้ร่วมกันได้** — ใช้ MUI สำหรับ component structure, Tailwind สำหรับ layout/spacing

---

## 6. MSSQL Best Practices

### Connection Pool

```javascript
// ✅ ถูกต้อง — ใช้ singleton pool จาก db.js
const pool = await connectToDatabase();
const result = await pool.request()
  .input("id", sql.Int, id)
  .query("SELECT * FROM Table WHERE id = @id");

// ❌ ผิด — ห้ามสร้าง connection ใหม่ในทุก request
const pool = await mssql.connect(config);
```

### Parameterized Queries (บังคับ)

```javascript
// ✅ ถูกต้อง
pool.request()
  .input("user_id", sql.Int, userId)
  .input("name", sql.NVarChar(100), name)
  .query("UPDATE Users SET name = @name WHERE user_id = @user_id")

// ❌ ผิด — SQL injection vulnerability
pool.request().query(`SELECT * FROM Users WHERE id = ${userId}`)
```

### SQL Types ที่ใช้บ่อย

```javascript
sql.Int          // INTEGER columns
sql.NVarChar     // VARCHAR/NVARCHAR columns (ใส่ length หรือ sql.MAX)
sql.Bit          // BIT/BOOLEAN columns
sql.DateTime     // DATETIME columns
sql.Decimal(18,2) // DECIMAL columns
sql.Float        // FLOAT columns
```

### Date & Time

```sql
-- ใช้ GETDATE() สำหรับ timestamp ปัจจุบัน (server time)
-- ใช้ FORMAT() สำหรับ date formatting ใน query
FORMAT(col, 'yyyy-MM-dd HH:mm:ss') AS formatted_date
-- ใช้ DATEDIFF() สำหรับการคำนวณเวลา
DATEDIFF(MINUTE, reserved_at, GETDATE())
```

### Transaction Pattern

```javascript
const transaction = new sql.Transaction(pool);
try {
  await transaction.begin();
  const request = new sql.Request(transaction);
  await request.input("id", sql.Int, id).query("UPDATE ...");
  await request.input("id", sql.Int, id).query("INSERT ...");
  await transaction.commit();
} catch (err) {
  await transaction.rollback();
  throw err;
}
```

### กฎ MSSQL

1. **ห้ามใช้ `SELECT *`** ใน production queries — ระบุ column ที่ต้องการเสมอ
2. **ใช้ JOIN อย่างถูกต้อง** — ใส่ alias เสมอ เช่น `FROM TrolleyRMMapping rmm`
3. **Index awareness** — หลีกเลี่ยง function บน indexed column ใน WHERE clause
4. **Pool max = 30 ต่อ worker** (min 5; PM2 cluster = จำนวน core × 30 connections รวม) — อย่าเพิ่มโดยไม่ดู log `ETIMEOUT` / pool เต็มก่อน
5. **ห้าม DROP/TRUNCATE** ใน application code — ต้องทำผ่าน DBA เท่านั้น

---

## 7. API Response Conventions

### Standard Response Format

```javascript
// Success
res.status(200).json({
  success: true,
  data: result.recordset,        // Array เสมอ
  message: "ดึงข้อมูลสำเร็จ"    // optional
});

// Success (no data, mutation)
res.status(200).json({
  success: true,
  message: "บันทึกข้อมูลสำเร็จ"
});

// Client error
res.status(400).json({
  success: false,
  error: "กรุณากรอกข้อมูลให้ครบ"
});

// Auth error
res.status(401).json({
  error: "รหัสผ่านไม่ถูกต้อง"  // บางครั้งไม่มี success field ใน auth routes
});

// Server error
res.status(500).json({
  success: false,
  error: err.message
});
```

### HTTP Status Codes

| Code | ใช้เมื่อ |
|------|---------|
| 200 | GET สำเร็จ, PUT/POST mutation สำเร็จ |
| 201 | POST ที่สร้าง resource ใหม่ |
| 400 | Request ไม่ครบ / ข้อมูลไม่ถูกต้อง |
| 401 | Authentication failed |
| 404 | ไม่พบ resource |
| 500 | Server / database error |

### URL Pattern

```
GET    /api/[domain]/[subpath]/fetch[Resource]
POST   /api/[domain]/[subpath]/[action]
PUT    /api/[domain]/[subpath]/update-[resource]
DELETE /api/[domain]/[subpath]/delete-[resource]
```

ตัวอย่างจริง:
```
GET  /api/coldstorage/main/fetchSlotRawMat
PUT  /api/coldstorage/update-rsrv-slot
POST /api/login
PUT  /api/signup
```

---

## 8. Error Handling Conventions

### Backend

```javascript
// Pattern มาตรฐาน
router.get("/path", async (req, res) => {
  try {
    // validate input ก่อน
    if (!req.body.required_field) {
      return res.status(400).json({ success: false, error: "กรุณากรอกข้อมูล" });
    }

    const pool = await connectToDatabase();
    if (!pool) {
      return res.status(503).json({ success: false, error: "Database unavailable" });
    }

    const result = await pool.request()
      .input("param", sql.NVarChar, req.body.required_field)
      .query("...");

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("[Route /path] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});
```

### Frontend

```javascript
// ✅ Standard pattern
try {
  const res = await axios.get(`${API_URL}/api/...`);
  setData(res.data.data ?? []);
} catch (err) {
  console.error("ชื่อ action error:", err);
  // แสดง error state ให้ user ทราบ (ไม่ silent fail)
}

// ✅ Socket.IO error handling
socket.on("error", (err) => {
  console.error("Socket error:", err);
});

socket.on("connect_error", (err) => {
  console.error("Socket connect error:", err.message);
});
```

### กฎ Error Handling

1. **ห้าม swallow errors** — ทุก catch block ต้อง log อย่างน้อย console.error
2. **ส่ง meaningful error message** ให้ user (ภาษาไทย สำหรับ business errors)
3. **ส่ง technical error ใน `err.message`** สำหรับ server errors (ไม่ expose stack trace)
4. **ตรวจสอบ `pool` null** — `connectToDatabase()` คืนค่า null เมื่อ DB ไม่พร้อม ต้อง handle
5. **Early return pattern** — validate ก่อน DB call เสมอ

---

## 9. Security Rules

### Authentication

- ระบบใช้ **bcrypt** สำหรับ password hashing (ไม่มี JWT)
- Session state เก็บบน frontend (localStorage หรือ component state)
- ทุก API endpoint ที่ sensitive ควรมีการตรวจสอบ user identity

### Input Validation (บังคับ)

```javascript
// ตรวจสอบ required fields ก่อน DB call
const { user_id, password } = req.body;
if (!user_id || !password) {
  return res.status(400).json({ error: "กรุณากรอก user_id และ password" });
}

// ใช้ parameterized query เสมอ — ห้าม string interpolation
.input("user_id", sql.Int, parseInt(user_id))  // cast type ด้วย
```

### กฎ Security

1. **ห้าม hardcode credentials** — ใช้ `.env` เสมอ สำหรับ DB credentials, API keys, passwords
2. **ห้าม log sensitive data** — passwords, session tokens ต้องไม่ปรากฏใน logs
3. **Rate limiting** — มี built-in ที่ 3000 req/15min สำหรับ external IPs ห้ามปิด
4. **Helmet middleware** — ห้ามปิดหรือ override CSP policy โดยไม่ผ่าน security review
5. **CORS** — configured สำหรับ internal network เท่านั้น ห้ามเปิด `origin: "*"` ใน production
6. **RFID credentials** — `RFIDc1.js` อ่านจาก `process.env` แล้ว (DB_USER/DB_PASSWORD/DB_SERVER, READER_IP ฯลฯ) ห้ามกลับไป hardcode
7. **Frontend** — ห้าม expose API_URL ที่มี credentials ใน browser console
8. **SQL** — ห้ามใช้ `sa` account ใน production connection string

---

## 10. Performance Optimization Rules

### Backend

```javascript
// ✅ ใช้ SELECT เฉพาะ columns ที่ต้องการ
SELECT rmm.mapping_id, rmm.tro_id, rm.mat_name FROM TrolleyRMMapping rmm

// ❌ ห้ามใช้
SELECT * FROM TrolleyRMMapping

// ✅ Pagination สำหรับข้อมูลจำนวนมาก
.query("SELECT TOP 100 ... ORDER BY col OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY")

// ✅ Connection pool reuse — ใช้ singleton connectToDatabase()
// Pool config: min=5, max=30 ต่อ worker, idleTimeout=30s
```

### Frontend

```javascript
// ✅ Lazy loading ทุก route
const Component = lazy(() => import("./Component.jsx"));

// ✅ memo สำหรับ expensive components
const MemoTable = React.memo(({ data }) => <Table data={data} />);

// ✅ useCallback สำหรับ handlers ที่ส่งเป็น props
const handleFetch = useCallback(async () => { ... }, [dependency]);

// ✅ Limit concurrent API calls (pattern จาก useRawMatFetcher)
const CONCURRENT_LIMIT = 5;
// แบ่ง requests เป็น chunks แล้ว process ทีละ chunk
```

### Socket.IO

```javascript
// ✅ ใช้ rooms จำกัด broadcast scope
io.to(roomName).emit("event", data);      // ส่งเฉพาะ room
socket.emit("event", data);               // ส่งเฉพาะ client นั้น

// ❌ หลีกเลี่ยง broadcast ทั้ง server โดยไม่จำเป็น
io.emit("event", data);  // ใช้เมื่อ จำเป็นจริงๆ เท่านั้น

// ✅ Room-based updates
socket.join(roomName);
io.to(roomName).emit("updateFetch", {});
```

### Vite Build

- Bundle splitting กำหนดไว้แล้วใน `vite.config.js`: react, charts, lodash, axios แยก chunk
- ห้ามเพิ่ม dependency ขนาดใหญ่โดยไม่ตรวจสอบ bundle size ก่อน

---

## 11. Refactoring Guidelines

### กฎสำคัญก่อน Refactor

1. **อย่า refactor และเพิ่ม feature ในครั้งเดียวกัน** — แยก PR/commit ให้ชัดเจน
2. **ตรวจสอบ imports ทุกครั้ง** ก่อนและหลัง rename — ระบบนี้มี 1,200+ JSX files
3. **ห้าม rename route URL paths** — อาจทำให้ Sidebar navigation และ link ต่างๆ พัง
4. **ห้าม rename database column names** ใน SQL โดยไม่ update ทุก query ที่ใช้
5. **ห้าม reorganize folder structure** ใหม่ทั้งหมด — ทำ incremental เท่านั้น

### Naming Refactor ที่ทำไปแล้ว (May 2026)

โฟลเดอร์ต่อไปนี้ถูก rename แล้ว อย่านำชื่อเก่ากลับมาใช้:

| ชื่อเก่า (deprecated) | ชื่อใหม่ (ถูกต้อง) |
|----------------------|-------------------|
| `AppPerp.jsx` | `AppPrep.jsx` |
| `Assety/` | `Modals/` |
| `HistoryTranform/` | `HistoryTransform/` |
| `Carttable/` | `CartTable/` |
| `ImPortcsvFile/` | `ImportCSVFile/` |
| `checkout/` (Prep) | `CheckOut/` |
| `manage copy/` | `ManageRawmat/` |
| `ScanSAP - Copy/` | `ScanThawStart/` |
| `DelayTimeTracking copy/` | `DelayTimeTrackingDBS/` |

---

## 12. Naming Conventions

### ไฟล์และโฟลเดอร์

| ประเภท | Convention | ตัวอย่าง |
|--------|-----------|---------|
| React Component | PascalCase | `ScanSAPPage.jsx`, `CartTable.jsx` |
| React App/Router | `App[Feature].jsx` | `AppColdStorages.jsx`, `AppPrep.jsx` |
| Sidebar | `Sidebar[Feature].jsx` | `SidebarPrep.jsx`, `SidebarSup.jsx` |
| Backend Route file | `[Domain]Routes.js` | `ColdStorageRoutes.js` |
| Feature folder | PascalCase | `ColdStorage/`, `Supervisor/` |
| Asset/Modal folder | `Asset/` (shared utils), `Modals/` (modals) | — |
| Hook | `use[Name].js` | `useRawMatFetcher.js` |
| Service | `[name]Service.js` | `apiService.js`, `historyService.js` |

### ตัวแปรใน JavaScript

```javascript
// camelCase สำหรับตัวแปรและ function
const fetchRawMat = async () => {};
const trolleyData = [];

// PascalCase สำหรับ Component
const MatManagePage = () => {};

// UPPER_SNAKE_CASE สำหรับ constants
const RESERVATION_TIMEOUT_MINUTES = 5;
const IDLE_TIMEOUT = 20 * 60 * 1000;

// ตัวย่อที่ใช้ในโปรเจกต์นี้ (อย่าเปลี่ยน — มีใน DB schema ด้วย)
// rmfp = RawMat For Production
// rmm  = TrolleyRMMapping (alias)
// tro  = Trolley
// wp   = Workplace
// pos  = Position
// mat  = Material
// rm   = RawMat
// prod = Production
// eu   = Emulsion Unit
// qc   = Quality Control
// cs   = Cold Storage
// epc  = Electronic Product Code (RFID)
```

### Database

- Table names: `PascalCase` เช่น `TrolleyRMMapping`, `WorkplaceUsers`
- Column names: `snake_case` เช่น `user_id`, `tro_id`, `rm_status`
- SQL aliases: ย่อ 2-4 ตัวอักษร เช่น `rmm`, `rmf`, `p`, `rm`

### ห้ามใช้ชื่อต่อไปนี้

ห้ามตั้งชื่อโฟลเดอร์/ไฟล์ด้วย:
- `test`, `new`, `copy`, `temp`, `final`, `old`, `backup`
- ตัวเลขต่อท้าย: `page1`, `component2`, `modal3`
- ชื่อที่มีช่องว่าง หรือ `- Copy`

---

## 13. Logging Conventions

### Backend Logging

```javascript
// ✅ ใช้ prefix บอก context
console.log("🔌 Connecting to MSSQL...");
console.log("✅ Database connection successful!");
console.error("❌ [Route /api/login] Auth error:", err);
console.log(`ล้าง Slot ที่หมดอายุแล้ว (${result.rowsAffected} รายการ)`);

// ✅ Socket events
console.log(`Worker ${process.pid} started`);
console.log(`User disconnected: ${socket.id}`);

// ❌ ห้าม log sensitive data
console.log("password:", password);  // ห้าม!
console.log("DB config:", dbConfig); // ห้าม!
```

### PM2 Log Files

```
backend/logs/
├── backend-out.log    # stdout จาก server.js
├── backend-error.log  # stderr จาก server.js
├── worker-out.log     # stdout จาก resetRSRVWorker.js
├── worker-error.log   # stderr จาก resetRSRVWorker.js
├── rfid-out.log       # stdout จาก RFIDc1.js
└── rfid-error.log     # stderr จาก RFIDc1.js
```

ตรวจสอบ logs ด้วย: `pm2 logs PFCMv2-backend` หรือ `pm2 logs rfid-reader`

### กฎ Logging

1. **ไม่ log ใน hot path** — loop ที่วิ่งบ่อยๆ ห้าม console.log ทุก iteration
2. **log error พร้อม context** — ระบุ route หรือ function ที่เกิด error
3. **Emoji prefix** ช่วย grep ได้ง่าย: ✅ success, ❌ error, 🔌 connection, ⏳ waiting

---

## 14. React Hooks Best Practices

### useEffect

```javascript
// ✅ ระบุ dependency array เสมอ
useEffect(() => {
  fetchData();
}, []);  // [] = run once on mount

useEffect(() => {
  fetchData(id);
}, [id]);  // re-run เมื่อ id เปลี่ยน

// ✅ Cleanup Socket.IO ใน useEffect
useEffect(() => {
  const socket = io(API_URL);
  socket.on("updateFetch", () => fetchData());

  return () => {
    socket.off("updateFetch");
    socket.disconnect();
  };
}, []);

// ❌ ห้าม async ใน useEffect โดยตรง
useEffect(async () => { ... });  // ผิด

// ✅ แยก async function ภายใน
useEffect(() => {
  const load = async () => { await fetchData(); };
  load();
}, []);
```

### useState

```javascript
// ✅ Initial state ที่เหมาะสม
const [data, setData] = useState([]);         // array
const [item, setItem] = useState(null);       // object ที่อาจ null
const [loading, setLoading] = useState(false);
const [error, setError] = useState("");

// ✅ Functional update สำหรับ state ที่ depends on previous
setCount(prev => prev + 1);
setData(prev => [...prev, newItem]);
```

### Custom Hooks Pattern

```javascript
// hooks/use[Name].js
const useRawMatFetcher = (lines) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // batch fetch logic
    } finally {
      setLoading(false);
    }
  }, [lines]);

  return { data, loading, fetchAll };
};

export default useRawMatFetcher;
```

### กฎ Hooks

1. **ใช้ hooks ตาม rules of hooks** — ห้ามเรียกใน conditional หรือ loop
2. **Socket cleanup** — disconnect socket ใน useEffect cleanup เสมอ
3. **Loading state** — แสดง loading indicator ระหว่าง fetch เสมอ (user ใช้บน production floor)
4. **Error state** — เก็บ error state แยกจาก data state

---

## 15. Express Middleware Standards

### Middleware Order ใน server.js (ห้ามเปลี่ยนลำดับ)

```javascript
// 1. Security (ต้องมาก่อนสุด)
app.use(helmet({ ... }));

// 2. Compression
app.use(compression({ level: 6 }));

// 3. Rate Limiting
app.use(limiter);

// 4. CORS
app.use(cors({ origin: [...internalIPs] }));

// 5. Body Parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 6. Routes
app.use("/api", userRoutes);
app.use("/api", coldStorageRoutes(io));
// ...

// 7. Health Check (ต้องมีเสมอ)
app.get("/health", (req, res) => res.status(200).send("OK"));

// 8. Error Handler (ต้องมาท้ายสุด)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: "Internal server error" });
});
```

### การเพิ่ม Route ใหม่

```javascript
// ใน server.js — เพิ่มหลัง routes เดิม
const NewDomainRoutes = require("./routes/NewDomainRoutes");
app.use("/api", NewDomainRoutes(io));  // ถ้าต้องการ Socket.IO
app.use("/api", NewDomainRoutes);      // ถ้าไม่ต้องการ Socket.IO
```

---

## 16. Production Safety Rules

### ห้ามทำใน Production โดยไม่มีการ backup

1. **ห้าม DROP TABLE, TRUNCATE TABLE** ใน application code หรือ manual query บน prod DB
2. **ห้าม DELETE ไม่มี WHERE clause** — ต้องระบุ condition เสมอ
3. **ห้ามแก้ไข ecosystem.config.js** โดยไม่มี downtime plan — กระทบ PM2 cluster ทั้งหมด
4. **ห้ามรัน `npm install` บน production server** โดยไม่ตรวจสอบ package-lock.json ก่อน
5. **ห้าม restart PM2 ทั้งหมดพร้อมกัน** — ใช้ `pm2 reload` แทน `pm2 restart` เพื่อ zero-downtime

### Socket.IO Cluster Constraints

```javascript
// ❌ ห้าม — จะไม่ sync ข้าม workers
io.emit("event");  // ใน cluster mode ต้องผ่าน Redis adapter

// ✅ ถูกต้อง — Redis adapter handle broadcast ข้าม workers
// Redis adapter ตั้งค่าแล้วใน server.js อย่าแก้ไข
```

### RFID Service

- **`RFIDc1.js` ต้อง run ใน fork mode เท่านั้น** — ห้ามเปลี่ยนเป็น cluster (จะ conflict กับ hardware reader)
- **RFID reader อยู่ที่ `10.246.145.182:49152`** — ห้าม connect จากหลาย process
- ถ้า RFID service crash ให้ตรวจสอบ network connectivity ก่อน restart

### Database Connection

- **Pool max = 30 ต่อ worker** (`backend/database/db.js`) — ถ้า pool exhausted ให้ตรวจสอบ connection leak / query ช้าในโค้ดก่อน เพิ่ม max เป็น last resort
- **`connectToDatabase()` คืน null** ได้เมื่อ DB ไม่พร้อม — ต้อง handle null ใน route handlers
- ห้าม call `mssql.close()` ใน route handlers — pool ต้อง persist ตลอด lifetime ของ process

---

## 17. Git Commit Conventions

### Format

```
[type]: [short description in Thai or English]

[optional body — ถ้า change ซับซ้อน]
```

### Types

| Type | ใช้เมื่อ |
|------|---------|
| `feat` | เพิ่ม feature ใหม่ |
| `fix` | แก้ bug |
| `refactor` | refactor โค้ด (ไม่เพิ่ม feature, ไม่แก้ bug) |
| `rename` | เปลี่ยนชื่อไฟล์/โฟลเดอร์ |
| `style` | แก้ formatting, CSS เท่านั้น |
| `chore` | update config, dependency, tools |
| `docs` | update documentation |
| `hotfix` | แก้ bug critical บน production |

### ตัวอย่าง

```
feat: เพิ่มหน้า Scan Thaw Start สำหรับบันทึกเวลาเริ่มละลาย
fix: แก้ไข slot reservation ไม่ reset หลัง timeout 5 นาที
refactor: rename Assety -> Modals และ update imports ทั้งหมด
chore: update mssql จาก 10 เป็น 11 และ test connection pool
hotfix: แก้ Socket.IO disconnect ใน production cluster mode
```

---

## 18. File Organization Rules

### เพิ่ม Feature ใหม่

1. **สร้าง folder ใหม่** ใต้ `component/[FeatureName]/` โดยใช้ PascalCase
2. **สร้าง `[FeatureName]Page.jsx`** เป็น main page
3. **สร้าง `Asset/` folder** สำหรับ shared components ภายใน feature
4. **สร้าง `Modals/` folder** ถ้ามี modal components หลายตัว
5. **ลงทะเบียน route** ใน `App[Domain].jsx` ของ domain นั้น
6. **เพิ่มเมนู** ใน `Sidebar[Domain].jsx`

### เพิ่ม Route Backend ใหม่

1. **เพิ่มใน route file ที่มีอยู่** ถ้า domain เดียวกัน
2. **สร้าง `[Domain]Routes.js` ใหม่** เฉพาะเมื่อ domain ใหม่จริงๆ
3. **ลงทะเบียนใน `server.js`** ทันที

### ห้ามสร้าง

- ไฟล์ที่มีชื่อซ้ำกับที่มีอยู่แล้วใน folder อื่น โดยไม่มี differentiator ที่ชัดเจน
- Folder ใหม่ภายใน `component/` ที่ไม่ผ่าน domain ที่มีอยู่

---

## 19. Rules to Avoid Breaking Existing Systems

### ก่อนแก้ไขทุกครั้ง

1. **อ่าน CLAUDE.md ฉบับนี้ให้ครบ**
2. **ตรวจสอบว่าไฟล์ที่จะแก้มี import จากไฟล์ไหนบ้าง** — ใช้ grep
3. **ทดสอบ import chain** ก่อน rename ใดๆ
4. **อย่าแก้ไข `server.js`** โดยไม่ผ่าน review — กระทบทุก process

### Critical Files (ห้ามแก้โดยไม่ระมัดระวัง)

| ไฟล์ | ผลกระทบถ้าพัง |
|------|--------------|
| `backend/server.js` | ทั้ง API + Socket.IO หยุด |
| `backend/database/db.js` | ทุก DB operation หยุด |
| `backend/ecosystem.config.js` | PM2 restart ทุก process |
| `frontend/src/App.jsx` | ทุก route พัง |
| `frontend/src/component/Layout/Header.jsx` | ทุกหน้าแสดงผิด |

### ห้ามแก้ไขโดยไม่มีแผน rollback

- Database schema (column add/rename/drop)
- Route URL paths (กระทบ navigation จาก sidebar)
- Socket.IO event names (กระทบทุก client ที่ listen event นั้น)
- PM2 ecosystem config (กระทบ production deployment)
- Redux store / global state structure (ถ้ามีในอนาคต)

### ColdStorage vs ColdStorages

ทั้งสองโมดูลนี้ **ยังคง active อยู่พร้อมกัน**:
- `ColdStorage/` → route `/coldStorage/*` — v1 ของระบบห้องเย็น (per-room pages)
- `ColdStorages/` → route `/ColdStorages/*` — v2 (universal room support, cs_id >= 10)

ห้ามลบหรือ merge ทั้งสองโดยไม่มีการ migrate users และ update routing ก่อน

---

## 20. AI Agent Behavior Instructions

### ก่อนทำงานทุกครั้ง

1. **อ่าน CLAUDE.md ฉบับนี้ก่อนเสมอ**
2. **อ่านไฟล์ที่เกี่ยวข้องก่อนแก้ไข** — ใช้ Read tool ก่อน Edit ทุกครั้ง
3. **grep หา imports** ก่อน rename ไฟล์หรือโฟลเดอร์ใดๆ
4. **ตรวจสอบว่าโฟลเดอร์ที่จะแก้มีชื่อตรงกับ naming convention ใหม่** (ดูตาราง deprecated names ด้านบน)

### สิ่งที่ AI Agent ห้ามทำ

1. **ห้าม rewrite business logic** — แก้ตาม scope ที่ได้รับเท่านั้น
2. **ห้ามเพิ่ม library ใหม่** โดยไม่ระบุใน task
3. **ห้ามสร้าง abstraction layer ใหม่** โดยไม่จำเป็น (no premature abstraction)
4. **ห้าม `DROP`, `TRUNCATE`, `DELETE` ใน SQL** โดยไม่มีการยืนยันจาก user
5. **ห้าม `git push --force`** หรือ `git reset --hard` โดยไม่มีการยืนยัน
6. **ห้าม restart production processes** โดยไม่แจ้ง user ก่อน
7. **ห้ามแก้ไข `.env` files** โดยไม่มีการยืนยัน
8. **ห้าม comment out existing code** โดยไม่ระบุเหตุผล

### สิ่งที่ AI Agent ควรทำ

1. **ใช้ TodoWrite** track งานที่มีหลายขั้นตอน
2. **บอก user ก่อนทำ risky operations** (rename หลายไฟล์, แก้ routing, แก้ server config)
3. **ตรวจสอบ imports หลัง rename ทุกครั้ง** — grep ยืนยันก่อนรายงานว่าเสร็จ
4. **อธิบายเป็นภาษาไทย** สำหรับ output ที่ user จะอ่าน
5. **ทำงาน incremental** — อย่า rename/refactor ทั้ง codebase ในครั้งเดียว
6. **ถามถ้าไม่แน่ใจ** — โดยเฉพาะเรื่อง business logic หรือ database operations
7. **Verify ก่อน report เสร็จ** — grep/read ยืนยันว่า changes ถูกต้องก่อนบอก user

### Context สำคัญที่ต้องจำ

- นี่คือ **production system** ที่ใช้จริงบน production floor ของโรงงาน
- User ส่วนใหญ่เป็น **พนักงานสายการผลิต** ที่ใช้ระบบระหว่างทำงาน
- ปัญหา runtime = สายการผลิตหยุด = ผลกระทบโดยตรงต่อธุรกิจ
- ระบบ real-time ด้วย Socket.IO — bug ใน connection handling กระทบ users ทุกคนพร้อมกัน
- RFID reader service ต้องรัน fork mode instance เดียวเสมอ — ห้ามเพิ่ม instance
- Database pool max=30 ต่อ worker — ถ้า connection leak หรือ query ช้าค้าง คำขออื่นจะรอคิวจน timeout

---

*อัปเดตล่าสุด: พฤษภาคม 2026 — หลังการทำ naming consistency refactor ครั้งแรก*
*ผู้ดูแลระบบ: ทีม PFCM Development, i-Tail Corporation*
