const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { connectToDatabase, getPoolStats } = require("./database/db");
const swaggerUI = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const helmet = require("helmet");
const compression = require("compression");
const http = require("http");
const { Server } = require("socket.io");
const cluster = require("cluster");
const os = require("os");
const { createRedis, duplicateRedis } = require("./lib/redisClient");
const { createAdapter } = require("@socket.io/redis-adapter");
const { setupMaster, setupWorker } = require("@socket.io/sticky");
const { setupPrimary } = require("@socket.io/cluster-adapter");
const { authenticate, authorize, isPrivateIp, initAuth, getAuthMode } = require("./lib/authMiddleware");
const { createLimiters, resolveTrustProxy } = require("./lib/rateLimiters");
const { verifyToken } = require("./lib/auth");
const requestObserver = require("./lib/requestObserver");
const metrics = require("./lib/metrics");
const logger = require("./lib/logger");
const { startAlerts } = require("./lib/alerts");
const rfidScanTriggerRoutes = require('./routes/rfidScanTrigger');
const rfidReaderConfigRoutes = require('./routes/rfidReaderConfig');
// const { getLatestData } = require("./autofetch");

// Load environment variables early
dotenv.config();
require("./lib/processGuards").installProcessGuards(`server:${process.pid}`);
const PORT = process.env.PORT || 3000;
const HOST = process.env.DB_SERVER || '0.0.0.0';

// ✅ Idle Timeout Configuration
// เดิมตัด socket ที่ไม่ส่ง event เองนาน 20 นาที แต่หน้าเว็บไม่มีตัวจัดการ "idle_disconnect"/ไม่เชื่อมใหม่ ทำให้จอที่เปิดทิ้งไว้ (wallboard) เงียบไปเฉยๆ
// จึงปิดเป็นค่าเริ่มต้น (engine.io ping/pong ด้านล่างตรวจจับการเชื่อมต่อที่ตายอยู่แล้ว) — เปิดได้ด้วย SOCKET_IDLE_TIMEOUT_MIN=20 ใน .env
const IDLE_TIMEOUT = (parseInt(process.env.SOCKET_IDLE_TIMEOUT_MIN, 10) || 0) * 60 * 1000;
const WARNING_TIME = Math.max(IDLE_TIMEOUT - 2 * 60 * 1000, 0);   // เตือนล่วงหน้า 2 นาที
const SOCKET_DEBUG_LOGS = process.env.SOCKET_DEBUG_LOGS === "true";
const socketDebug = (...args) => { if (SOCKET_DEBUG_LOGS) console.log(...args); };

