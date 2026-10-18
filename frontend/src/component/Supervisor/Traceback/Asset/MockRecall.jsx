// จำลองการเรียกคืนสินค้า (Mock Recall Protocol)
//   จับเวลาเทียบเป้า (ค่าเริ่มต้น 2 ชม.), เช็กลิสต์ 7 ขั้นตอน, ดึงข้อมูลจากระบบ, สมดุลมวล, ลงนาม, ออก PDF
//   ฉบับร่างเก็บในเครื่องผู้ใช้ (กันข้อมูลหายระหว่างทำ) — เอกสารจริงคือ PDF ที่ลงนาม
import { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { T, TYPE_LABEL, inputCss } from './tracebackUI';
import { Tag, Kpi, Card, Btn, Segmented, SimpleTable, Spinner, Field } from './TraceAtoms';
import { fmtDT, fmtNum, fmtDur, currentUserName } from './tracebackCore';
import { exportRecallPDF } from './tracebackExport';

const API_URL = import.meta.env.VITE_API_URL;
const DRAFT_KEY = 'pfcm_mock_recall_draft';

const STEP_LABELS = [
  'กำหนดสถานการณ์และรหัสเริ่มต้น',
  'ระบุวัตถุดิบ / ส่วนผสม / บรรจุภัณฑ์ที่เกี่ยวข้อง (สอบย้อนกลับ)',
  'ระบุสินค้าที่ได้รับผลกระทบ (สอบไปข้างหน้า)',
  'ตรวจยอดคงคลังและกักสินค้า (Hold)',
  'ตรวจสอบรายการส่งลูกค้า / ปลายทาง',
  'คำนวณสมดุลมวล (Mass balance)',
  'แจ้งผู้เกี่ยวข้องและสรุปผล',
];

const newRecordNo = () => {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `MR-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
};

const blank = () => ({
  recordNo: newRecordNo(),
  direction: 'forward',
  startType: 'auto',
  startCode: '',
  scenario: '',
  team: currentUserName(),
  targetMin: 120,
  startedAt: null,
  endedAt: null,
  steps: STEP_LABELS.map(label => ({ label, done: false, doneAt: null, note: '' })),
  traced: null,
  products: [],
  mb: { produced: '', onHand: '', shipped: '', waste: '' },
  conclusion: '',
  sign: { recordedBy: currentUserName(), reviewedBy: '', qcManager: '' },
});

const readDraft = () => {
  try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); return d && d.steps ? d : null; } catch { return null; }
};

const num = v => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v));

const MockRecall = ({ seed, onSeedUsed, onOpenRecord }) => {
  const [p, setP] = useState(() => readDraft() || blank());
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setP(prev => ({ ...prev, [k]: v }));

  // รับผลจากหน้า Forward ("เริ่ม Mock Recall")
  useEffect(() => {
    if (!seed) return;
    setP(prev => ({
      ...blank(),
      team: prev.team,
      direction: 'forward',
      startType: seed.type,
      startCode: seed.code,
      startedAt: new Date().toISOString(),
      traced: seed.summary?.total_weight ?? null,
      products: seed.products || [],
      steps: blank().steps.map((st, i) => (i <= 2 ? { ...st, done: true, doneAt: new Date().toISOString(), note: i === 2 ? `${seed.summary?.product_count || 0} เอกสาร / ${seed.summary?.lot_count || 0} ล็อต` : st.note } : st)),
    }));
    onSeedUsed?.();
  }, [seed, onSeedUsed]);

  // บันทึกร่างทุกครั้งที่แก้
  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(p)); } catch (e) { console.error('Mock recall draft save error:', e); }
  }, [p]);

  // นาฬิกาจับเวลา
  useEffect(() => {
    if (!p.startedAt || p.endedAt) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [p.startedAt, p.endedAt]);

  const elapsedMs = p.startedAt ? (p.endedAt ? new Date(p.endedAt) : new Date(now)) - new Date(p.startedAt) : 0;
  const elapsedMin = p.startedAt ? Math.round(elapsedMs / 60000) : null;
  const overTarget = elapsedMin != null && elapsedMin > p.targetMin;
  const clock = useMemo(() => {
    const t = Math.max(0, Math.floor(elapsedMs / 1000));
    const pad = n => String(n).padStart(2, '0');
    return `${pad(Math.floor(t / 3600))}:${pad(Math.floor((t % 3600) / 60))}:${pad(t % 60)}`;
  }, [elapsedMs]);

  const toggleStep = (i) => setP(prev => ({
    ...prev,
    steps: prev.steps.map((st, j) => (j === i ? { ...st, done: !st.done, doneAt: !st.done ? new Date().toISOString() : null } : st)),
  }));
  const noteStep = (i, v) => setP(prev => ({ ...prev, steps: prev.steps.map((st, j) => (j === i ? { ...st, note: v } : st)) }));

  const pull = useCallback(async () => {
    const c = p.startCode.trim();
    if (!c) { setError('กรุณาระบุรหัสเริ่มต้น'); return; }
    try {
      setLoading(true); setError('');
      if (p.direction === 'forward') {
        const res = await axios.get(`${API_URL}/api/traceback/forward`, { params: { code: c, type: p.startType } });
        const d = res.data?.data || {};
        setP(prev => ({
          ...prev,
          traced: d.summary?.total_weight ?? null,
          products: d.products || [],
          steps: prev.steps.map((st, i) => (i === 2 ? { ...st, done: true, doneAt: new Date().toISOString(), note: `${d.summary?.product_count || 0} เอกสาร / ${d.summary?.lot_count || 0} ล็อต` } : st)),
        }));
      } else {
        const res = await axios.get(`${API_URL}/api/traceback/detail`, { params: { doc_no: c } });
        const s = res.data?.data?.summary || {};
        setP(prev => ({
          ...prev,
          traced: s.total_weight_rm ?? null,
          products: [{ doc_no: s.doc_no, code: s.code, lots: s.material_count, total_weight: s.total_weight_rm }],
          steps: prev.steps.map((st, i) => (i === 1 ? { ...st, done: true, doneAt: new Date().toISOString(), note: `${s.material_count || 0} ล็อต · ผู้ขาย ${(s.supplier_list || []).length} ราย` } : st)),
        }));
      }
    } catch (e) {
      console.error('Mock recall pull error:', e);
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, [p.startCode, p.startType, p.direction]);

  const produced = num(p.mb.produced);
  const located = [p.mb.onHand, p.mb.shipped, p.mb.waste].map(num).reduce((a, v) => a + (v || 0), 0);
  const recoveryPct = produced ? Math.round((located / produced) * 1000) / 10 : null;
  const doneCount = p.steps.filter(st => st.done).length;

  const reset = () => {
    if (window.confirm('ล้างบันทึกนี้และเริ่มใหม่?')) setP(blank());
  };

  const exportPdf = () => exportRecallPDF({
    ...p,
    startType: TYPE_LABEL[p.startType] || p.startType,
    endedAt: p.endedAt || (p.startedAt ? new Date().toISOString() : null),
    elapsedMin,
    massBalance: { traced: p.traced, produced, onHand: num(p.mb.onHand), shipped: num(p.mb.shipped), waste: num(p.mb.waste), recoveryPct },
  });

  return (
    <div>
      {/* ── หัว + นาฬิกา ── */}
      <div style={{
        background: overTarget ? T.bad : T.blueDeep, color: T.white, borderRadius: 14, padding: '14px 18px',
        display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>บันทึกการจำลองการเรียกคืน · {p.recordNo}</div>
          <div style={{ fontSize: 30, fontWeight: 700, fontFamily: 'ui-monospace,monospace', letterSpacing: 2 }}>{clock}</div>
          <div style={{ fontSize: 12.5 }}>
            เป้าหมาย ≤ {fmtDur(p.targetMin)} · ขั้นตอนเสร็จ {doneCount}/{p.steps.length}
            {overTarget && ' · เกินเป้าหมายแล้ว'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!p.startedAt && <Btn onClick={() => set('startedAt', new Date().toISOString())}>เริ่มจับเวลา</Btn>}
          {p.startedAt && !p.endedAt && <Btn onClick={() => set('endedAt', new Date().toISOString())}>หยุดเวลา (เสร็จสิ้น)</Btn>}
          {p.endedAt && <Btn variant="outline" onClick={() => set('endedAt', null)}>จับเวลาต่อ</Btn>}
          <Btn variant="outline" onClick={exportPdf}>ออก PDF โปรโตคอล</Btn>
          <Btn variant="ghost" onClick={reset}>เริ่มใหม่</Btn>
        </div>
      </div>

      {/* ── สถานการณ์ ── */}
      <Card title="1. สถานการณ์จำลองและรหัสเริ่มต้น">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
          <Field label="ทิศทางการทดสอบ">
            <Segmented value={p.direction} onChange={v => set('direction', v)} options={[
              { value: 'forward', label: 'ไปข้างหน้า (รหัสรุ่น → สินค้า)' },
              { value: 'backward', label: 'ย้อนกลับ (เอกสาร → วัตถุดิบ)' },
            ]} />
          </Field>
          {p.direction === 'forward' && (
            <Field label="ประเภทรหัส">
              <select value={p.startType} onChange={e => set('startType', e.target.value)} style={inputCss}>
                {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
          )}
          <Field label={p.direction === 'forward' ? 'รหัสรุ่น / Lot' : 'เลขเอกสารผลิต (doc_no)'}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={p.startCode} onChange={e => set('startCode', e.target.value.toUpperCase())} style={{ ...inputCss, fontFamily: 'ui-monospace,monospace' }} />
              <Btn variant="blue" onClick={pull} disabled={loading}>{loading ? <Spinner size={14} /> : null} ดึงข้อมูล</Btn>
            </div>
          </Field>
          <Field label="เป้าหมายเวลา (นาที)">
            <input type="number" min="15" value={p.targetMin} onChange={e => set('targetMin', Number(e.target.value) || 120)} style={inputCss} />
          </Field>
          <Field label="สถานการณ์ / เหตุผล" width="100%">
            <input value={p.scenario} onChange={e => set('scenario', e.target.value)} placeholder="เช่น ลูกค้าแจ้งพบสิ่งแปลกปลอม / ทดสอบประจำไตรมาส" style={inputCss} />
          </Field>
          <Field label="ทีมเรียกคืน">
            <input value={p.team} onChange={e => set('team', e.target.value)} style={inputCss} />
          </Field>
        </div>
        {error && <div style={{ marginTop: 10 }}><Tag tone="bad">{error}</Tag></div>}
      </Card>

      {/* ── ขั้นตอน ── */}
      <Card title="2. เช็กลิสต์ขั้นตอน" right={`${doneCount}/${p.steps.length}`} tone="orange">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {p.steps.map((st, i) => (
            <div key={st.label} style={{
              display: 'grid', gridTemplateColumns: '32px minmax(180px,1fr) minmax(160px,1fr)', gap: 10, alignItems: 'center',
              border: `1px solid ${st.done ? T.okLine : T.line}`, background: st.done ? T.okSoft : T.white, borderRadius: 10, padding: '8px 10px',
            }}>
              <input type="checkbox" checked={st.done} onChange={() => toggleStep(i)} aria-label={st.label} style={{ width: 20, height: 20 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{i + 1}. {st.label}</div>
                {st.doneAt && <div style={{ fontSize: 11.5, color: T.ok }}>เสร็จ {fmtDT(st.doneAt)}</div>}
              </div>
              <input value={st.note} onChange={e => noteStep(i, e.target.value)} placeholder="บันทึก" style={{ ...inputCss, height: 32 }} />
            </div>
          ))}
        </div>
      </Card>

      {/* ── ผลจากระบบ ── */}
      <Card title="3. สินค้าที่เกี่ยวข้องจากระบบ" right={`วัตถุดิบที่สอบกลับได้ ${fmtNum(p.traced, 1)} kg`}>
        <SimpleTable
          rows={p.products} getKey={x => `${x.doc_no}|${x.code}`}
          empty="กด ดึงข้อมูล เพื่อดึงรายการจากระบบ"
          columns={[
            { key: 'doc_no', label: 'เลขเอกสาร', render: x => <b>{x.doc_no}</b> },
            { key: 'code', label: 'Code', wrap: true },
            { key: 'lots', label: 'ล็อต', align: 'right' },
            { key: 'total_weight', label: 'kg', align: 'right', render: x => fmtNum(x.total_weight, 1) },
            { key: 'open', label: '', render: x => (onOpenRecord ? <Btn variant="outline" style={{ height: 28, fontSize: 12 }} onClick={() => onOpenRecord(x.doc_no, x.code)}>เปิดใบสอบกลับ</Btn> : null) },
          ]}
        />
      </Card>

      {/* ── สมดุลมวล ── */}
      <Card title="4. สมดุลมวล (Mass balance)" tone="orange">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
          {[['produced', 'ผลิตเป็นสินค้า (kg)'], ['onHand', 'คงคลัง / กักได้ (kg)'], ['shipped', 'ส่งลูกค้าแล้ว (kg)'], ['waste', 'ของเสีย / ทำลาย (kg)']].map(([k, l]) => (
            <Field key={k} label={l}>
              <input type="number" value={p.mb[k]} onChange={e => set('mb', { ...p.mb, [k]: e.target.value })} style={inputCss} />
            </Field>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10, marginTop: 12 }}>
          <Kpi label="วัตถุดิบที่สอบกลับได้" value={`${fmtNum(p.traced, 1)} kg`} />
          <Kpi label="ระบุตำแหน่งได้" value={`${fmtNum(located, 1)} kg`} />
          <Kpi label="ระบุได้ (%)" value={recoveryPct == null ? '—' : `${recoveryPct}%`}
            tone={recoveryPct == null ? 'blue' : recoveryPct >= 99 ? 'ok' : recoveryPct >= 95 ? 'orange' : 'bad'}
            sub="เกณฑ์ทั่วไป ≥ 99–100%" />
        </div>
      </Card>

      {/* ── สรุป + ลงนาม ── */}
      <Card title="5. สรุปผลและผู้ลงนาม">
        <Field label="สรุปผล / การแก้ไขป้องกัน" width="100%">
          <textarea value={p.conclusion} onChange={e => set('conclusion', e.target.value)} rows={3}
            style={{ ...inputCss, height: 'auto', padding: 10, resize: 'vertical' }} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginTop: 12 }}>
          {[['recordedBy', 'ผู้จัดทำ'], ['reviewedBy', 'ผู้ทวนสอบ'], ['qcManager', 'ผู้อนุมัติ (QA/QC Manager)']].map(([k, l]) => (
            <Field key={k} label={l}>
              <input value={p.sign[k]} onChange={e => set('sign', { ...p.sign, [k]: e.target.value })} style={inputCss} />
            </Field>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default MockRecall;
