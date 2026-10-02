// แยกเฟรมข้อมูลจาก RFID reader ที่ส่งมาเป็น TCP stream
// เฟรมแท็ก = CC FF FF 20 ... ; EPC (12 ไบต์) อยู่ที่ไบต์ 9-20 (hex offset 18-41) เหมือนที่ RFIDc1.js ใช้เดิม
// TCP ไม่รับประกันว่า 1 chunk = 1 เฟรม (อาจติดกันหลายเฟรม หรือขาดครึ่ง) จึงสะสมเป็น buffer แล้วแยกเอง
const FRAME_HEADER = Buffer.from('CCFFFF', 'hex');
const TAG_FRAME_CMD = 0x20;
const EPC_START = 9;
const EPC_END = 21;
const MAX_FRAME_LEN = 64;
const MAX_BUFFER = 4096;
const STALE_MS = 1000; // เศษเฟรมที่ค้างนานกว่านี้ถือว่าเสีย ทิ้ง

function createFrameParser() {
    let buf = Buffer.alloc(0);
    let lastChunkAt = 0;

    function push(data, now = Date.now()) {
        if (buf.length > 0 && now - lastChunkAt > STALE_MS) { buf = Buffer.alloc(0); }
        lastChunkAt = now;
        buf = Buffer.concat([buf, data]);
        if (buf.length > MAX_BUFFER) { buf = buf.subarray(buf.length - MAX_BUFFER); }

        const epcs = [];
        for (;;) {
            const idx = buf.indexOf(FRAME_HEADER);
            if (idx === -1) {
                buf = buf.subarray(Math.max(0, buf.length - (FRAME_HEADER.length - 1))); // เผื่อ header มาไม่ครบ
                break;
            }
            if (idx > 0) { buf = buf.subarray(idx); }
            if (buf.length < 4) { break; }

            if (buf[3] !== TAG_FRAME_CMD) { // ไม่ใช่เฟรมแท็ก (เช่น ack ของคำสั่ง) ข้าม header แล้วหาเฟรมถัดไป
                buf = buf.subarray(FRAME_HEADER.length);
                continue;
            }
            if (buf.length < EPC_END) { break; } // รอข้อมูลส่วนที่เหลือ

            const nextHeader = buf.indexOf(FRAME_HEADER, 3);
            if (nextHeader !== -1 && nextHeader < EPC_END) { // เฟรมสั้นเกิน/ขาด เจอ header ใหม่ก่อน — ทิ้งเฟรมเสีย
                buf = buf.subarray(nextHeader);
                continue;
            }

            let frameLen = EPC_END;
            if (buf.length >= 6) {
                const declared = 7 + buf.readUInt16BE(4); // 4 ไบต์แรก + length(2) + data + checksum(1)
                if (declared >= EPC_END && declared <= MAX_FRAME_LEN) { frameLen = declared; }
            }
            if (nextHeader !== -1 && nextHeader < frameLen) { frameLen = nextHeader; }
            if (buf.length < frameLen) { break; }

            epcs.push(buf.subarray(EPC_START, EPC_END).toString('hex').toUpperCase());
            buf = buf.subarray(frameLen);
        }
        return epcs;
    }

    function reset() { buf = Buffer.alloc(0); lastChunkAt = 0; }

    return { push, reset };
}

// EPC ที่ผิดปกติ (ไม่ใช่ hex 24 ตัว, ค่าเดียวซ้ำทั้งสาย เช่น 000... / FFF...) ถือเป็นขยะ ไม่ประมวลผล
function isValidEpc(epc) {
    return /^[0-9A-F]{24}$/.test(epc) && !/^(.)\1+$/.test(epc);
}

module.exports = { createFrameParser, isValidEpc };
