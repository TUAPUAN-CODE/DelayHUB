// สอบกลับไปข้างหน้า (Trace Forward / Impact Analysis)
//   สแกนหรือพิมพ์รหัสรุ่นวัตถุดิบ / ส่วนผสม / Lot บรรจุภัณฑ์ → สินค้าทุกเอกสารที่ได้รับผลกระทบ
//   แยก "บรรจุแล้ว" กับ "ยังอยู่ในกระบวนการ (กักได้ทันที)" เพื่อใช้ตัดสินใจเรียกคืน/กักสินค้า
import { forwardRef, useState, useEffect, useMemo, useCallback, useImperativeHandle } from 'react';
import axios from 'axios';
import { T, TYPE_LABEL } from './tracebackUI';
import { Tag, Card, Btn, Segmented, SimpleTable, Spinner } from './TraceAtoms';
import { fmtDT, fmtNum, pushRecent, downloadCsv, uniq, factoryDay, fmtDay } from './tracebackCore';
import ForwardLotsGrid from './ForwardLotsGrid';
import { HoldDialog } from './HoldList';
import { exportForwardExcel, exportForwardPDF } from './tracebackExport';

const API_URL = import.meta.env.VITE_API_URL;

// the order of the "by day" table (options: traceForm.js FWD_SORT_OPTIONS; a click on a column header sorts it further)
const SORTERS = {
  day_desc: (a, b) => String(b.day).localeCompare(String(a.day)) || String(a.doc_no).localeCompare(String(b.doc_no)),
  day_asc: (a, b) => String(a.day).localeCompare(String(b.day)) || String(a.doc_no).localeCompare(String(b.doc_no)),
  weight_desc: (a, b) => b.total_weight - a.total_weight,
  lots_desc: (a, b) => b.lots - a.lots,
  wip_desc: (a, b) => b.in_process - a.in_process,
  doc_no_asc: (a, b) => String(a.doc_no).localeCompare(String(b.doc_no), 'th'),
  doc_no_desc: (a, b) => String(b.doc_no).localeCompare(String(a.doc_no), 'th'),
  code_asc: (a, b) => String(a.code).localeCompare(String(b.code), 'th'),
};
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

