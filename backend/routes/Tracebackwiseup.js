// ─────────────────────────────────────────────────────────────────────────────
// tracebackWiseup.js
//   ดึงข้อมูลรับเข้าทั้งหมดจากฐานข้อมูล WISEUP ตาม batch_before
//   ใช้แทนการถอดรหัสจากหลักของ batch — ข้อมูลจริงแม่นกว่าการตีความรหัส
//
//   เชื่อมกันด้วย   PFCMv2.Batch.batch_before  =  WISEUP.PRD_Batch.Batch
//
//   คืนข้อมูลต่อ 1 batch
//     · หัวล็อต       ผู้ขาย วันที่ล็อต วันหมดอายุ ชนิด/ขนาดปลา ยอดรับรวม
//     · receipts[]    ใบรับแต่ละใบ
//     · qc            ผลตรวจที่ใช้บ่อย (อุณหภูมิ ผู้ตรวจ ข้อบกพร่อง)
//     · qc_features[] ผลตรวจรายคุณลักษณะทั้งหมด
// ─────────────────────────────────────────────────────────────────────────────
const sql = require('mssql');

/* ── .env ─────────────────────────────────────────────────────────────────
   DB_SERVER_WISEUP=192.168.8.12
   DB_PORT_WISEUP=61678
   DB_DATABASE_WISEUP=WISEUP
   DB_USER_WISEUP=WiseupUser
   DB_PASSWORD_WISEUP=...

   เซิร์ฟเวอร์เป็น named instance (WISEUP_SCC) แต่เมื่อระบุ port ตรง ๆ แล้ว
   ห้ามใส่ instanceName ด้วย จะ error
   ──────────────────────────────────────────────────────────────────────── */
const wiseupConfig = {
    user: process.env.DB_USER_WISEUP,
    password: process.env.DB_PASSWORD_WISEUP,
    server: process.env.DB_SERVER_WISEUP,
    database: process.env.DB_DATABASE_WISEUP,
    port: Number(process.env.DB_PORT_WISEUP) || 1433,
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
    requestTimeout: 60000,
    connectionTimeout: 15000,
};

let wiseupPoolPromise = null;
async function connectToWiseup() {
    if (!wiseupPoolPromise) {
        wiseupPoolPromise = new sql.ConnectionPool(wiseupConfig)
            .connect()
            .catch(err => { wiseupPoolPromise = null; throw err; });
    }
    return wiseupPoolPromise;
}

const S = v => (v == null ? '' : String(v).trim());
const MAX_PARAMS = 800;

/* ── ตารางแปลรหัสคุณลักษณะ ───────────────────────────────────────────────
   (?) = ยังไม่ได้ให้ QA ยืนยัน  ดู wiseup-feature-discovery.sql เพื่อหาชื่อจริง
   ──────────────────────────────────────────────────────────────────────── */
const FEATURE = {
    WSZ0101: { g: 1, label: 'วันที่ผลิต' },
    WSZ0137: { g: 1, label: 'ทะเบียนรถ' },
    WSZ0107: { g: 1, label: 'เลขที่ใบกำกับ (?)' },
    WSZ0110: { g: 2, label: 'อุณหภูมิ', unit: '°C' },
    WSZ0111: { g: 2, label: 'สภาพบรรจุภัณฑ์ (?)' },
    WSZ0112: { g: 2, label: 'ความสะอาด (?)' },
    WSZ0113: { g: 2, label: 'กลิ่น (?)' },
    WSZ0121: { g: 2, label: 'สภาพทั่วไป (?)' },
    WSZ0125: { g: 2, label: 'รายการที่ยังไม่ตรวจ (?)' },
    WSZ0130: { g: 2, label: 'ค่าตรวจวัดเพิ่มเติม (?)' },
    WSZ0131: { g: 2, label: 'สภาพรถขนส่ง (?)' },
    WSZ0132: { g: 2, label: 'สุขลักษณะผู้ขนส่ง (?)' },
    WSZ0133: { g: 2, label: 'การปนเปื้อน (?)' },
    WSZ0123: { g: 3, label: 'ผลการตัดสิน' },
    WSZ4021: { g: 4, label: 'สิ่งที่พบ' },
    WSZ4022: { g: 5, label: 'ผู้ตรวจ' },
    WSZ4023: { g: 5, label: 'ผู้ทวนสอบ' },
};
const GROUP_LABEL = {
    1: 'ข้อมูลรับเข้า', 2: 'ผลตรวจวัด', 3: 'ผลตัดสิน',
    4: 'ข้อบกพร่อง', 5: 'ผู้รับผิดชอบ',
};

/** รหัสแคตตาล็อก — 001 ยืนยันแล้วจากค่าที่เคยคีย์เต็มว่า "001 - Accept" */
const CATALOG = { '001': 'ผ่าน', '002': 'ไม่ผ่าน (?)', '003': 'เงื่อนไขพิเศษ (?)' };