// Cluster setup for production
if (process.env.NODE_ENV === "production" && cluster.isPrimary) {
  const numCPUs = os.cpus().length;
  console.log(`Primary ${process.pid} is running`);

  const app = express();
  app.get("/health", (req, res) => res.status(200).send("OK"));

  const httpServer = http.createServer(app);

  setupMaster(httpServer, {
    loadBalancingMethod: "least-connection",
  });

  setupPrimary();

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
    setTimeout(() => cluster.fork(), 1000);
  });

  httpServer.listen(PORT, () => {
    console.log(`Primary server listening on port ${PORT}`);
  });
} else {
  // Worker process code
  const app = express();
  const port = process.env.PORT || 3000;

  // อยู่หลัง nginx: ดู lib/rateLimiters.js (TRUST_PROXY, RATE_LIMIT_MAX, LOGIN_RATE_LIMIT ใน .env)
  const trustProxy = resolveTrustProxy();
  app.set("trust proxy", trustProxy);
  let sharedRedis = null; // ตั้งค่าเมื่อสร้าง Redis client ด้านล่าง — ตัวนับ rate limit ใช้ Redis ร่วมกันทุก worker/เครื่อง (ไม่พร้อม = นับใน process)
  const { limiter, loginLimiter, publicAuthLimiter } = createLimiters({ getRedis: () => sharedRedis });

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "connect-src": ["'self'", "ws:", "wss:"]
      }
    },
    hsts: {
      maxAge: 63072000,
      includeSubDomains: true,
      preload: true
    }
  }));

  app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    }
  }));

  app.use(requestObserver); // นับ/จับเวลา/log request (ไม่ตัดสินใจอะไร) — ต้องอยู่ก่อน limiter เพื่อเห็น 429 ด้วย
  app.use(limiter);

  // Create HTTP server
  const server = http.createServer(app);

  // Configure Socket.IO with Redis adapter
  const io = new Server(server, {
    cors: {
      origin: [
        `http://${process.env.DB_SERVER}:5173`,
        "http://172.48.0.115:5173",
        "http://pfcm.thaiunion.co.th",
      ],
      credentials: true,
      methods: ["GET", "POST"]
    },
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: true
    },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    pingTimeout: 30000,
    pingInterval: 15000,
    transports: ["polling", "websocket"],
    allowEIO3: false
  });

  if (cluster.isWorker) {
    setupWorker(io);
  }

  // Redis (socket adapter + ข้อมูลร่วมของทุก worker/ทุกเครื่อง) — ตั้งค่าที่ .env (REDIS_HOST/PORT/PASSWORD/TLS) ดู lib/redisClient.js
  // Redis สะดุด/ยังไม่ขึ้น = ไม่ทำให้ API ล่ม (เชื่อมต่อใหม่เอง); ระหว่างนั้น realtime ข้าม worker/เครื่องอาจขาดชั่วคราว
  const pubClient = createRedis("pub");
  const subClient = duplicateRedis(pubClient, "sub");
  sharedRedis = pubClient;

  // ตัวชี้วัดและแจ้งเตือนเริ่มทันที ไม่ต้องรอ Redis (ส่วนที่ใช้ Redis จะข้ามเมื่อยังไม่พร้อม)
  metrics.registerGauge("db_pool", getPoolStats);
  metrics.registerGauge("sockets_connected", () => io.engine.clientsCount);
  metrics.startFlush(pubClient);
  startAlerts({
    redis: pubClient,
    getPoolStats,
    ping: async () => {
      const pool = await connectToDatabase();
      if (!pool) throw new Error("ไม่มี connection pool");
      await pool.request().query("SELECT 1 AS ok");
    },
  });

  Promise.all([pubClient.connect(), subClient.connect()])
    .then(() => {
      io.adapter(createAdapter(pubClient, subClient, {
        requestsTimeout: 5000,
        publishOnSpecificResponseChannel: true
      }));
      console.log("✅ Redis adapter connected");
      initAuth(pubClient); // เริ่มนับช่วงเปลี่ยนผ่านของ AUTH_MODE อัตโนมัติ + ส่งสถิติผู้เรียกที่ไม่มี token / การใช้งานต่อ Role เข้า Redis
      logger.info("server_ready", { mode: getAuthMode(), trustProxy });
    })
    .catch((err) => {
      // ไม่ออกจาก process: reconnectStrategy ของ client ลองเชื่อมต่อต่อเอง
      logger.error("redis_connect_failed", { error: err && err.message });
    });

  app.set("io", io);

  // CORS middleware
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        "http://10.111.23.238:5173",
        `http://${process.env.DB_SERVER}:5173`,
        "http://pfcm.thaiunion.co.th"
      ];

      const isAllowed = allowedOrigins.includes(origin) ||
        /^(http:\/\/)?(10\.10\.\d+\.\d+|192\.168\.\d+\.\d+|172\.48\.\d+\.\d+)(:\d{1,5})?$/.test(origin);

      callback(null, isAllowed);
    },
    credentials: true,
    maxAge: 86400,
    optionsSuccessStatus: 200
  }));

  // Body parsing middleware
  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ extended: true, limit: "5mb" }));

  // ตัวจำกัดของ endpoint สาธารณะ (ต้องอยู่หลัง body parser เพราะใช้ user_id ใน body) แล้วจึงตรวจตัวตน + สิทธิ์ Role ของทุก route ที่เหลือ
  app.use("/api/login", loginLimiter);
  app.use("/api/signup", publicAuthLimiter);
  app.use("/api/forgot-password", publicAuthLimiter);
  app.use(authenticate); // AUTH_MODE = off | warn | enforce | (ไม่ตั้ง = warn 24 ชม.แรกแล้ว enforce เอง) — ดู lib/authMiddleware.js
  app.use(authorize);

  // Real time for the Master Sheet: every successful write of the API tells the open sheets to reload (see sheetRealtime.js)
  require("./sheetRealtime")(app, io);

  // Connect to database
  connectToDatabase()
    .then(() => console.log("Database connection successful"))
    .catch((error) => {
      console.error("Database connection failed", error);
      process.exit(1);
    });

  // Cache control middleware
  app.use((req, res, next) => {
    res.set("Cache-Control", "no-store, max-age=0");
    next();
  });

  // Import routes
  const OvenRoutes = require("./routes/OvenRoutes")(io);
  const RawmatRoutes = require("./routes/RawmatRoutes");
  const UserRoutes = require("./routes/UserRoutes");
  const ProductionRoutes = require("./routes/ProductionRoutes");
  const ProcessRoutes = require("./routes/ProcessRoutes");
  const TrolleyRoutes = require("./routes/TrolleyRoutes");
  const WorkplaceRoutes = require("./routes/WorkplaceRoutes");
  const PackageRoutes = require("./routes/PackageRoutes")(io);
  const PreparationRoutes = require("./routes/PreparationRoutes")(io);
  const ColdStorageRoutes = require("./routes/ColdStorageRoutes")(io);
  const HeaderRoutes = require("./routes/HeaderRoutes");
  const Routes = require("./routes/Rotes")(io);
  const QualityControlRoutes = require("./routes/QualityControlRoutes")(io);
  const SheetRoutes = require("./routes/SheetRoutes");
  const OtherRoutes = require("./routes/OtherRoutes");
  const AuthRoutes = require("./routes/AuthRoutes");

  // Route registration
  app.use("/api", OvenRoutes);
  app.use("/api", RawmatRoutes);
  app.use("/api", UserRoutes);
  app.use("/api", ProductionRoutes);
  app.use("/api", ProcessRoutes);
  app.use("/api", TrolleyRoutes);
  app.use("/api", WorkplaceRoutes);
  app.use("/api", PackageRoutes);
  app.use("/api", PreparationRoutes);
  app.use("/api", ColdStorageRoutes);
  app.use("/api", HeaderRoutes);
  app.use("/api", Routes);
  app.use("/api", QualityControlRoutes);
  app.use("/api", SheetRoutes);
  app.use("/api", OtherRoutes);
  app.use("/api", AuthRoutes);
  app.use(rfidScanTriggerRoutes);
  app.use(rfidReaderConfigRoutes);

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.status(200).json({
      status: "healthy",
      worker: process.pid,
      memoryUsage: process.memoryUsage()
    });
  });

  // พร้อมรับงานจริงหรือไม่ (ตรวจ DB + Redis) — ใช้กับ load balancer / monitor; /health ด้านบนบอกแค่ว่า process ยังมีชีวิต
  app.get("/health/ready", async (req, res) => {
    const checks = { db: false, redis: !!(pubClient && pubClient.isReady) };
    try {
      const pool = await connectToDatabase();
      if (pool) { await pool.request().query("SELECT 1 AS ok"); checks.db = true; }
    } catch (err) {
      logger.warn("ready_db_failed", { error: err.message });
    }
    // พร้อม = ต่อ DB ได้เท่านั้น (Redis ล่มแล้ว API ยังทำงานได้ — ถ้านับ Redis ด้วย load balancer จะถอดทุกเครื่องออกจากระบบพร้อมกัน); redis แสดงไว้เป็นข้อมูล
    const ok = checks.db;
    res.status(ok ? 200 : 503).json({ status: ok ? "ready" : "not_ready", worker: process.pid, checks, pool: getPoolStats() });
  });

  // ตัวชี้วัดรวมทุก worker (รูปแบบ Prometheus; เติม ?format=json เพื่อดู snapshot ดิบ)
  // ป้องกันด้วย header x-metrics-key = METRICS_KEY ถ้าตั้งไว้ ไม่เช่นนั้นเปิดเฉพาะเครือข่ายภายใน
  app.get("/metrics", async (req, res) => {
    const key = process.env.METRICS_KEY;
    const allowed = key ? req.headers["x-metrics-key"] === key : isPrivateIp(req.ip);
    if (!allowed) return res.status(403).json({ success: false, error: "forbidden" });
    const snaps = await metrics.readAll(pubClient);
    if (req.query.format === "json") return res.json({ success: true, workers: snaps });
    res.type("text/plain; version=0.0.4").send(metrics.renderPrometheus(snaps));
  });

  // Swagger setup
  const swaggerSpec = swaggerJsdoc({
    definition: {
      openapi: "3.0.0",
      info: {
        title: "API Documentation",
        version: "1.0.0",
        description: "PFCMv2 Document for Front-End",
      },
      servers: [{ url: `http://${process.env.DB_SERVER}:3000` }],
    },
    apis: ["./routes/*.js"],
  });

  app.use("/api-docs", swaggerUI.serve, swaggerUI.setup(swaggerSpec));

  // Socket.IO: ตรวจ token ตอนเชื่อมต่อ (client ส่งใน auth.token — authClient.js แนบให้ทุก socket; RFIDc1 ใช้ service token)
  io.use((socket, next) => {
    const mode = getAuthMode();
    if (mode === "off") return next();
    const v = verifyToken(socket.handshake.auth && socket.handshake.auth.token);
    if (v.ok && (v.payload.typ === "user" || v.payload.typ === "service")) {
      socket.data.user = { user_id: v.payload.typ === "service" ? 0 : v.payload.user_id, service: v.payload.typ === "service" };
      return next();
    }
    metrics.inc("socket_auth_total", { result: v.ok ? "wrong_type" : v.reason, mode });
    if (mode === "enforce") return next(new Error(v.reason === "expired" ? "TOKEN_EXPIRED" : "AUTH_REQUIRED"));
    return next(); // warn: ปล่อยผ่าน (นับไว้ใน metrics)
  });

  // Socket.IO connection tracking
  const activeSockets = new Map();

  // Enhanced Socket.IO connection handler
  io.on("connection", (socket) => {
    socketDebug(`✅ New connection: ${socket.id}`);
    activeSockets.set(socket.id, socket);

    // ====================================================================
    // ✅ IDLE TIMEOUT: ตัดการเชื่อมต่อถ้าไม่มี activity 20 นาที
    // ====================================================================
    let idleTimer = null;
    let warningTimer = null;

    const resetIdleTimer = () => {
      if (IDLE_TIMEOUT <= 0) return;
      if (idleTimer) clearTimeout(idleTimer);
      if (warningTimer) clearTimeout(warningTimer);

      // ตั้ง warning ที่ 18 นาที (เตือนล่วงหน้า 2 นาที)
      warningTimer = setTimeout(() => {
        console.log(`⏰ Idle warning sent to ${socket.id}`);
        socket.emit("idle_warning", {
          message: "เซสชันจะหมดอายุใน 2 นาที กรุณาทำกิจกรรมเพื่อต่ออายุ",
          secondsRemaining: 120,
          timestamp: new Date().toISOString()
        });
      }, WARNING_TIME);

      // ตั้ง disconnect ที่ 20 นาที
      idleTimer = setTimeout(() => {
        console.log(`💤 Idle timeout: ${socket.id} - ไม่มี activity 20 นาที`);
        socket.emit("idle_disconnect", {
          reason: "ไม่มีการใช้งานนาน 20 นาที",
          timestamp: new Date().toISOString()
        });
        setTimeout(() => socket.disconnect(true), 500);
      }, IDLE_TIMEOUT);
    };

    // เริ่มจับเวลาทันทีเมื่อ connect
    resetIdleTimer();

    // ✅ Reset timer ทุกครั้งที่มี event จาก client (= มี activity)
    socket.onAny((eventName, ...args) => {
      if (eventName !== 'ping' && eventName !== 'pong') {
        resetIdleTimer();
      }
    });
    // ====================================================================

    // Heartbeat: เดิมมี heartbeat ระดับแอป (emit "ping" ทุก 20 วินาที แล้วตัด socket ที่ไม่ตอบ "pong" ใน ~80 วินาที) แต่หน้าเว็บเกือบทั้งหมดไม่ตอบ "pong"
    // ทำให้ socket ถูกตัดแล้วไม่เชื่อมใหม่ (server disconnect ไม่ auto-reconnect) → realtime หยุดเงียบๆ
    // การตรวจ connection ที่ตายใช้ engine.io pingInterval/pingTimeout (ตั้งไว้ที่ new Server ด้านบน) ซึ่ง client ตอบเองอัตโนมัติ

    // Room management
    socket.on("joinRoom", (roomName, callback) => {
      try {
        if (!roomName) throw new Error("Room name is required");

        socket.join(roomName);
        console.log(`🔗 ${socket.id} joined room: ${roomName}`);

        callback?.({ success: true, room: roomName });
      } catch (error) {
        console.error(`❌ Join room error: ${error.message}`);
        callback?.({ success: false, error: error.message });
        socket.emit("error", { event: "joinRoom", error: error.message });
      }
    });

    // Event handlers with error handling
    const handleSocketEvent = (event, handler) => {
      socket.on(event, async (data, callback) => {
        try {
          await handler(data, callback);
        } catch (error) {
          console.error(`${event} error:`, error);
          socket.emit("error", { event, error: error.message });
          callback?.({ success: false, error: error.message });
        }
      });
    };

    handleSocketEvent("updateFetch", (data) => {
      if (!data.room) throw new Error("Room name is required");

      socket.to(data.room).emit("refreshData", {
        ...data,
        updatedAt: new Date().toISOString()
      });
    });

    handleSocketEvent("updatePack", (data) => {
      if (!data.room) throw new Error("Room name is required");

      io.to(data.room).emit("refreshPack", {
        ...data,
        updatedAt: new Date().toISOString()
      });
    });

    handleSocketEvent("reserveSlot", (data) => {
      if (!data.slot_id || !data.room) throw new Error("Slot ID and Room are required");

      io.to(data.room).emit("forceRefresh");
      io.to(data.room).emit("slotUpdated", {
        slot_id: data.slot_id,
        status: "reserved",
        updatedBy: socket.id,
        timestamp: new Date().toISOString()
      });
    });

    handleSocketEvent("updateSlotToNULL", (data) => {
      if (!data.slot_id || !data.room) throw new Error("Slot ID and Room are required");

      io.to(data.room).emit("slotUpdated", {
        slot_id: data.slot_id,
        status: null,
        updatedBy: socket.id,
        timestamp: new Date().toISOString()
      });
    });

    // ✅ FIX: ย้าย rfidStatusUpdate เข้ามาอยู่ใน io.on("connection") scope
    handleSocketEvent("rfidStatusUpdate", (payload) => {
      console.log("📡 ได้รับสถานะจาก RFIDc1.js:", payload);

      io.to('saveRMForProdRoom').emit('dataUpdated', {
        ...payload,
        updatedAt: new Date().toISOString()
      });

      io.to('QcCheckRoom').emit('dataUpdated', { tro_id: payload.tro_id });

      if (payload.slot_id) {
        io.emit('slotUpdated', { slot_id: payload.slot_id, cs_id: payload.cs_id });
      }

      // ✅ broadcast ไปหน้า ReaderPanel ตาม readerId ที่ส่งสถานะเข้ามา
      if (payload.readerId) {
        io.emit('readerScanUpdate', {
          readerId: payload.readerId,
          ...payload,
          updatedAt: new Date().toISOString()
        });
      }
    });

    // ✅ Cleanup on disconnect
    socket.on("disconnect", (reason) => {
      socketDebug(`⚠️ ${socket.id} disconnected: ${reason}`);
      clearTimeout(idleTimer);
      clearTimeout(warningTimer);
      activeSockets.delete(socket.id);
    });

  }); // ✅ ปิด io.on("connection") ตรงนี้

  // Error handling middleware
  app.use((err, req, res, next) => {
    logger.error("unhandled_route_error", { id: req.id, method: req.method, path: req.path, user_id: req.user ? req.user.user_id : null, error: err.message, stack: err.stack });
    res.status(500).json({
      error: "Internal Server Error",
      requestId: req.id,
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  });

  // Start server in worker process
  if (!cluster.isPrimary) {
    server.listen(PORT, () => {
      const interfaces = os.networkInterfaces();
      let addresses = [];

      for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
          if (iface.family === 'IPv4' && !iface.internal) {
            addresses.push(iface.address);
          }
        }
      }

      console.log(`Worker ${process.pid} started on port ${PORT}`);
      if (IDLE_TIMEOUT > 0) console.log(`⏰ Idle timeout: ${IDLE_TIMEOUT / 60000} นาที`);
      console.log(`Accessible on:`);
      addresses.forEach(ip => {
        console.log(`  http://${ip}:${PORT}`);
      });
    });
  }

  // Graceful shutdown
  const shutdown = (signal) => {
    console.log(`${signal} received. Shutting down gracefully...`);

    activeSockets.forEach(socket => socket.disconnect(true));

    server.close(() => {
      console.log(`Worker ${process.pid} terminated`);
      process.exit(0);
    });

    setTimeout(() => {
      console.error(`Worker ${process.pid} forced shutdown`);
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}