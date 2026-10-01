module.exports = {
  apps: [{
    name: 'rfidc1-service',
    script: './RFIDc1.js',
    cwd: './',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    restart_delay: 3000,
    max_memory_restart: '256M',
    out_file: './logs/rfidc1-service-out.log',
    error_file: './logs/rfidc1-service-error.log',
    env: {
      NODE_ENV: 'production',
      READER_NO: '1',
      READER_IP: '10.246.145.181',
      READER_PORT: 49152,
      READER_NAME: 'เครื่องอ่าน RFID จุด A',
      PRINT_AGENT_URL: 'http://172.48.0.115:9100',
      WEB_SERVER_URL: 'http://172.48.0.115:3000',
      DB_USER: 'PFCMv3',
      DB_PASSWORD: 'Pee@2026',
      DB_SERVER: '172.48.0.115',
      DB_DATABASE: 'PFCMv2',
    }
  }]
};