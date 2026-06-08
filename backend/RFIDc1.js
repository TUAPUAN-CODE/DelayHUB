const net = require('net');
const sql = require('mssql');

const READER_IP = "10.246.145.182";
const READER_PORT = 49152;

const dbConfig = {
    user: 'PFCM_v1.9',
    password: '987654321.Com',
    server: '172.48.0.115',
    database: 'PFCMv2',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

const client = new net.Socket();

function buildCommand7C(hexString) {
    const buf = Buffer.from(hexString, "hex");
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
        sum += buf[i];
    }
    const checksum = ((~sum) + 1) & 0xFF;
    return Buffer.concat([buf, Buffer.from([checksum])]);
}

// ✅ แปลงเวลา local ไม่โดน UTC shift
function getLocalDatetime() {
    const now = new Date();
    const y = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    return new Date(y, now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());
}

client.connect(READER_PORT, READER_IP, async () => {
    console.log(`✅ CONNECTED TO READER: ${READER_IP}:${READER_PORT}`);

    const initCmd = buildCommand7C("7CFFFF823200D2");
    client.write(initCmd);

    const startCmd = Buffer.from("7CFFFF20000501000200C896", "hex");
    client.write(startCmd);

    console.log("💥 START SCAN อัตโนมัติแล้ว...");
});

client.on('data', async (data) => {
    const hexReply = data.toString('hex').toUpperCase();

    if (hexReply.startsWith("CCFFFF20") && hexReply.length >= 41) {
        const epc = hexReply.substring(18, 42);
        console.log("🎯 EPC:", epc);

        try {
            const pool = await sql.connect(dbConfig);

            // 1. หา tro_id จาก EPC
            const troResult = await pool.request()
                .input('epc', sql.VarChar, epc)
                .query(`
                    SELECT tro_id 
                    FROM RFID_to_Trolley 
                    WHERE epc = @epc
                `);

            if (troResult.recordset.length === 0) {
                console.log("❌ ไม่พบ EPC ในระบบ");
                return;
            }

            const tro_id = troResult.recordset[0].tro_id;
            console.log("🚚 tro_id:", tro_id);

            // 2. หา mapping_id และ dest จาก TrolleyRMMapping
            const mappingResult = await pool.request()
                .input('tro_id', sql.Int, tro_id)
                .query(`
                    SELECT mapping_id, dest
                    FROM TrolleyRMMapping
                    WHERE tro_id = @tro_id
                `);

            if (mappingResult.recordset.length === 0) {
                console.log("❌ ไม่พบ mapping_id สำหรับ tro_id:", tro_id);
                return;
            }

            const { mapping_id, dest } = mappingResult.recordset[0];
            console.log("📦 mapping_id:", mapping_id, "| dest:", dest);

            const now = getLocalDatetime();

            // 3. เลือก column ที่จะ update ตาม dest
            if (dest === 'รอCheckin' || dest === 'ห้องเย็น') {
                // อัปเดต come_cold_date_RFID
                await pool.request()
                    .input('mapping_id', sql.Int, mapping_id)
                    .input('now', sql.DateTime, now)
                    .query(`
                        UPDATE History
                        SET come_cold_date_RFID = @now
                        WHERE mapping_id = @mapping_id
                    `);

                console.log(`✅ อัปเดต come_cold_date_RFID = ${now} | mapping_id=${mapping_id}`);

            } else if (stay_place === 'ออกห้องเย็น') {
                // อัปเดต out_cold_date_RFID
                await pool.request()
                    .input('mapping_id', sql.Int, mapping_id)
                    .input('now', sql.DateTime, now)
                    .query(`
                        UPDATE History
                        SET out_cold_date_RFID = @now
                        WHERE mapping_id = @mapping_id
                    `);

                console.log(`✅ อัปเดต out_cold_date_RFID = ${now} | mapping_id=${mapping_id}`);

            } else {
                console.log(`⚠️ dest="${dest}" ไม่ตรงเงื่อนไข ไม่มีการอัปเดต`);
            }

        } catch (err) {
            console.error("❌ DB ERROR:", err.message);
        }
    }
});

client.on('error', (err) => console.error("❌ ERROR:", err.message));
client.on('close', () => process.exit(0));
process.on('SIGINT', () => {
    client.destroy();
    setTimeout(() => process.exit(0), 500);
});