const chunkOf = (arr, n) => {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
};

/**
 * ดึงข้อมูลรับเข้าทั้งหมดของหลาย batch พร้อมกัน
 * @param {string[]} batchCodes
 * @param {object}  [opt]  { withFeatures, withReceipts }
 * @returns {Map<string, object>}
 */
async function fetchIntakeByBatch(batchCodes, opt = {}) {
    const { withFeatures = true, withReceipts = true } = opt;
    const list = [...new Set((batchCodes || []).map(S).filter(Boolean))];
    if (!list.length) return new Map();

    const pool = await connectToWiseup();
    const out = new Map();

    for (const part of chunkOf(list, MAX_PARAMS)) {
        const bind = (req) => part.map((b, k) => {
            req.input(`b${k}`, sql.VarChar(50), b);
            return `@b${k}`;
        });

        /* ── 1) หัวล็อต ──────────────────────────────────────────────── */
        const reqH = pool.request();
        const pH = bind(reqH);
        const head = await reqH.query(`
SELECT
    batch_code      = b.Batch,
    mat_external    = b.ExternalCode,
    batch_date      = CONVERT(VARCHAR, b.BatchDate, 120),
    expiration_date = CONVERT(VARCHAR, b.ExpirationDate, 120),
    shelf_life_days = DATEDIFF(DAY, b.BatchDate, b.ExpirationDate),
    supplier_code   = sup.SupplierID,
    supplier_name   = sup.SupplierName,
    fish_specie     = NULLIF(sp.DescriptionEN, 'NONE'),
    fish_size       = sz.DescriptionEN,
    receive_lines   = rc.Lines,
    receive_qty     = rc.TotalQty,
    receive_unit    = rc.Unit,
    receive_first   = CONVERT(VARCHAR, rc.FirstReceive, 120),
    receive_last    = CONVERT(VARCHAR, rc.LastReceive, 120),
    guide_numbers   = rc.Guides,
    consumption_cnt = mc.Cnt,
    inspection_lot  = i.InspectionLot,
    inspection_date = CONVERT(VARCHAR, i.CreatedDate, 120),
    decision_code   = i.UsageDecisionCode
FROM PRD_Batch b WITH (NOLOCK)
OUTER APPLY (
    SELECT TOP 1
        SupplierID   = COALESCE(NULLIF(g.SupplierID, ''), b.SupplierID),
        SupplierName = COALESCE(NULLIF(g.SupplierName, ''), su.Name)
    FROM RMM_GuideLine g WITH (NOLOCK)
    LEFT JOIN SUP_Supplier su WITH (NOLOCK) ON su.SupplierID = NULLIF(g.SupplierID, '')
    WHERE g.Batch = b.Batch
    ORDER BY g.GuideYear DESC, g.GuideNumber DESC
) sup
LEFT JOIN PRD_FishSpecie sp WITH (NOLOCK) ON sp.FishSpecieID = b.FishSpecieID
LEFT JOIN PRD_FishSize   sz WITH (NOLOCK) ON sz.FishSizeID   = b.FishSizeID
OUTER APPLY (
    SELECT Lines = COUNT(*), TotalQty = SUM(r.Quantity), Unit = MIN(r.Unit),
           FirstReceive = MIN(r.CreatedDate), LastReceive = MAX(r.CreatedDate),
           Guides = STRING_AGG(CAST(r.GuideNumber AS NVARCHAR(30)), ', ')
    FROM RMM_ReceivedMaterialLine r WITH (NOLOCK) WHERE r.Batch = b.Batch
) rc
OUTER APPLY (
    SELECT Cnt = COUNT(*) FROM PRD_MaterialConsumptionLine m WITH (NOLOCK)
    WHERE m.Batch = b.Batch
) mc
OUTER APPLY (
    SELECT TOP 1 * FROM MIP_QM01_InspectionLot x WITH (NOLOCK)
    WHERE x.Batch = b.Batch AND x.MaterialNumber = b.ExternalCode
    ORDER BY x.CreatedDate DESC
) i
WHERE b.Batch IN (${pH.join(', ')});
        `);

        for (const row of head.recordset) {
            out.set(row.batch_code, { ...row, receipts: [], qc_features: [], qc: {} });
        }

        /* ── 2) ใบรับ ────────────────────────────────────────────────── */
        if (withReceipts) {
            const reqR = pool.request();
            const pR = bind(reqR);
            const rec = await reqR.query(`
SELECT
    batch_code   = r.Batch,
    guide_number = r.GuideNumber,
    guide_line   = r.GuideLine,
    quantity     = r.Quantity,
    unit         = r.Unit,
    received_at  = CONVERT(VARCHAR, r.CreatedDate, 120),
    supplier_id  = r.SupplierID
FROM RMM_ReceivedMaterialLine r WITH (NOLOCK)
WHERE r.Batch IN (${pR.join(', ')})
ORDER BY r.Batch, r.CreatedDate, r.GuideNumber, r.GuideLine;
            `);
            for (const row of rec.recordset) {
                const e = out.get(row.batch_code);
                if (e) e.receipts.push(row);
            }
        }

        /* ── 3) ผลตรวจรายคุณลักษณะ ──────────────────────────────────── */
        if (withFeatures) {
            const reqF = pool.request();
            const pF = bind(reqF);
            const fr = await reqF.query(`
SELECT
    batch_code     = i.Batch,
    inspection_lot = i.InspectionLot,
    feature_code   = f.FeatureCode,
    feature_order  = TRY_CAST(f.FeatureOrder AS int),
    sample_size    = TRY_CAST(f.FeatureSampleSize AS int),
    sample_no      = TRY_CAST(f.FeatureSampleNumber AS int),
    mean_text      = NULLIF(LTRIM(RTRIM(f.FeatureMeanValue)), ''),
    mean_num       = TRY_CAST(f.FeatureMeanValue AS decimal(18,4)),
    catalog_value  = NULLIF(LTRIM(RTRIM(f.FeatureCatalogValue)), '')
FROM MIP_QM01_InspectionFeature f WITH (NOLOCK)
JOIN MIP_QM01_InspectionLot i WITH (NOLOCK) ON i.InspectionLotID = f.InspectionLotID
WHERE i.Batch IN (${pF.join(', ')})
ORDER BY i.Batch, TRY_CAST(f.FeatureOrder AS int), TRY_CAST(f.FeatureSampleNumber AS int);
            `);

            // รวมตัวอย่างหลายตัว → 1 แถวต่อคุณลักษณะ
            const byBatch = new Map();
            for (const row of fr.recordset) {
                if (!byBatch.has(row.batch_code)) byBatch.set(row.batch_code, new Map());
                const bm = byBatch.get(row.batch_code);
                let g = bm.get(row.feature_code);
                if (!g) {
                    const meta = FEATURE[row.feature_code] || {};
                    g = {
                        feature_code: row.feature_code,
                        label: meta.label || row.feature_code,
                        group: meta.g ?? 2,
                        unit: meta.unit || null,
                        confirmed_label: !!meta.label && !String(meta.label).includes('(?)'),
                        order: row.feature_order,
                        sample_size: row.sample_size,
                        values: [], nums: [],
                    };
                    bm.set(row.feature_code, g);
                }
                const v = row.mean_text
                    ?? (row.catalog_value ? (CATALOG[row.catalog_value] || row.catalog_value) : null);
                if (v != null && v !== '-') g.values.push(v);
                if (row.mean_num != null) g.nums.push(Number(row.mean_num));
            }

            for (const [batch, bm] of byBatch.entries()) {
                const e = out.get(batch);
                if (!e) continue;

                const feats = [...bm.values()].map(g => {
                    const n = g.nums;
                    const avg = n.length ? n.reduce((a, b) => a + b, 0) / n.length : null;
                    return {
                        feature_code: g.feature_code,
                        label: g.label,
                        group: g.group,
                        group_label: GROUP_LABEL[g.group],
                        unit: g.unit,
                        confirmed_label: g.confirmed_label,
                        order: g.order,
                        sample_size: g.sample_size,
                        recorded: g.values.length,
                        value: g.values.join(', ') || null,
                        avg: avg != null ? Number(avg.toFixed(2)) : null,
                        min: n.length ? Math.min(...n) : null,
                        max: n.length ? Math.max(...n) : null,
                        status: g.values.length === 0 ? 'ยังไม่บันทึก'
                            : (g.sample_size && g.values.length < g.sample_size) ? 'บันทึกไม่ครบ'
                                : 'ครบ',
                    };
                }).sort((a, b) => (a.group - b.group) || ((a.order ?? 0) - (b.order ?? 0)));

                e.qc_features = feats;

                const pick = c => feats.find(f => f.feature_code === c);
                const temp = pick('WSZ0110');
                e.qc = {
                    produce_date: pick('WSZ0101')?.value ?? null,
                    truck_plate: pick('WSZ0137')?.value ?? null,
                    temp_avg: temp?.avg ?? null,
                    temp_min: temp?.min ?? null,
                    temp_max: temp?.max ?? null,
                    temp_samples: temp?.recorded ?? null,
                    defect: pick('WSZ4021')?.value ?? null,
                    inspector: pick('WSZ4022')?.value ?? null,
                    reviewer: pick('WSZ4023')?.value ?? null,
                    incomplete: feats.filter(f => f.status !== 'ครบ').map(f => f.label),
                };
            }
        }
    }

    return out;
}

module.exports = { connectToWiseup, fetchIntakeByBatch, FEATURE, CATALOG };