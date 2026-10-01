// ─────────────────────────────────────────────────────────────────────────────
// tracebackBatch.js
//   โมดูลถอดรหัส Batch ด้วยตาราง trac_back_*  + endpoint สอบกลับจาก batch
//
//   GET /api/traceback/batch/:batch_code            → ถอดรหัส batch ตัวเดียว
//   GET /api/traceback/batch/:batch_code/trace      → สอบกลับย้อนทาง (batch → สินค้า)
//   GET /api/traceback/batch/coverage               → ภาพรวมว่าถอดได้กี่ %
//
//   ส่งออก decodeBatches() ให้ /detail เรียกใช้แบบ batch เดียวจบ
//   ไม่ใช้ stored procedure เพราะถ้าเรียกทีละ batch จะกลายเป็น N+1 query
//   (168 ล็อต = 336 round trip) จึงเขียนเป็น set-based query ยิงครั้งเดียว
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express');
const sql = require('mssql');
const router = express.Router();
console.log('✅ Tracebackbatch.js loaded');

const { connectToDatabase } = require('../database/db');

const S = v => (v == null ? '' : String(v).trim());
const MAX_PARAMS = 900;   // กันชน SQL Server limit 2100 parameters

// ═══════════════════════════════════════════════════════════════════════════
// เลือกโครงสร้างที่เข้ากับ batch มากที่สุด (ทำทีเดียวหลาย batch)
//
// การจัดอันดับ
//   1. กติกาจาก mat มาก่อน (mat_prefix แม่นกว่า material_type_code)
//   2. หลักที่แปลไม่ออกน้อยกว่า ดีกว่า
//   3. จำนวนหลักที่แปลได้มากกว่า ดีกว่า
// ═══════════════════════════════════════════════════════════════════════════
async function pickStructures(pool, items, asOf) {
    if (!items.length) return new Map();

    const req = pool.request();
    req.input('as_of', sql.Date, asOf || new Date());

    const values = items.map((it, i) => {
        req.input(`b${i}`, sql.VarChar(20), it.batch_code);
        req.input(`m${i}`, sql.VarChar(50), it.mat || null);
        return `(@b${i}, @m${i})`;
    }).join(',');

    const r = await req.query(`
WITH inp AS (
    SELECT batch_code, mat,
           mat_trim = LTRIM(RTRIM(mat)),
           mtype    = LEFT(mat, 2),
           mprefix  = LEFT(mat, 6)
    FROM (VALUES ${values}) v (batch_code, mat)
),
cur AS (
    SELECT s.structure_id, s.structure_code, s.name_th, s.total_digits,
           v.version_id, v.revision_no, v.effective_date,
           rn = ROW_NUMBER() OVER (PARTITION BY s.structure_id
                ORDER BY CASE WHEN v.effective_date <= @as_of THEN 0 ELSE 1 END,
                         v.effective_date DESC, v.revision_no DESC)
    FROM trac_back_batch_structure s
    JOIN trac_back_batch_structure_version v ON v.structure_id = s.structure_id
    WHERE s.is_active = 1
),
seg AS (
    SELECT i.batch_code, i.mat, i.mat_trim, i.mtype, i.mprefix,
           c.structure_id, c.structure_code, c.name_th, c.version_id, c.revision_no,
           g.digit_from, g.digit_to, g.set_id, g.is_confirmed,
           digits  = g.digit_to - g.digit_from + 1,
           raw_val = SUBSTRING(i.batch_code, g.digit_from, g.digit_to - g.digit_from + 1)
    FROM inp i
    JOIN cur c ON c.rn = 1 AND LEN(i.batch_code) = c.total_digits
    JOIN trac_back_batch_segment g ON g.version_id = c.version_id
),
hit AS (
    SELECT seg.*,
           is_hit = CASE WHEN seg.set_id IS NULL THEN NULL
                         WHEN cv.code_value_id IS NOT NULL THEN 1 ELSE 0 END
    FROM seg
    LEFT JOIN trac_back_code_value cv ON cv.set_id = seg.set_id AND cv.code = seg.raw_val
),
scored AS (
    SELECT batch_code, mat, mat_trim, mtype, mprefix,
           structure_id, structure_code, name_th, version_id, revision_no,
           checkable_digits = SUM(CASE WHEN is_hit IS NOT NULL THEN digits ELSE 0 END),
           matched_digits   = SUM(CASE WHEN is_hit = 1 THEN digits ELSE 0 END),
           mismatch_count   = SUM(CASE WHEN is_hit = 0 THEN 1 ELSE 0 END),
           unconfirmed      = SUM(CASE WHEN is_confirmed = 0 THEN 1 ELSE 0 END)
    FROM hit
    GROUP BY batch_code, mat, mat_trim, mtype, mprefix,
             structure_id, structure_code, name_th, version_id, revision_no
),
ruled AS (
    SELECT sc.*,
           -- ชั้น 0: ผูกด้วย mat เต็มจากตารางแยกประเภทวัตถุดิบ (แม่นที่สุด)
           mat_map_hit        = CASE WHEN ms.mat IS NOT NULL THEN 1 ELSE 0 END,
           mat_map_confidence = ms.confidence,
           mat_map_class      = ms.material_class,
           mat_map_source     = ms.source,
           -- ชั้น 1: กติกาเดิม ใช้ต่อสำหรับ mat ที่ยังไม่อยู่ในตารางใหม่
           rp.priority   AS rule_priority,
           rp.confidence AS rule_confidence,
           rp.match_kind
    FROM scored sc
    LEFT JOIN trac_back_mat_structure ms
           ON ms.mat = sc.mat_trim AND ms.structure_id = sc.structure_id
    OUTER APPLY (
        SELECT TOP 1 ru.priority, ru.confidence,
               match_kind = CASE WHEN ru.mat_prefix IS NOT NULL THEN 'mat_prefix' ELSE 'material_type' END
        FROM trac_back_structure_rule ru
        WHERE sc.mat IS NOT NULL
          AND ru.structure_id = sc.structure_id
          AND ( (ru.mat_prefix IS NOT NULL AND sc.mprefix LIKE ru.mat_prefix + '%')
             OR (ru.mat_prefix IS NULL AND ru.material_type_code = sc.mtype) )
        ORDER BY CASE WHEN ru.mat_prefix IS NOT NULL THEN 0 ELSE 1 END, ru.priority
    ) rp
),
best AS (
    SELECT *, rn = ROW_NUMBER() OVER (PARTITION BY batch_code
        ORDER BY
            mat_map_hit DESC,
            CASE mat_map_confidence WHEN 'confirmed' THEN 0
                                    WHEN 'probable'  THEN 1
                                    ELSE 2 END,
            CASE WHEN rule_priority IS NOT NULL THEN 0 ELSE 1 END,
            rule_priority,
            mismatch_count ASC,
            matched_digits DESC,
            checkable_digits DESC)
    FROM ruled
)
SELECT batch_code, mat, structure_code, name_th, version_id, revision_no,
       checkable_digits, matched_digits, mismatch_count, unconfirmed,
       mat_map_hit, mat_map_confidence, mat_map_class, mat_map_source,
       rule_priority, rule_confidence, match_kind,
       score_percent = CAST(100.0 * matched_digits / NULLIF(checkable_digits, 0) AS DECIMAL(5,2))
FROM best WHERE rn = 1;
    `);

    const out = new Map();
    for (const row of r.recordset) out.set(row.batch_code, row);
    return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// ถอดรหัสรายหลัก ตามโครงสร้างที่เลือกไว้แล้ว
// ═══════════════════════════════════════════════════════════════════════════
async function decodeSegments(pool, pairs) {
    if (!pairs.length) return new Map();

    const req = pool.request();
    const values = pairs.map((p, i) => {
        req.input(`b${i}`, sql.VarChar(20), p.batch_code);
        req.input(`v${i}`, sql.Int, p.version_id);
        return `(@b${i}, @v${i})`;
    }).join(',');

    const r = await req.query(`
WITH inp AS (
    SELECT batch_code, version_id FROM (VALUES ${values}) v (batch_code, version_id)
),
d AS (
    SELECT i.batch_code, g.segment_id, g.digit_from, g.digit_to,
           g.group_name_th, g.meaning_th, g.value_type, g.set_id,
           g.date_group, g.date_part, g.is_confirmed, g.note,
           raw_val = SUBSTRING(i.batch_code, g.digit_from, g.digit_to - g.digit_from + 1)
    FROM inp i
    JOIN trac_back_batch_segment g ON g.version_id = i.version_id
)
SELECT
    d.batch_code, d.digit_from, d.digit_to, d.group_name_th, d.meaning_th,
    d.raw_val AS raw_value,
    resolved = CASE WHEN d.value_type IN ('NUMBER','SEQUENCE','FREE') THEN d.raw_val
                    ELSE cv.description_th END,
    numeric_value = CASE WHEN d.value_type = 'NUMBER' THEN TRY_CONVERT(INT, d.raw_val)
                         ELSE cv.numeric_value END,
    d.value_type, d.date_group, d.date_part, d.is_confirmed, d.note,
    status = CASE
        WHEN d.value_type IN ('NUMBER','SEQUENCE','FREE') THEN N'ไม่ต้องแปล'
        WHEN cv.code_value_id IS NOT NULL                 THEN N'แปลได้'
        WHEN d.set_id IS NULL                             THEN N'ยังไม่มีตารางรหัส'
        ELSE N'ไม่พบรหัสนี้ในตาราง' END
FROM d
LEFT JOIN trac_back_code_value cv ON cv.set_id = d.set_id AND cv.code = d.raw_val
ORDER BY d.batch_code, d.digit_from;
    `);

    const out = new Map();
    for (const row of r.recordset) {
        if (!out.has(row.batch_code)) out.set(row.batch_code, []);
        out.get(row.batch_code).push(row);
    }
    return out;
}

/** ประกอบวันที่จาก segment ที่มี date_group / date_part */
function assembleDates(segments) {
    const groups = {};
    for (const s of segments) {
        if (!s.date_group || !s.date_part) continue;
        (groups[s.date_group] ||= {})[s.date_part] = s.numeric_value;
    }
    const out = {};
    for (const [grp, parts] of Object.entries(groups)) {
        const { YEAR: y, MONTH: m, DAY: d } = parts;
        let iso = null;
        if (y != null && m != null && d != null) {
            const year = y < 100 ? 2000 + y : y;   // ปี 2 หลัก เช่น 26 = 2026
            const dt = new Date(Date.UTC(year, m - 1, d));
            if (!isNaN(dt) && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d) {
                iso = dt.toISOString().slice(0, 10);
            }
        }
        out[grp] = { year: y ?? null, month: m ?? null, day: d ?? null, date: iso };
    }
    return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// ★ ฟังก์ชันหลัก — ถอดหลาย batch ทีเดียว ให้ /detail เรียกใช้
//   items: [{ batch_code, mat }]
//   คืน Map: batch_code → { structure, score, segments, dates, warnings }
// ═══════════════════════════════════════════════════════════════════════════
async function decodeBatches(pool, items, asOf) {
    // ตัดค่าที่ไม่ใช่ batch จริงออกก่อน
    const clean = [];
    const seen = new Set();
    for (const it of items) {
        const b = S(it.batch_code).toUpperCase();
        if (!b || b.length !== 10) continue;
        if (/[^A-Z0-9]/.test(b)) continue;                    // มีอักขระแปลก
        if (b === b[0].repeat(10)) continue;                  // 1111111111
        if (b.startsWith('TEST')) continue;
        if (b.includes('000000')) continue;                   // รหัส loaf
        if (it.mat && b.startsWith(S(it.mat))) continue;      // เอา mat มาใส่ช่อง batch
        const key = `${b}|${S(it.mat)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        clean.push({ batch_code: b, mat: S(it.mat) || null });
    }
    if (!clean.length) return new Map();

    const result = new Map();

    // แบ่งก้อนกัน parameter เกิน
    for (let i = 0; i < clean.length; i += MAX_PARAMS / 2) {
        const chunk = clean.slice(i, i + MAX_PARAMS / 2);
        const picked = await pickStructures(pool, chunk, asOf);

        const pairs = [...picked.values()].map(p => ({
            batch_code: p.batch_code, version_id: p.version_id,
        }));
        const segMap = await decodeSegments(pool, pairs);

        for (const [batch, info] of picked.entries()) {
            const segments = segMap.get(batch) || [];
            const dates = assembleDates(segments);

            const warnings = [];
            if (info.mat_map_hit) {
                if (info.mat_map_confidence === 'needs_confirmation') {
                    warnings.push('ผูกโครงสร้างจากตารางแยกประเภทวัตถุดิบ แต่ยังต้องให้ QA ยืนยัน');
                }
            } else if (info.rule_priority) {
                warnings.push('mat นี้ยังไม่อยู่ในตารางแยกประเภทวัตถุดิบ — เลือกจากกติกาเดิม');
            } else if (info.mat) {
                warnings.push('mat นี้ยังไม่อยู่ในตารางแยกประเภทวัตถุดิบ — เลือกจากคะแนนการถอดรหัสอย่างเดียว');
            }
            if (info.mismatch_count > 0)
                warnings.push(`มี ${info.mismatch_count} หลักที่หารหัสไม่เจอ — โครงสร้างอาจไม่ถูก`);
            if (info.checkable_digits < 4)
                warnings.push(`มีหลักให้ตรวจแค่ ${info.checkable_digits} หลัก หลักฐานอ่อน`);
            if (info.unconfirmed > 0)
                warnings.push(`${info.unconfirmed} หลักยังไม่ได้ยืนยันกับเอกสาร SOP`);

            result.set(batch, {
                batch_code: batch,
                structure_code: info.structure_code,
                structure_name: info.name_th,
                revision_no: info.revision_no,
                matched_digits: info.matched_digits,
                checkable_digits: info.checkable_digits,
                mismatch_count: info.mismatch_count,
                score_percent: info.score_percent,
                rule_confidence: info.mat_map_confidence || info.rule_confidence,
                match_kind: info.match_kind,
                decided_by: info.mat_map_hit ? 'mat_class_table'
                          : info.rule_priority ? 'legacy_rule' : 'score_only',
                material_class: info.mat_map_class || null,
                map_confidence: info.mat_map_confidence || null,
                receive_date: dates.RECEIVE?.date ?? null,
                produce_date: dates.PRODUCE?.date ?? null,
                process_2x_date: dates.PROCESS_2X?.date ?? null,
                dates,
                segments: segments.map(s => ({
                    digit_from: s.digit_from,
                    digit_to: s.digit_to,
                    group: s.group_name_th,
                    meaning: s.meaning_th,
                    raw: s.raw_value,
                    resolved: s.resolved,
                    status: s.status,
                    is_confirmed: !!s.is_confirmed,
                })),
                warnings,
            });
        }
    }
    return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /batch/coverage — ภาพรวมว่าถอดได้กี่ %  (ใช้ทำ dashboard คุณภาพข้อมูล)
// ═══════════════════════════════════════════════════════════════════════════
let COVERAGE_CACHE = null;
let COVERAGE_AT = 0;
const COVERAGE_TTL = 10 * 60 * 1000;   // cache 10 นาที

router.get('/batch/coverage', async (req, res) => {
    try {
        const force = S(req.query.refresh) === '1';
        if (!force && COVERAGE_CACHE && Date.now() - COVERAGE_AT < COVERAGE_TTL) {
            return res.json({ success: true, cached: true, data: COVERAGE_CACHE });
        }

        const pool = await connectToDatabase();
        if (!pool) return res.status(503).json({ success: false, error: 'เชื่อมต่อฐานข้อมูลไม่ได้' });

        const request = pool.request();
        request.timeout = 120000;   // query นี้หนัก ให้เวลามากกว่าปกติ

        const r = await request.query(`
-- นับจากตาราง Batch อย่างเดียว ไม่ join กลับไปหาล็อต/สินค้า
-- เพราะ join จะทำให้แถวบานเป็นหลายแสนก่อนจะ GROUP BY
WITH b AS (
    SELECT batch_code = batch_before, uses = COUNT(*)
    FROM Batch
    WHERE batch_before IS NOT NULL
      AND LEN(batch_before) = 10
      AND batch_before NOT LIKE '%[^A-Z0-9]%'
      AND batch_before NOT LIKE 'TEST%'
      AND batch_before NOT LIKE '%000000%'
    GROUP BY batch_before
),
cur AS (
    SELECT s.structure_id, s.structure_code, s.total_digits, v.version_id,
           rn = ROW_NUMBER() OVER (PARTITION BY s.structure_id
                ORDER BY v.effective_date DESC, v.revision_no DESC)
    FROM trac_back_batch_structure s
    JOIN trac_back_batch_structure_version v ON v.structure_id = s.structure_id
    WHERE s.is_active = 1
),
sc AS (
    SELECT b.batch_code, b.uses, c.structure_code,
           checkable = SUM(CASE WHEN g.set_id IS NOT NULL THEN g.digit_to - g.digit_from + 1 ELSE 0 END),
           matched   = SUM(CASE WHEN cv.code_value_id IS NOT NULL THEN g.digit_to - g.digit_from + 1 ELSE 0 END),
           mismatch  = SUM(CASE WHEN g.set_id IS NOT NULL AND cv.code_value_id IS NULL THEN 1 ELSE 0 END)
    FROM b
    JOIN cur c ON c.rn = 1 AND LEN(b.batch_code) = c.total_digits
    JOIN trac_back_batch_segment g ON g.version_id = c.version_id
    LEFT JOIN trac_back_code_value cv
           ON cv.set_id = g.set_id
          AND cv.code = SUBSTRING(b.batch_code, g.digit_from, g.digit_to - g.digit_from + 1)
    GROUP BY b.batch_code, b.uses, c.structure_code
),
best AS (
    SELECT *, rn = ROW_NUMBER() OVER (PARTITION BY batch_code
             ORDER BY mismatch ASC, matched DESC, checkable DESC)
    FROM sc
),
final AS (
    SELECT batch_code, uses, structure_code, checkable, matched, mismatch,
           level_th = CASE
               WHEN mismatch = 0 AND checkable >= 6 THEN N'1. ถอดได้มั่นใจ'
               WHEN mismatch = 0 AND checkable >= 3 THEN N'2. ถอดได้ หลักฐานปานกลาง'
               WHEN mismatch = 0                    THEN N'3. ถอดได้ หลักฐานอ่อน'
               WHEN mismatch = 1                    THEN N'4. เกือบตรง ผิด 1 หลัก'
               ELSE                                      N'5. ไม่มีโครงสร้างไหนตรง' END
    FROM best WHERE rn = 1
)
SELECT level_th,
       batches = COUNT(*),
       uses    = SUM(uses),
       pct     = CAST(100.0 * COUNT(*) / SUM(COUNT(*)) OVER () AS DECIMAL(5,2))
FROM final
GROUP BY level_th
ORDER BY level_th;

-- ชุดที่ 2: แยกตามโครงสร้าง
WITH b AS (
    SELECT batch_code = batch_before, uses = COUNT(*)
    FROM Batch
    WHERE batch_before IS NOT NULL
      AND LEN(batch_before) = 10
      AND batch_before NOT LIKE '%[^A-Z0-9]%'
      AND batch_before NOT LIKE 'TEST%'
      AND batch_before NOT LIKE '%000000%'
    GROUP BY batch_before
),
cur AS (
    SELECT s.structure_id, s.structure_code, s.name_th, s.total_digits, v.version_id,
           rn = ROW_NUMBER() OVER (PARTITION BY s.structure_id
                ORDER BY v.effective_date DESC, v.revision_no DESC)
    FROM trac_back_batch_structure s
    JOIN trac_back_batch_structure_version v ON v.structure_id = s.structure_id
    WHERE s.is_active = 1
),
sc AS (
    SELECT b.batch_code, b.uses, c.structure_code, c.name_th,
           checkable = SUM(CASE WHEN g.set_id IS NOT NULL THEN g.digit_to - g.digit_from + 1 ELSE 0 END),
           matched   = SUM(CASE WHEN cv.code_value_id IS NOT NULL THEN g.digit_to - g.digit_from + 1 ELSE 0 END),
           mismatch  = SUM(CASE WHEN g.set_id IS NOT NULL AND cv.code_value_id IS NULL THEN 1 ELSE 0 END)
    FROM b
    JOIN cur c ON c.rn = 1 AND LEN(b.batch_code) = c.total_digits
    JOIN trac_back_batch_segment g ON g.version_id = c.version_id
    LEFT JOIN trac_back_code_value cv
           ON cv.set_id = g.set_id
          AND cv.code = SUBSTRING(b.batch_code, g.digit_from, g.digit_to - g.digit_from + 1)
    GROUP BY b.batch_code, b.uses, c.structure_code, c.name_th
),
best AS (
    SELECT *, rn = ROW_NUMBER() OVER (PARTITION BY batch_code
             ORDER BY mismatch ASC, matched DESC, checkable DESC)
    FROM sc
)
SELECT structure_code, name_th,
       batches  = COUNT(*),
       uses     = SUM(uses),
       clean    = SUM(CASE WHEN mismatch = 0 THEN 1 ELSE 0 END),
       avg_matched = CAST(AVG(CAST(matched AS FLOAT)) AS DECIMAL(5,2))
FROM best WHERE rn = 1
GROUP BY structure_code, name_th
ORDER BY uses DESC;
        `);

        const data = {
            by_level: r.recordsets[0] || [],
            by_structure: r.recordsets[1] || [],
            generated_at: new Date().toISOString(),
        };

        COVERAGE_CACHE = data;
        COVERAGE_AT = Date.now();

        res.json({ success: true, cached: false, data });
    } catch (err) {
        console.error('❌ [traceback/batch/coverage]', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /batch/:batch_code — ถอดรหัส batch ตัวเดียว
//   query: ?mat=4100415  ส่ง mat มาด้วยจะเลือกโครงสร้างแม่นขึ้นมาก
//          ?as_of=2026-01-01  ใช้รุ่นเอกสารที่บังคับใช้ ณ วันนั้น
//          ?structure=FRUIT_VEG  บังคับใช้โครงสร้างที่ระบุ
// ═══════════════════════════════════════════════════════════════════════════
router.get('/batch/:batch_code', async (req, res) => {
    try {
        const batchCode = S(req.params.batch_code).toUpperCase();
        if (batchCode.length !== 10)
            return res.status(400).json({ success: false, error: 'รหัส batch ต้องยาว 10 หลัก' });

        const pool = await connectToDatabase();
        if (!pool) return res.status(503).json({ success: false, error: 'เชื่อมต่อฐานข้อมูลไม่ได้' });

        const mat = S(req.query.mat) || null;
        const asOf = S(req.query.as_of) ? new Date(S(req.query.as_of)) : new Date();
        const forced = S(req.query.structure);

        // บังคับโครงสร้าง — ใช้ proc เดิม เพราะเป็นการเรียกครั้งเดียว
        if (forced) {
            const r = await pool.request()
                .input('batch_code', sql.VarChar(20), batchCode)
                .input('structure_code', sql.VarChar(30), forced)
                .input('as_of_date', sql.Date, asOf)
                .execute('usp_trac_back_decode_batch');
            return res.json({
                success: true,
                data: {
                    batch_code: batchCode,
                    structure_code: forced,
                    segments: r.recordsets[0] || [],
                    dates: r.recordsets[1] || [],
                    score: (r.recordsets[2] || [])[0] || null,
                },
            });
        }

        const decoded = await decodeBatches(pool, [{ batch_code: batchCode, mat }], asOf);
        const hit = decoded.get(batchCode);

        if (!hit) {
            // บอกให้ชัดว่าทำไมถอดไม่ได้
            const candidates = await pool.request()
                .input('batch_code', sql.VarChar(20), batchCode)
                .input('mat', sql.VarChar(50), mat)
                .execute('usp_trac_back_detect_structure');
            return res.json({
                success: true,
                data: {
                    batch_code: batchCode,
                    structure_code: null,
                    reason: 'ไม่มีโครงสร้างไหนเข้ากับรหัสนี้ หรือรหัสไม่ผ่านการตรวจรูปแบบ',
                    candidates: candidates.recordset || [],
                },
            });
        }

        res.json({ success: true, data: hit });
    } catch (err) {
        console.error('❌ [traceback/batch]', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /batch/:batch_code/trace — สอบกลับย้อนทาง
//   ใส่เลข batch วัตถุดิบ → ได้ว่าถูกใช้ในล็อตไหน ออกไปเป็นสินค้าอะไรบ้าง
//   ใช้ตอนต้องเรียกคืนสินค้า
// ═══════════════════════════════════════════════════════════════════════════
router.get('/batch/:batch_code/trace', async (req, res) => {
    try {
        const batchCode = S(req.params.batch_code).toUpperCase();
        if (!batchCode) return res.status(400).json({ success: false, error: 'ต้องระบุ batch' });

        const pool = await connectToDatabase();
        if (!pool) return res.status(503).json({ success: false, error: 'เชื่อมต่อฐานข้อมูลไม่ได้' });

        // ล็อตที่ใช้ batch นี้
        const lots = (await pool.request()
            .input('batch', sql.VarChar(50), batchCode)
            .query(`
                SELECT
                    b.batch_id, b.mapping_id, b.batch_before, b.batch_after,
                    pr.mat, rm.mat_name,
                    p.prod_id, p.doc_no, p.code,
                    rmm.weight_RM, rmm.rmfp_id,
                    htr.rmm_line_name,
                    CONVERT(VARCHAR, htr.rmit_date, 120)    AS rmit_date,
                    CONVERT(VARCHAR, htr.sc_pack_date, 120) AS sc_pack_date,
                    DATEDIFF(MINUTE, htr.rmit_date, htr.sc_pack_date) AS delay_minutes
                FROM Batch b
                JOIN TrolleyRMMapping rmm ON rmm.mapping_id = b.mapping_id
                JOIN ProdRawMat pr        ON rmm.tro_production_id = pr.prod_rm_id
                JOIN RawMat     rm        ON pr.mat = rm.mat
                JOIN Production p         ON pr.prod_id = p.prod_id
                OUTER APPLY (SELECT TOP 1 * FROM History h
                             WHERE h.mapping_id = rmm.mapping_id ORDER BY h.hist_id DESC) htr
                WHERE b.batch_before = @batch OR b.batch_after = @batch
                ORDER BY htr.sc_pack_date DESC
            `)).recordset;

        if (!lots.length)
            return res.status(404).json({ success: false, error: 'ไม่พบล็อตที่ใช้ batch นี้' });

        // สรุปเป็นรายสินค้า สำหรับใช้เรียกคืน
        const byProduct = new Map();
        for (const l of lots) {
            const key = `${l.doc_no}|${l.code}`;
            let g = byProduct.get(key);
            if (!g) {
                g = {
                    doc_no: l.doc_no, code: l.code, prod_id: l.prod_id,
                    lots: 0, total_weight: 0, mapping_ids: [],
                    lines: new Set(),
                    pack_first: null, pack_last: null,
                };
                byProduct.set(key, g);
            }
            g.lots++;
            g.total_weight += Number(l.weight_RM) || 0;
            g.mapping_ids.push(l.mapping_id);
            if (l.rmm_line_name) g.lines.add(l.rmm_line_name);
            if (l.sc_pack_date && (!g.pack_first || l.sc_pack_date < g.pack_first)) g.pack_first = l.sc_pack_date;
            if (l.sc_pack_date && (!g.pack_last  || l.sc_pack_date > g.pack_last))  g.pack_last  = l.sc_pack_date;
        }

        const products = [...byProduct.values()].map(g => ({
            ...g,
            lines: [...g.lines],
            total_weight: Number(g.total_weight.toFixed(3)),
        }));

        // ถอดรหัส batch ด้วย mat ตัวแรกที่เจอ
        const decoded = await decodeBatches(pool, [{ batch_code: batchCode, mat: lots[0].mat }]);

        res.json({
            success: true,
            data: {
                batch_code: batchCode,
                decoded: decoded.get(batchCode) || null,
                summary: {
                    lot_count: lots.length,
                    product_count: products.length,
                    total_weight: Number(lots.reduce((a, l) => a + (Number(l.weight_RM) || 0), 0).toFixed(3)),
                    mats: [...new Set(lots.map(l => l.mat))],
                    mat_names: [...new Set(lots.map(l => l.mat_name))],
                    pack_date_first: products.reduce((a, p) => (!a || (p.pack_first && p.pack_first < a) ? p.pack_first : a), null),
                    pack_date_last: products.reduce((a, p) => (!a || (p.pack_last && p.pack_last > a) ? p.pack_last : a), null),
                },
                products,
                lots,
            },
        });
    } catch (err) {
        console.error('❌ [traceback/batch/trace]', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
module.exports.decodeBatches = decodeBatches;