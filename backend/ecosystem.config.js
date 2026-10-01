// module.exports = {
//   apps: [
//     // =========================
//     // 1. BACKEND (API + SOCKET)
//     // =========================
//     {
//       name: 'PFCMv2-backend',
//       script: './server.js',
//       instances: 'max',
//       exec_mode: 'cluster',   // 👉 ใช้ PM2 cluster อย่างเดียว
//       autorestart: true,
//       watch: false,
//       max_restarts: 5,
//       restart_delay: 3000,
//       listen_timeout: 8000,
//       kill_timeout: 3000,
//       max_memory_restart: '2048M',
//       node_args: '--max-old-space-size=1024',

//       // 🔥 แนะนำเปิด log ตอนแรก
//       out_file: './logs/backend-out.log',
//       error_file: './logs/backend-error.log',

//       env: {
//         NODE_ENV: 'production',
//       }
//     },

//     // =========================
//     // 2. WORKER (JOB พื้นหลัง)
//     // =========================
//     {
//       name: 'reset-rsrv-worker',
//       script: './resetRSRVWorker.js',
//       instances: 1,
//       exec_mode: 'fork',
//       autorestart: true,
//       watch: false,
//       restart_delay: 3000,
//       max_memory_restart: '512M',

//       out_file: './logs/worker-out.log',
//       error_file: './logs/worker-error.log',

//       env: {
//         NODE_ENV: 'production',
//       }
//     },

//     // =========================
//     // 3. RFID SERVICE (ตัวอ่าน RFID)
//     // =========================
//     // {
//     //   name: 'rfid-reader',
//     //   script: './RFIDc1.js',
//     //   instances: 1,              // ❗ ห้ามหลาย instance (จะชน reader)
//     //   exec_mode: 'fork',         // ❗ ต้อง fork เท่านั้น
//     //   autorestart: true,
//     //   watch: false,
//     //   restart_delay: 3000,
//     //   max_memory_restart: '512M',

//     //   out_file: './logs/rfid-out.log',
//     //   error_file: './logs/rfid-error.log',

//     //   env: {
//     //     NODE_ENV: 'production',
//     //   }
//     // },

//     {
//       name: 'PFCMv2-frontend',
//       script: 'cmd',
//       args: '/c npm run serve-static',
//       cwd: '../frontend',
//       instances: 1,
//       exec_mode: 'fork',
//       autorestart: true,
//       watch: false,
//       restart_delay: 3000,

//       out_file: '../frontend/logs/frontend-out.log',
//       error_file: '../frontend/logs/frontend-error.log',

//       env: {
//         NODE_ENV: 'production'
//       }
//     }

//   ]
// };

module.exports = {
  apps: [
    // =========================
    // 1. BACKEND (API + SOCKET)
    // =========================
    {
      name: 'PFCMv2-backend',
      script: './server.js',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_restarts: 5,
      restart_delay: 3000,
      listen_timeout: 8000,
      kill_timeout: 3000,
      max_memory_restart: '2048M',
      node_args: '--max-old-space-size=1024',

      // 🚫 ปิด log
      out_file: 'NUL',
      error_file: 'NUL',

      env: {
        NODE_ENV: 'production',
      }
    },

    // =========================
    // 2. WORKER (JOB พื้นหลัง)
    // =========================
    {
      name: 'reset-rsrv-worker',
      script: './resetRSRVWorker.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      restart_delay: 3000,
      max_memory_restart: '512M',

      out_file: 'NUL',
      error_file: 'NUL',

      env: {
        NODE_ENV: 'production',
      }
    },

    {
      name: 'PFCMv2-frontend',
      script: 'cmd',
      args: '/c npm run serve-static',
      cwd: '../frontend',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      restart_delay: 3000,

      out_file: 'NUL',
      error_file: 'NUL',

      env: {
        NODE_ENV: 'production'
      }
    },

       // =========================
    // RFID SERVICE (RFIDc1) - Reader 1
    // =========================
    {
      name: 'rfidc1-service',
      script: './RFIDc1.js',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false ,
      restart_delay: 3000,
      max_memory_restart: '256M',

      out_file: './logs/rfidc1-out.log',
      error_file: './logs/rfidc1-error.log',

      env: {
        NODE_ENV: 'production',
        READER_NO: '1',
        READER_IP: '10.246.145.182',
        READER_PORT: '49152',
        READER_NAME: 'RFID_READER_1',
      }
    },

    // =========================
    // PRINT AGENT (เครื่องพิมพ์สลิป นอกโปรเจกต์)
    // =========================
    {
      name: 'print-agent',
      script: './server.js',
      cwd: 'I:/print-agent (4)/print-agent',
      cwd: 'I:/I-Tail-PFCM/print-agent/print-agent',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      restart_delay: 3000,
      max_memory_restart: '512M',

      out_file: 'I:/I-Tail-PFCM/print-agent/print-agent/pm2-out.log',
      error_file: 'I:/I-Tail-PFCM/print-agent/print-agent/pm2-error.log',

      env: {
        NODE_ENV: 'production'
      }
    }

  ]
};