// สอบกลับไปข้างหน้า (Trace Forward / Impact Analysis)
//   สแกนหรือพิมพ์รหัสรุ่นวัตถุดิบ / ส่วนผสม / Lot บรรจุภัณฑ์ → สินค้าทุกเอกสารที่ได้รับผลกระทบ
//   แยก "บรรจุแล้ว" กับ "ยังอยู่ในกระบวนการ (กักได้ทันที)" เพื่อใช้ตัดสินใจเรียกคืน/กักสินค้า
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import axios from 'axios';
import { T, TYPE_LABEL, inputCss } from './tracebackUI';
import { Tag, Kpi, Card, Btn, Segmented, SimpleTable, Spinner } from './TraceAtoms';
import { fmtDT, fmtNum, readRecent, pushRecent, readVariants, saveVariants, downloadCsv, uniq, factoryDay, fmtDay } from './tracebackCore';
import ForwardLotsGrid from './ForwardLotsGrid';
import { HoldDialog } from './HoldList';
import { exportForwardExcel, exportForwardPDF } from './tracebackExport';

const API_URL = import.meta.env.VITE_API_URL;

const TYPE_OPTIONS = ['auto', 'rm', 'ing', 'pkg'].map(v => ({ value: v, label: TYPE_LABEL[v] }));
const LOT_FILTERS = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'packed', label: 'บรรจุแล้ว' },
  { value: 'wip', label: 'ยังอยู่ในกระบวนการ' },
];

/** รวมผล forward หลายรหัสเป็นชุดเดียว (สินค้าที่ซ้ำกันรวมยอด) */
const mergeForward = (list, type) => {
  const lots = new Map();
  list.forEach(d => (d.lots || []).forEach(l => lots.set(l.mapping_id, l)));
  const products = new Map();
  list.forEach(d => (d.products || []).forEach(p => {
    const k = `${p.doc_no}|${p.code}`;
    const g = products.get(k);
    if (!g) products.set(k, { ...p, lines: [...(p.lines || [])], mats: [...(p.mats || [])] });
    else {
      g.lots += p.lots; g.packed += p.packed; g.in_process += p.in_process; g.total_weight = Math.round((g.total_weight + p.total_weight) * 1000) / 1000;
      g.lines = uniq([...g.lines, ...(p.lines || [])]); g.mats = uniq([...g.mats, ...(p.mats || [])]);
      if (p.pack_first && (!g.pack_first || p.pack_first < g.pack_first)) g.pack_first = p.pack_first;
      if (p.pack_last && (!g.pack_last || p.pack_last > g.pack_last)) g.pack_last = p.pack_last;
    }
  }));
  const all = [...lots.values()];
  const dates = all.map(l => l.sc_pack_date).filter(Boolean).sort();
  return {
    code: list.map(d => d.code).join(', '), type, multi: true,
    matched_types: uniq(list.flatMap(d => d.matched_types || [])),
    summary: {
      product_count: products.size, lot_count: all.length,
      packed_count: all.filter(l => l.sc_pack_date).length, in_process_count: all.filter(l => !l.sc_pack_date).length,
      total_weight: Math.round(all.reduce((a, l) => a + (Number(l.weight_RM) || 0), 0) * 1000) / 1000,
      lines: uniq(all.map(l => l.rmm_line_name)), pack_date_first: dates[0] || null, pack_date_last: dates[dates.length - 1] || null,
    },
    sources: list.flatMap(d => d.sources || []),
    products: [...products.values()].sort((a, b) => String(b.pack_last || '').localeCompare(String(a.pack_last || ''))),
    lots: all,
    errors: Object.assign({}, ...list.map(d => d.errors || {})),
    elapsed_ms: list.reduce((a, d) => a + (d.elapsed_ms || 0), 0),
    per_code: list.map(d => ({ code: d.code, products: d.summary?.product_count || 0, lots: d.summary?.lot_count || 0 })),
  };
};

