import { Fragment, useMemo, useState } from 'react';
import axios from 'axios';
import SearchableSelect from './SearchableSelect';
import { Btn, Card, Spinner } from './TraceAtoms';
import { T, inputCss } from './tracebackUI';
import { downloadCsv } from './tracebackCore';
import { useTraceOptions } from './traceOptions';

const API_URL = import.meta.env.VITE_API_URL;
const lbl = { fontSize: 11.5, fontWeight: 600, color: T.blueDeep, display: 'block', marginBottom: 4 };
const TH = { padding: '7px 10px', fontSize: 12, fontWeight: 600, color: T.blueDeep, background: T.blueSoft, textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', top: 0 };
const TD = { padding: '6px 10px', fontSize: 12.5, color: T.text, borderTop: `1px solid ${T.line}`, whiteSpace: 'nowrap' };
const mono = { fontFamily: 'ui-monospace,monospace', fontWeight: 600, letterSpacing: 0.5 };
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Traceback — "สินค้าแต่ละ Code ใช้ปลากี่ Batch": for the products packed in the chosen days (all Codes, or one), how many fish Batch ตั้งต้น and Batch 2X
 * went into each Code, and which ones. The arrow opens the list (Mat, Batch ตั้งต้น -> Batch 2X, document / line, packed rows).
 */
const CodeFishSection = ({ title }) => {
  const { opts, loading: optsLoading } = useTraceOptions();
  const [code, setCode] = useState('');
  const [from, setFrom] = useState(() => ymd(new Date(Date.now() - 6 * 86400000)));
  const [to, setTo] = useState(() => ymd(new Date()));
  const [rows, setRows] = useState(null);
  const [capped, setCapped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(() => new Set());

  const search = async () => {
    if (!from) { setError('กรุณาเลือกวันที่บรรจุ (จาก)'); return; }
    setLoading(true); setError(''); setOpen(new Set());
    try {
      const res = await axios.get(`${API_URL}/api/traceback/code-fish`, { params: { code: code.trim(), from, to: to || from } });
      if (!res.data?.success) throw new Error(res.data?.error || 'ค้นหาไม่สำเร็จ');
      setRows(res.data.data || []); setCapped(!!res.data.capped);
    } catch (e) {
      console.error('code-fish error:', e);
      setError(e.response?.data?.error || e.message || 'ค้นหาไม่สำเร็จ');
      setRows(null);
    } finally { setLoading(false); }
  };
  const reset = () => { setCode(''); setRows(null); setError(''); setCapped(false); setOpen(new Set()); };

  const products = useMemo(() => {
    const m = new Map();
    (rows || []).forEach((r) => {
      const k = r.product_code || '—';
      if (!m.has(k)) m.set(k, { key: k, code: k, items: [] });
      m.get(k).items.push(r);
    });
    return [...m.values()].map((g) => ({
      ...g,
      nBefore: new Set(g.items.map((i) => i.batch_before).filter(Boolean)).size,
      nAfter: new Set(g.items.map((i) => i.batch_after).filter(Boolean)).size,
      docs: new Set(g.items.map((i) => i.doc_no).filter(Boolean)).size,
      last: g.items.map((i) => i.last_pack_date).filter(Boolean).sort().pop() || '',
    })).sort((a, b) => b.nBefore - a.nBefore || a.code.localeCompare(b.code));
  }, [rows]);

  const toggle = (k) => setOpen((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const exportCsv = () => downloadCsv(`Code_ใช้ปลา_${from}_${to || from}.csv`,
    ['CODE_สินค้า', 'เลขเอกสาร', 'ไลน์', 'MAT', 'ชื่อวัตถุดิบ', 'BATCH_ตั้งต้น', 'BATCH_2X', 'จำนวนรายการ', 'บรรจุล่าสุด'],
    (rows || []).map((r) => [r.product_code, r.doc_no, r.line, r.mat, r.mat_name, r.batch_before, r.batch_after, r.n_mapping, r.last_pack_date]));

  return (
    <Card title={title} right={rows ? `${products.length} Code` : ''}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 260px', minWidth: 220, maxWidth: 360 }}>
          <SearchableSelect label="Code สินค้า" value={code} onChange={setCode} options={opts.code} loading={optsLoading} placeholder="ทุก Code" />
        </div>
        <div style={{ width: 140 }}><label style={lbl}>วันที่บรรจุ (จาก)</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputCss} /></div>
        <div style={{ width: 140 }}><label style={lbl}>วันที่บรรจุ (ถึง)</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputCss} /></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={search} disabled={loading}>{loading ? <Spinner size={14} /> : null}ค้นหา</Btn>
          <Btn variant="ghost" onClick={reset} disabled={loading}>ล้าง</Btn>
          {rows?.length > 0 && <Btn variant="outline" onClick={exportCsv}>ส่งออก CSV</Btn>}
        </div>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: T.text2 }}>นับเฉพาะวัตถุดิบกลุ่มปลาของรายการที่บรรจุเสร็จแล้วในช่วงวันที่เลือก</div>
      {error && <div style={{ marginTop: 10, color: T.bad, fontSize: 13 }}>{error}</div>}
      {capped && <div style={{ marginTop: 10, color: T.orange, fontSize: 12.5 }}>ผลลัพธ์ถึงเพดาน แสดงเฉพาะส่วนแรก — เลือก Code หรือช่วงวันที่ให้แคบลง</div>}
      {rows && (
        <div style={{ marginTop: 12, border: `1px solid ${T.line}`, borderRadius: 10, overflow: 'auto', maxHeight: 460 }}>
          {products.length === 0 ? (
            <div style={{ padding: 18, fontSize: 13, color: T.text2 }}>ไม่พบข้อมูล</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...TH, width: 28 }} />
                  <th style={TH}>Code สินค้า</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Batch ปลา ตั้งต้น</th><th style={{ ...TH, textAlign: 'right' }}>Batch ปลา 2X</th>
                  <th style={{ ...TH, textAlign: 'right' }}>เอกสารผลิต</th><th style={TH}>บรรจุล่าสุด</th>
                </tr>
              </thead>
              <tbody>
                {products.map((g, i) => {
                  const isOpen = open.has(g.key);
                  return (
                    <Fragment key={g.key}>
                      <tr style={{ background: i % 2 ? T.bg : T.white, cursor: 'pointer' }} onClick={() => toggle(g.key)}>
                        <td style={{ ...TD, color: T.blue }}>{isOpen ? '▾' : '▸'}</td>
                        <td style={{ ...TD, ...mono }}>{g.code}</td>
                        <td style={{ ...TD, textAlign: 'right', fontWeight: 700 }}>{g.nBefore}</td>
                        <td style={{ ...TD, textAlign: 'right', fontWeight: 700 }}>{g.nAfter}</td>
                        <td style={{ ...TD, textAlign: 'right' }}>{g.docs}</td>
                        <td style={TD}>{g.last || '—'}</td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td />
                          <td colSpan={5} style={{ padding: '4px 10px 10px', background: T.bg }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead><tr>{['Mat', 'ชื่อวัตถุดิบ', 'Batch ตั้งต้น', 'Batch 2X', 'เลขเอกสาร', 'ไลน์', 'รายการ', 'บรรจุล่าสุด'].map((h) => <th key={h} style={{ ...TH, position: 'static' }}>{h}</th>)}</tr></thead>
                              <tbody>
                                {g.items.map((x, j) => (
                                  <tr key={j} style={{ background: T.white }}>
                                    <td style={TD}>{x.mat || '—'}</td><td style={{ ...TD, whiteSpace: 'normal' }}>{x.mat_name || '—'}</td>
                                    <td style={{ ...TD, ...mono }}>{x.batch_before || '—'}</td><td style={{ ...TD, ...mono }}>{x.batch_after || '—'}</td>
                                    <td style={TD}>{x.doc_no || '—'}</td><td style={TD}>{x.line || '—'}</td>
                                    <td style={{ ...TD, textAlign: 'right' }}>{x.n_mapping}</td><td style={TD}>{x.last_pack_date || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </Card>
  );
};

export default CodeFishSection;