// form = the shared search form (SearchPanel): code · kind · one/many + the filters; search() / run() are called through the ref
const ForwardTrace = forwardRef(({ initialCode = '', initialType = 'auto', onOpenRecord, onStartRecall, onQueryChange, form, onRan }, ref) => {
  const [holdOpen, setHoldOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState('day'); // which table: the affected products by day, or every lot
  const code = form.trace;
  const type = form.type;
  const sortBy = form.sort;
  // pack_status of the form: packed / all / unpacked  ->  the lots shown
  const lotFilter = form.pack_status === 'all' ? 'all' : form.pack_status === 'packed' ? 'packed' : 'wip';
  const flt = { doc: form.doc_no, code: form.code, mat: form.mat, matName: form.mat_name, line: form.rmm_line_name, from: form.from, to: form.single ? form.from : form.to };

  const run = useCallback(async (c = code, t = type) => {
    const q = String(c || '').trim();
    if (!q) { setError('กรุณาสแกนหรือพิมพ์รหัสรุ่น / Lot'); return; }
    try {
      setLoading(true); setError(''); setData(null); setNotice('');
      const res = await axios.get(`${API_URL}/api/traceback/forward`, { params: { code: q, type: t } });
      setData(res.data?.data || null);
      pushRecent({ kind: 'fwd', code: q, type: t });
      onRan?.();
      onQueryChange?.({ code: q, type: t });
    } catch (e) {
      console.error('Trace forward error:', e);
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, [code, type, onQueryChange, onRan]);

  // หลายรหัสพร้อมกัน (Where-used list ของหลาย batch): วางรหัสคั่นด้วยบรรทัดใหม่ / , / ช่องว่าง
  const runMulti = async () => {
    const codes = uniq(form.multiText.split(/[\s,;]+/).map(x => x.trim().toUpperCase()).filter(Boolean)).slice(0, 50);
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

  // the search button of the shared form
  useImperativeHandle(ref, () => ({ search: () => (form.multi ? runMulti() : run()), run: (c, t) => run(c, t), reset: () => { setData(null); setError(''); setNotice(''); } }));

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the lots after the filters above the tables: status, document, Code, material, line and the factory day (05:30 - 05:30) of the pack date
  // (a lot that is not packed yet is dated by its prep-finished time)
  const lots = useMemo(() => {
    const has = (v, q) => !q || String(v || '').toLowerCase().includes(q.trim().toLowerCase());
    return (data?.lots || []).filter(l => {
      if (lotFilter !== 'all' && (lotFilter === 'packed') !== !!l.sc_pack_date) return false;
      if (!has(l.doc_no, flt.doc) || !has(l.code, flt.code) || !has(l.rmm_line_name, flt.line)) return false;
      if (!has(l.mat, flt.mat) || !has(l.mat_name, flt.matName)) return false;
      if (flt.from || flt.to) {
        const d = factoryDay(l.sc_pack_date || l.rmit_date);
        if (!d || (flt.from && d < flt.from) || (flt.to && d > flt.to)) return false;
      }
      return true;
    });
  }, [data, lotFilter, form.doc_no, form.code, form.mat, form.mat_name, form.rmm_line_name, form.from, form.to, form.single]); // eslint-disable-line react-hooks/exhaustive-deps
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
      .sort(SORTERS[sortBy] || SORTERS.day_desc);
  }, [lots, sortBy]);

  const s = data?.summary || {};
  const errs = Object.entries(data?.errors || {});

  return (
    <div>
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

          <Card
            title={view === 'day' ? 'สินค้าที่ได้รับผลกระทบ' : 'ล็อตการผลิตทั้งหมด'}
            right={<Segmented value={view} onChange={setView} options={[{ value: 'day', label: `สินค้าที่ได้รับผลกระทบ (${dayRows.length})` }, { value: 'lots', label: `ล็อตการผลิตทั้งหมด (${lots.length.toLocaleString()})` }]} />}
            pad="0"
          >
            {view === 'day' ? (
            <SimpleTable
              flush plain
              rows={dayRows} getKey={p => `${p.day}|${p.doc_no}|${p.code}`}
              empty="ไม่พบสินค้าที่ใช้รหัสนี้ (ลองล้างตัวกรอง)"
              columns={[
                { key: 'day', label: 'วันผลิต', render: p => <b>{fmtDay(p.day)}</b>, sortValue: p => p.day },
                { key: 'doc_no', label: 'เลขเอกสาร', render: p => <b>{p.doc_no}</b> },
                { key: 'code', label: 'Code สินค้า', wrap: true },
                { key: 'lots', label: 'ล็อต', align: 'right' },
                { key: 'packed', label: 'บรรจุแล้ว', align: 'right' },
                { key: 'in_process', label: 'ในกระบวนการ', align: 'right', render: p => p.in_process || 0 },
                { key: 'total_weight', label: 'น้ำหนัก (kg)', align: 'right', render: p => fmtNum(p.total_weight, 1) },
                { key: 'lines', label: 'ไลน์', render: p => (p.lines || []).join(', ') || '—', sortValue: p => (p.lines || []).join(', ') },
                {
                  key: 'open', label: 'ใบสอบกลับ', sortable: false,
                  render: p => (p.packed && onOpenRecord
                    ? <Btn variant="outline" style={{ height: 28, fontSize: 12 }} onClick={() => onOpenRecord(p.doc_no, p.code)}>เปิด</Btn>
                    : '—'),
                },
              ]}
            />
            ) : (
              <ForwardLotsGrid lots={data.lots || []} show={shownIds} />
            )}
          </Card>
        </>
      )}
      <HoldDialog open={holdOpen} onClose={() => setHoldOpen(false)} source={data ? { type: data.type, code: data.code } : null}
        products={data?.products || []} onDone={(m) => { setNotice(m); onHoldsChanged?.(); }} />
    </div>
  );
});

ForwardTrace.displayName = 'ForwardTrace';

export default ForwardTrace;