const impactText = (d) => {
  const s = d.summary || {};
  return [
    `🔎 สอบกลับไปข้างหน้า (${TYPE_LABEL[d.type] || d.type})`,
    `รหัส : ${d.code}`,
    `เอกสารผลิตที่กระทบ : ${s.product_count} เอกสาร`,
    `ล็อต : ${s.lot_count} (บรรจุแล้ว ${s.packed_count} · ในกระบวนการ ${s.in_process_count})`,
    `น้ำหนักรวม : ${fmtNum(s.total_weight, 1)} kg`,
    `ไลน์ : ${(s.lines || []).join(', ') || '-'}`,
    `ช่วงบรรจุ : ${fmtDT(s.pack_date_first)} → ${fmtDT(s.pack_date_last)}`,
    '',
    ...(d.products || []).slice(0, 15).map(p => `• ${p.doc_no} | ${p.code} | ${p.lots} ล็อต${p.in_process ? ` (ในกระบวนการ ${p.in_process})` : ''}`),
    (d.products || []).length > 15 ? `…และอีก ${(d.products || []).length - 15} เอกสาร` : '',
  ].filter(x => x !== undefined).join('\n');
};

const ForwardTrace = ({ initialCode = '', initialType = 'auto', onOpenRecord, onStartRecall, onQueryChange, onHoldsChanged }) => {
  const [multi, setMulti] = useState(false);
  const [multiText, setMultiText] = useState('');
  const [variants, setVariants] = useState(readVariants);
  const [holdOpen, setHoldOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [code, setCode] = useState(initialCode);
  const [type, setType] = useState(initialType);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lotFilter, setLotFilter] = useState('all');
  const [flt, setFlt] = useState({ doc: '', code: '', mat: '', line: '', from: '', to: '' }); // narrows the result already found (the day starts at 05:30)
  const setF = (k, v) => setFlt(p => ({ ...p, [k]: v }));
  const [recent, setRecent] = useState(() => readRecent().filter(r => r.kind === 'fwd'));
  const inputRef = useRef(null);

  const run = useCallback(async (c = code, t = type) => {
    const q = String(c || '').trim();
    if (!q) { setError('กรุณาสแกนหรือพิมพ์รหัสรุ่น / Lot'); inputRef.current?.focus(); return; }
    try {
      setLoading(true); setError(''); setData(null); setNotice('');
      const res = await axios.get(`${API_URL}/api/traceback/forward`, { params: { code: q, type: t } });
      setData(res.data?.data || null);
      setRecent(pushRecent({ kind: 'fwd', code: q, type: t }).filter(r => r.kind === 'fwd'));
      onQueryChange?.({ code: q, type: t });
    } catch (e) {
      console.error('Trace forward error:', e);
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, [code, type, onQueryChange]);

  // หลายรหัสพร้อมกัน (Where-used list ของหลาย batch): วางรหัสคั่นด้วยบรรทัดใหม่ / , / ช่องว่าง
  const runMulti = async () => {
    const codes = uniq(multiText.split(/[\s,;]+/).map(x => x.trim().toUpperCase()).filter(Boolean)).slice(0, 50);
    if (!codes.length) { setError('วางรหัสอย่างน้อย 1 รหัส'); return; }
    try {
      setLoading(true); setError(''); setData(null); setNotice('');
      const out = [];
      for (const c of codes) {
        try {
          const r = await axios.get(`${API_URL}/api/traceback/forward`, { params: { code: c, type } });
          if (r.data?.data) out.push(r.data.data);
        } catch (e) { console.error('Trace forward (multi) error:', c, e.message); }
      }
      setData(mergeForward(out, type));
    } finally { setLoading(false); }
  };

  const saveVariant = () => {
    const q = multi ? multiText.trim() : code.trim();
    if (!q) return;
    const name = window.prompt('ตั้งชื่อการค้นหานี้ (บันทึกไว้ในเครื่องนี้)', q.slice(0, 30));
    if (!name) return;
    setVariants(saveVariants([{ name, code: q, type, multi }, ...variants.filter(v => v.name !== name)]));
  };
  const applyVariant = (v) => {
    setType(v.type); setMulti(!!v.multi);
    if (v.multi) { setMultiText(v.code); } else { setCode(v.code); run(v.code, v.type); }
  };

  const exportCsv = () => {
    if (!data) return;
    downloadCsv(`Traceforward_${String(data.code).slice(0, 40)}_${new Date().toISOString().slice(0, 10)}.csv`,
      ['CHARG', 'MATNR', 'MAKTX', 'DOC_NO', 'PRODUCT_CODE', 'LINE', 'MENGE', 'MEINS', 'PREP_DATE', 'PACK_DATE', 'STATUS', 'MAPPING_ID'],
      (data.lots || []).map(l => [l.batch_before || '', l.mat, l.mat_name, l.doc_no, l.code, l.rmm_line_name, l.weight_RM, 'KG',
        l.rmit_date || '', l.sc_pack_date || '', l.sc_pack_date ? 'PACKED' : 'IN_PROCESS', l.mapping_id]));
  };

  const notifyLine = async () => {
    if (!data || !window.confirm('ส่งสรุปผลกระทบนี้เข้ากลุ่ม LINE ?')) return;
    try {
      const r = await axios.post(`${API_URL}/api/traceback/notify`, { text: impactText(data) });
      setNotice(r.data?.message || 'ส่งแล้ว');
    } catch (e) {
      console.error('Notify LINE error:', e);
      setNotice(`ส่ง LINE ไม่สำเร็จ: ${e.response?.data?.error || e.message}`);
    }
  };

  // เปิดจากลิงก์ (?mode=forward&code=...) → ค้นหาทันที
  useEffect(() => {
    if (initialCode) run(initialCode, initialType);
    else inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the lots after the filters above the tables: status, document, Code, material, line and the factory day (05:30 - 05:30) of the pack date
  // (a lot that is not packed yet is dated by its prep-finished time)
  const lots = useMemo(() => {
    const has = (v, q) => !q || String(v || '').toLowerCase().includes(q.trim().toLowerCase());
    return (data?.lots || []).filter(l => {
      if (lotFilter !== 'all' && (lotFilter === 'packed') !== !!l.sc_pack_date) return false;
      if (!has(l.doc_no, flt.doc) || !has(l.code, flt.code) || !has(l.rmm_line_name, flt.line)) return false;
      if (flt.mat && !has(l.mat, flt.mat) && !has(l.mat_name, flt.mat)) return false;
      if (flt.from || flt.to) {
        const d = factoryDay(l.sc_pack_date || l.rmit_date);
        if (!d || (flt.from && d < flt.from) || (flt.to && d > flt.to)) return false;
      }
      return true;
    });
  }, [data, lotFilter, flt]);
  const lotIds = useMemo(() => (data?.lots || []).map(l => l.mapping_id), [data]);
  const shownIds = useMemo(() => new Set(lots.map(l => l.mapping_id)), [lots]);

  // one row per factory day + document + Code
  const dayRows = useMemo(() => {
    const map = new Map();
    lots.forEach(l => {
      const day = factoryDay(l.sc_pack_date || l.rmit_date) || '';
      const k = `${day}|${l.doc_no}|${l.code}`;
      let g = map.get(k);
      if (!g) { g = { day, doc_no: l.doc_no, code: l.code, lots: 0, packed: 0, in_process: 0, total_weight: 0, lines: new Set(), pack_first: null, pack_last: null }; map.set(k, g); }
      g.lots++;
      if (l.sc_pack_date) g.packed++; else g.in_process++;
      g.total_weight += Number(l.weight_RM) || 0;
      if (l.rmm_line_name) g.lines.add(l.rmm_line_name);
      if (l.sc_pack_date && (!g.pack_first || l.sc_pack_date < g.pack_first)) g.pack_first = l.sc_pack_date;
      if (l.sc_pack_date && (!g.pack_last || l.sc_pack_date > g.pack_last)) g.pack_last = l.sc_pack_date;
    });
    return [...map.values()].map(g => ({ ...g, lines: [...g.lines], total_weight: Math.round(g.total_weight * 1000) / 1000 }))
      .sort((a, b) => String(b.day).localeCompare(String(a.day)) || String(a.doc_no).localeCompare(String(b.doc_no)));
  }, [lots]);

  const s = data?.summary || {};
  const errs = Object.entries(data?.errors || {});

  return (
    <div>
      {/* ── ช่องสแกน ── */}
      <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: 14, padding: '16px 18px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.blueDeep, marginBottom: 4 }}>
          สอบกลับไปข้างหน้า — รหัสนี้ถูกใช้ในสินค้าอะไรบ้าง
        </div>
        <div style={{ fontSize: 12.5, color: T.text2, marginBottom: 12 }}>
          สแกนบาร์โค้ด/QR ด้วยเครื่องสแกน หรือพิมพ์แล้วกด Enter · "ค้นหาทุกประเภท" จะหาในวัตถุดิบ ส่วนผสม และบรรจุภัณฑ์พร้อมกัน
        </div>
        {multi ? (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <textarea value={multiText} onChange={e => setMultiText(e.target.value.toUpperCase())} rows={4}
              placeholder="วางหลายรหัส (คั่นด้วยบรรทัดใหม่ , หรือช่องว่าง) สูงสุด 50 รหัส"
              style={{ ...inputCss, flex: '1 1 260px', height: 'auto', padding: 10, fontFamily: 'ui-monospace,monospace', resize: 'vertical' }} />
            <Btn onClick={runMulti} disabled={loading} style={{ height: 44 }}>{loading ? <Spinner size={16} /> : null} สอบกลับทุกรหัส</Btn>
          </div>
        ) : (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            ref={inputRef}
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === 'Enter') run(); }}
            placeholder="รหัสรุ่น (Batch) / Lot บรรจุภัณฑ์"
            aria-label="รหัสรุ่นหรือ Lot ที่ต้องการสอบกลับ"
            style={{ ...inputCss, flex: '1 1 260px', height: 44, fontSize: 16, fontFamily: 'ui-monospace,monospace', letterSpacing: 1.5, fontWeight: 600 }}
          />
          <Btn onClick={() => run()} disabled={loading} style={{ height: 44 }}>
            {loading ? <Spinner size={16} /> : null} สอบกลับ
          </Btn>
        </div>
        )}
        <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Segmented value={type} onChange={v => setType(v)} options={TYPE_OPTIONS} />
          <Segmented value={multi ? 'm' : 's'} onChange={v => setMulti(v === 'm')} options={[{ value: 's', label: 'รหัสเดียว' }, { value: 'm', label: 'หลายรหัส' }]} />
          <Btn variant="ghost" onClick={saveVariant} style={{ height: 34 }}>☆ บันทึกการค้นหา</Btn>
          {variants.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: T.text2 }}>ที่บันทึกไว้:</span>
              {variants.slice(0, 8).map(v => (
                <span key={v.name} style={{ display: 'inline-flex', alignItems: 'center', border: `1px solid ${T.orangeLine}`, background: T.orangeSoft, borderRadius: 20 }}>
                  <button type="button" onClick={() => applyVariant(v)} style={{ border: 'none', background: 'none', color: T.orange, padding: '3px 4px 3px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>★ {v.name}</button>
                  <button type="button" aria-label="ลบ" onClick={() => setVariants(saveVariants(variants.filter(x => x.name !== v.name)))} style={{ border: 'none', background: 'none', color: T.orange, padding: '3px 8px 3px 2px', cursor: 'pointer' }}>×</button>
                </span>
              ))}
            </div>
          )}
          {recent.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: T.text2 }}>ล่าสุด:</span>
              {recent.slice(0, 6).map(r => (
                <button key={r.key} type="button" onClick={() => { setCode(r.code); setType(r.type); run(r.code, r.type); }}
                  style={{ border: `1px solid ${T.blueLine}`, background: T.blueSoft, color: T.blueDeep, borderRadius: 20, padding: '3px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {r.code} · {TYPE_LABEL[r.type]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 14, background: T.badSoft, border: `1.5px solid ${T.badLine}`, color: T.bad, borderRadius: 11, padding: 14, fontSize: 13.5 }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, height: 160 }}>
          <Spinner size={30} /> <span style={{ color: T.blueDeep, fontWeight: 600 }}>กำลังค้นหาในทุกเอกสาร...</span>
        </div>
      )}

      {data && !loading && (
        <>
          {/* ── สรุปผลกระทบ ── */}
          <div style={{
            marginTop: 14, background: s.product_count ? T.orange : T.ok, color: T.white, borderRadius: 12,
            padding: '14px 18px', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 12, opacity: 0.92 }}>ผลการสอบกลับ {TYPE_LABEL[data.type]} · รหัส</div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'ui-monospace,monospace', letterSpacing: 2 }}>{data.code}</div>
              <div style={{ fontSize: 12.5, marginTop: 2 }}>
                {s.product_count
                  ? `พบใน ${(data.matched_types || []).map(t => TYPE_LABEL[t]).join(', ')} · กระทบ ${s.product_count} เอกสารผลิต`
                  : 'ไม่พบการใช้งานรหัสนี้ในสินค้าใด'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn variant="outline" onClick={() => exportForwardExcel(data)} disabled={!s.product_count}>Excel</Btn>
              <Btn variant="outline" onClick={() => exportForwardPDF(data)} disabled={!s.product_count}>PDF</Btn>
              <Btn variant="outline" onClick={exportCsv} disabled={!s.lot_count} title="ไฟล์ CSV หัวคอลัมน์แบบ SAP สำหรับนำเข้าระบบอื่น">CSV (ERP)</Btn>
              <Btn variant="outline" onClick={() => setHoldOpen(true)} disabled={!s.product_count}>กักสินค้า</Btn>
              <Btn variant="outline" onClick={notifyLine} disabled={!s.product_count}>แจ้ง LINE</Btn>
              {onStartRecall && (
                <Btn variant="outline" onClick={() => onStartRecall(data)} disabled={!s.product_count}>เริ่ม Mock Recall</Btn>
              )}
            </div>
          </div>

          {notice && <div style={{ marginTop: 10 }}><Tag tone={notice.startsWith('ส่ง LINE ไม่') ? 'bad' : 'ok'}>{notice}</Tag></div>}
          {data.elapsed_ms != null && (
            <div style={{ marginTop: 8, fontSize: 12, color: T.text2 }}>
              ระบบใช้เวลาสอบกลับ {(data.elapsed_ms / 1000).toFixed(2)} วินาที · ค้นเมื่อ {fmtDT(new Date().toISOString())}
              {data.per_code ? ` · ${data.per_code.length} รหัส` : ''}
            </div>
          )}
          {data.per_code && (
            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {data.per_code.map(p => <Tag key={p.code} tone={p.products ? 'orange' : 'plain'}>{p.code}: {p.products} เอกสาร / {p.lots} ล็อต</Tag>)}
            </div>
          )}
          {data.decoded && (
            <Card title="ข้อมูลหลักของ Batch (ถอดจากรหัสรุ่น)" right={data.decoded.structure_code || ''}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(data.decoded.segments || data.decoded.parts || []).slice(0, 12).map((seg, i) => (
                  <Tag key={i} tone="blue">{seg.segment_name || seg.name || seg.label || `ส่วนที่ ${i + 1}`}: {seg.value_text || seg.meaning || seg.value || '-'}</Tag>
                ))}
                {(data.decoded.dates || []).slice(0, 4).map((d, i) => <Tag key={`d${i}`} tone="orange">{d.date_name || d.name || 'วันที่'}: {d.date_value || d.value || '-'}</Tag>)}
                {!(data.decoded.segments || data.decoded.parts || []).length && !(data.decoded.dates || []).length && (
                  <span style={{ fontSize: 12.5, color: T.text2 }}>{JSON.stringify(data.decoded).slice(0, 300)}</span>
                )}
              </div>
            </Card>
          )}
          {errs.length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {errs.map(([t, m]) => <Tag key={t} tone="orange">{TYPE_LABEL[t]}: {m}</Tag>)}
            </div>
          )}
          {s.truncated && <div style={{ marginTop: 8 }}><Tag tone="orange">ผลลัพธ์มากเกิน แสดง 3,000 ล็อตแรก</Tag></div>}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginTop: 12 }}>
            <Kpi label="เอกสารผลิตที่กระทบ" value={s.product_count || 0} tone={s.product_count ? 'orange' : 'ok'} />
            <Kpi label="ล็อตทั้งหมด" value={s.lot_count || 0} />
            <Kpi label="บรรจุแล้ว" value={s.packed_count || 0} sub="ต้องพิจารณาเรียกคืน" tone={s.packed_count ? 'bad' : 'ok'} />
            <Kpi label="ยังอยู่ในกระบวนการ" value={s.in_process_count || 0} sub="กักได้ทันที" tone={s.in_process_count ? 'orange' : 'ok'} />
            <Kpi label="น้ำหนักรวม (kg)" value={fmtNum(s.total_weight, 1)} />
            <Kpi label="ช่วงบรรจุ" value={<span style={{ fontSize: 13 }}>{fmtDT(s.pack_date_first)}<br />{fmtDT(s.pack_date_last)}</span>} />
          </div>

          {(data.products || []).length > 1 && (
            <Card title="สัดส่วนน้ำหนักที่ไปอยู่ในแต่ละเอกสาร (Batch distribution)">
              {(() => {
                const max = Math.max(...data.products.map(p => p.total_weight || 0), 1);
                const total = data.products.reduce((a, p) => a + (p.total_weight || 0), 0) || 1;
                return data.products.slice(0, 20).map(p => (
                  <div key={`${p.doc_no}|${p.code}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px,220px) 1fr 110px', gap: 10, alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.code}>{p.doc_no}</span>
                    <span style={{ height: 14, background: T.blueSoft, borderRadius: 7, overflow: 'hidden' }}>
                      <span style={{ display: 'block', height: '100%', width: `${((p.total_weight || 0) / max) * 100}%`, background: p.in_process ? T.orange : T.blue }} />
                    </span>
                    <span style={{ fontSize: 12, textAlign: 'right', color: T.text2 }}>{fmtNum(p.total_weight, 1)} kg · {Math.round(((p.total_weight || 0) / total) * 100)}%</span>
                  </div>
                ));
              })()}
            </Card>
          )}

          {/* ── ตัวกรองผลที่ค้นพบ (แถบเดียว ไม่ซ้อนกล่อง) ── */}
          <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {[['doc', 'เลขเอกสาร', 120], ['code', 'Code สินค้า', 150], ['mat', 'วัตถุดิบ (รหัส/ชื่อ)', 170], ['line', 'ไลน์', 90]].map(([k, label, w]) => (
              <label key={k} style={{ fontSize: 11.5, color: T.text2, display: 'grid', gap: 3 }}>
                {label}
                <input value={flt[k]} onChange={e => setF(k, e.target.value)} style={{ ...inputCss, width: w, height: 34 }} />
              </label>
            ))}
            <label style={{ fontSize: 11.5, color: T.text2, display: 'grid', gap: 3 }}>วันโรงงาน จาก (เริ่ม 05:30)
              <input type="date" value={flt.from} onChange={e => setF('from', e.target.value)} style={{ ...inputCss, width: 150, height: 34 }} />
            </label>
            <label style={{ fontSize: 11.5, color: T.text2, display: 'grid', gap: 3 }}>ถึง
              <input type="date" value={flt.to} onChange={e => setF('to', e.target.value)} style={{ ...inputCss, width: 150, height: 34 }} />
            </label>
            <Segmented value={lotFilter} onChange={setLotFilter} options={LOT_FILTERS} />
            <Btn variant="ghost" style={{ height: 34 }} onClick={() => { setLotFilter('all'); setFlt({ doc: '', code: '', mat: '', line: '', from: '', to: '' }); }}>ล้างตัวกรอง</Btn>
            <span style={{ fontSize: 12, color: T.text2, paddingBottom: 8 }}>แสดง {lots.length.toLocaleString()} จาก {(data.lots || []).length.toLocaleString()} ล็อต</span>
          </div>

          <Card title="สินค้าที่ได้รับผลกระทบ — แยกตามวัน (วันโรงงานเริ่ม 05:30)" right={`${dayRows.length} รายการ`} tone="orange" pad="0">
            <SimpleTable
              flush
              rows={dayRows} getKey={p => `${p.day}|${p.doc_no}|${p.code}`}
              rowTone={p => (p.in_process ? 'orange' : null)}
              empty="ไม่พบสินค้าที่ใช้รหัสนี้ (ลองล้างตัวกรอง)"
              columns={[
                { key: 'day', label: 'วันโรงงาน', render: p => <b>{fmtDay(p.day)}</b>, sortValue: p => p.day },
                { key: 'doc_no', label: 'เลขเอกสาร', render: p => <b>{p.doc_no}</b> },
                { key: 'code', label: 'Code สินค้า', wrap: true },
                { key: 'lots', label: 'ล็อต', align: 'right' },
                { key: 'packed', label: 'บรรจุแล้ว', align: 'right' },
                { key: 'in_process', label: 'ในกระบวนการ', align: 'right', render: p => (p.in_process ? <Tag tone="orange">{p.in_process}</Tag> : 0) },
                { key: 'total_weight', label: 'น้ำหนัก (kg)', align: 'right', render: p => fmtNum(p.total_weight, 1) },
                { key: 'lines', label: 'ไลน์', render: p => (p.lines || []).join(', ') || '—', sortValue: p => (p.lines || []).join(', ') },
                { key: 'pack', label: 'ช่วงบรรจุ', render: p => (p.pack_first ? `${fmtDT(p.pack_first)} → ${fmtDT(p.pack_last)}` : '—'), sortValue: p => p.pack_first || null },
                {
                  key: 'open', label: 'ใบสอบกลับ', sortable: false,
                  render: p => (p.packed && onOpenRecord
                    ? <Btn variant="outline" style={{ height: 28, fontSize: 12 }} onClick={() => onOpenRecord(p.doc_no, p.code)}>เปิด</Btn>
                    : '—'),
                },
              ]}
            />
          </Card>

          {(data.sources || []).length > 0 && (
            <Card title="หลักฐานที่ใช้จับคู่ (แหล่งข้อมูล)" right="ยืนยันได้ว่าเชื่อมกันด้วยอะไร" pad="0">
              <SimpleTable
                flush rows={data.sources} maxHeight={320}
                columns={[
                  { key: 'type', label: 'ประเภท', render: x => <Tag tone={x.type === 'pkg' ? 'orange' : x.type === 'ing' ? 'ok' : 'blue'}>{TYPE_LABEL[x.type]}</Tag> },
                  { key: 'label', label: 'รายการ', wrap: true },
                  { key: 'wo_no', label: 'WO / Code', render: x => x.wo_no || x.code || x.material_no || '—' },
                  { key: 'detail', label: 'ตะกร้า / Batch-Lot', wrap: true,
                    render: x => (x.baskets ? `ตะกร้า ${x.baskets.join(', ') || '-'}` : [x.batch_no, x.lot_no].filter(Boolean).join(' / ') || (x.count ? `${x.count} ล็อต` : '—')) },
                  { key: 'line_name', label: 'ไลน์' },
                  { key: 'time', label: 'เวลา', render: x => (x.start_time ? `${fmtDT(x.start_time)} → ${fmtDT(x.stop_time)}` : fmtDT(x.used_at)) },
                  { key: 'mapping_count', label: 'ล็อตที่จับคู่', align: 'right', render: x => x.mapping_count ?? x.count ?? '—' },
                ]}
              />
            </Card>
          )}

          <Card title="ล็อตการผลิตทั้งหมด — ทุกเวลา · DBS 1-4 · Sensory / Remark QC" right={`${lots.length.toLocaleString()} ล็อต`} pad="0">
            <ForwardLotsGrid ids={lotIds} show={shownIds} />
          </Card>
        </>
      )}
      <HoldDialog open={holdOpen} onClose={() => setHoldOpen(false)} source={data ? { type: data.type, code: data.code } : null}
        products={data?.products || []} onDone={(m) => { setNotice(m); onHoldsChanged?.(); }} />
    </div>
  );
};

export default ForwardTrace;
