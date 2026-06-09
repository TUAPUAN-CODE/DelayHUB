const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { connectToDatabase } = require("./database/db");
const swaggerUI = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const http = require("http");
const { Server } = require("socket.io");
const cluster = require("cluster");
const os = require("os");
const { createClient } = require("redis");
const { createAdapter } = require("@socket.io/redis-adapter");
const { setupMaster, setupWorker } = require("@socket.io/sticky");
const { setupPrimary } = require("@socket.io/cluster-adapter");
// const { getLatestData } = require("./autofetch");

// Load environment variables early
dotenv.config();
const PORT = process.env.PORT || 3000;
const HOST = process.env.DB_SERVER || '0.0.0.0';

// ✅ Idle Timeout Configuration
const IDLE_TIMEOUT = 20 * 60 * 1000;       // 20 นาที = ตัดการเชื่อมต่อ
const WARNING_TIME = 18 * 60 * 1000;       // 18 นาที = แจ้งเตือนล่วงหน้า

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

  // Enhanced rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 3000,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      return req.ip.startsWith('192.168.') ||
        req.ip.startsWith('10.') ||
        req.ip.startsWith('172.') ||
        req.path === '/health';
    }
  });

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

  app.use(limiter);

  // Create HTTP server
  const server = http.createServer(app);

  // Configure Socket.IO with Redis adapter
  const io = new Server(server, {
    cors: {
      origin: [
        `http://${process.env.DB_SERVER}:5173`,
        "http://172.20.10.5:5173",
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

  // Enhanced Redis configuration
  const pubClient = createClient({
    socket: {
      host: '172.20.10.5',
      port: 6379,
      tls: {
        servername: undefined
      }
    },
    disableClientInfo: true
  });

  const subClient = pubClient.duplicate();

  Promise.all([pubClient.connect(), subClient.connect()])
    .then(() => {
      io.adapter(createAdapter(pubClient, subClient, {
        requestsTimeout: 5000,
        publishOnSpecificResponseChannel: true
      }));
      console.log("✅ Redis adapter connected");
    })
    .catch((err) => {
      console.error("❌ Redis connection error:", err);
      process.exit(1);
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
        /^(http:\/\/)?(10\.10\.\d+\.\d+|192\.168\.\d+\.\d+|172\.48\.\d+\.\d+)/.test(origin);

      callback(null, isAllowed);
    },
    credentials: true,
    maxAge: 86400,
    optionsSuccessStatus: 200
  }));

  // Body parsing middleware
  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ extended: true, limit: "5mb" }));

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

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.status(200).json({
      status: "healthy",
      worker: process.pid,
      memoryUsage: process.memoryUsage()
    });
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

  // Socket.IO connection tracking
  const activeSockets = new Map();

  // Enhanced Socket.IO connection handler
  io.on("connection", (socket) => {
    console.log(`✅ New connection: ${socket.id}`);
    activeSockets.set(socket.id, socket);

    // ====================================================================
    // ✅ IDLE TIMEOUT: ตัดการเชื่อมต่อถ้าไม่มี activity 20 นาที
    // ====================================================================
    let idleTimer = null;
    let warningTimer = null;

    const resetIdleTimer = () => {
      // เคลียร์ timer เก่า
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
        // รอให้ event ส่งถึง client ก่อน disconnect
        setTimeout(() => socket.disconnect(true), 500);
      }, IDLE_TIMEOUT);
    };

    // เริ่มจับเวลาทันทีเมื่อ connect
    resetIdleTimer();

    // ✅ Reset timer ทุกครั้งที่มี event จาก client (= มี activity)
    socket.onAny((eventName, ...args) => {
      // ไม่นับ ping/pong เพราะเป็น auto event ของ Socket.IO
      if (eventName !== 'ping' && eventName !== 'pong') {
        console.log(`🔄 Activity from ${socket.id}: ${eventName}`);
        resetIdleTimer();
      }
    });
    // ====================================================================

    // Heartbeat monitoring (network-level)
    let missedPings = 0;
    const heartbeatInterval = setInterval(() => {
      if (missedPings > 2) {
        console.log(`♻️ Terminating stale connection: ${socket.id}`);
        socket.disconnect(true);
      }
      missedPings++;
      socket.emit("ping");
    }, 20000);

    socket.on("pong", () => {
      missedPings = 0;
    });

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

    // ✅ Cleanup on disconnect — เพิ่ม clearTimeout ของ idleTimer
    socket.on("disconnect", (reason) => {
      console.log(`⚠️ ${socket.id} disconnected: ${reason}`);
      clearInterval(heartbeatInterval);
      clearTimeout(idleTimer);                // ✅ เคลียร์ idle timer
      clearTimeout(warningTimer);              // ✅ เคลียร์ warning timer
      activeSockets.delete(socket.id);
      io.emit("userDisconnected", {
        userId: socket.id,
        timestamp: new Date().toISOString()
      });
    });
  });

  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
      error: "Internal Server Error",
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
      console.log(`⏰ Idle timeout: ${IDLE_TIMEOUT / 60000} นาที`);
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