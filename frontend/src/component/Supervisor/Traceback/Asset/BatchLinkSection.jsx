import { Fragment, useMemo, useState } from 'react';
import axios from 'axios';
import SearchableSelect from './SearchableSelect';
import { Btn, Card, Spinner, Tag } from './TraceAtoms';
import { T, inputCss } from './tracebackUI';
import { downloadCsv } from './tracebackCore';
import { useTraceOptions } from './traceOptions';

const API_URL = import.meta.env.VITE_API_URL;
const lbl = { fontSize: 11.5, fontWeight: 600, color: T.blueDeep, display: 'block', marginBottom: 4 };
const TH = { padding: '7px 10px', fontSize: 12, fontWeight: 600, color: T.blueDeep, background: T.blueSoft, textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', top: 0 };
const TD = { padding: '6px 10px', fontSize: 12.5, color: T.text, borderTop: `1px solid ${T.line}`, whiteSpace: 'nowrap' };
const uniq = (xs) => [...new Set(xs.filter(Boolean))];
const mono = { fontFamily: 'ui-monospace,monospace', fontWeight: 600, letterSpacing: 0.5 };

/**
 * Traceback — "Batch ตั้งต้น ↔ 2X": which Batch ตั้งต้น (batch_before) was converted to which Batch 2X (batch_after) and where each one went.
 *   by = "mat"   : type a Mat (raw material)        -> every pair of that material
 *   by = "batch" : type a Batch, starting or 2X     -> the pair(s) of that Batch, either way
 * One row per pair; the arrow opens the rows (mappings) that used the pair: trolley, production Code / line, pack date.
 */
const BatchLinkSection = ({ by, title }) => {
  const { opts, loading: optsLoading } = useTraceOptions();
  const [value, setValue] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState(null);       // null = not searched yet
  const [capped, setCapped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(() => new Set());

  const search = async () => {
    const v = value.trim();
    if (!v) { setError(by === 'mat' ? 'กรุณาเลือกหรือพิมพ์ Mat' : 'กรุณาพิมพ์ Batch'); return; }
    setLoading(true); setError(''); setOpen(new Set());
    try {
      const params = { [by]: v, from, to: to || from };
      const res = await axios.get(`${API_URL}/api/traceback/batch-link`, { params });
      if (!res.data?.success) throw new Error(res.data?.error || 'ค้นหาไม่สำเร็จ');
      setRows(res.data.data || []); setCapped(!!res.data.capped);
    } catch (e) {
      console.error('batch-link error:', e);
      setError(e.response?.data?.error || e.message || 'ค้นหาไม่สำเร็จ');
      setRows(null);
    } finally { setLoading(false); }
  };
  const reset = () => { setValue(''); setFrom(''); setTo(''); setRows(null); setError(''); setCapped(false); setOpen(new Set()); };

  const pairs = useMemo(() => {
    const m = new Map();
    (rows || []).forEach((r) => {
      const k = `${r.batch_before || ''}\u0000${r.batch_after || ''}\u0000${r.mat || ''}`;
      if (!m.has(k)) m.set(k, { key: k, before: r.batch_before, after: r.batch_after, mat: r.mat, mat_name: r.mat_name, items: [] });
      m.get(k).items.push(r);
    });
    return [...m.values()].map((g) => ({
      ...g,
      codes: uniq(g.items.map((i) => i.product_code)),
      last: g.items.map((i) => i.pack_date).filter(Boolean).sort().pop() || '',
    }));
  }, [rows]);

  const toggle = (k) => setOpen((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const exportCsv = () => downloadCsv(`Batch_ตั้งต้น_2X_${new Date().toISOString().slice(0, 10)}.csv`,
    ['BATCH_ตั้งต้น', 'BATCH_2X', 'MAT', 'ชื่อวัตถุดิบ', 'MAPPING_ID', 'รถเข็น', 'เลขเอกสาร', 'CODE_สินค้า', 'ไลน์', 'น้ำหนัก', 'วันที่บรรจุ'],
    (rows || []).map((r) => [r.batch_before, r.batch_after, r.mat, r.mat_name, r.mapping_id, r.tro_id, r.doc_no, r.product_code, r.line, r.weight_RM, r.pack_date]));

  const enter = (e) => { if (e.key === 'Enter') search(); };

  return (
    <Card title={title} right={rows ? `${pairs.length} คู่ · ${rows.length} รายการ` : ''}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 300px', minWidth: 240, maxWidth: 420 }}>
          {by === 'mat' ? (
            <SearchableSelect label="Mat (รหัสวัตถุดิบ)" value={value} onChange={setValue} options={opts.mat} loading={optsLoading} placeholder="เลือกหรือพิมพ์ Mat" />
          ) : (
            <>
              <label style={lbl}>Batch (ตั้งต้น หรือ 2X)</label>
              <input value={value} onChange={(e) => setValue(e.target.value.toUpperCase())} onKeyDown={enter} placeholder="พิมพ์หรือสแกน Batch ตั้งต้น หรือ Batch 2X"
                style={{ ...inputCss, ...mono }} aria-label="Batch" />
            </>
          )}
        </div>
        <div style={{ width: 140 }}><label style={lbl}>วันที่บรรจุ (จาก)</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputCss} /></div>
        <div style={{ width: 140 }}><label style={lbl}>วันที่บรรจุ (ถึง)</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputCss} /></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={search} disabled={loading}>{loading ? <Spinner size={14} /> : null}ค้นหา</Btn>
          <Btn variant="ghost" onClick={reset} disabled={loading}>ล้าง</Btn>
          {rows?.length > 0 && <Btn variant="outline" onClick={exportCsv}>ส่งออก CSV</Btn>}
        </div>
      </div>
      {error && <div style={{ marginTop: 10, color: T.bad, fontSize: 13 }}>{error}</div>}
      {capped && <div style={{ marginTop: 10, color: T.orange, fontSize: 12.5 }}>ผลลัพธ์ถึงเพดาน แสดงเฉพาะส่วนแรก — ระบุช่วงวันที่บรรจุเพื่อให้แคบลง</div>}
      {rows && (
        <div style={{ marginTop: 12, border: `1px solid ${T.line}`, borderRadius: 10, overflow: 'auto', maxHeight: 460 }}>
          {pairs.length === 0 ? (
            <div style={{ padding: 18, fontSize: 13, color: T.text2 }}>ไม่พบข้อมูล</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...TH, width: 28 }} />
                  <th style={TH}>Batch ตั้งต้น</th><th style={TH}>Batch 2X</th><th style={TH}>Mat</th><th style={TH}>ชื่อวัตถุดิบ</th>
                  <th style={{ ...TH, textAlign: 'right' }}>รายการ</th><th style={TH}>Code สินค้า</th><th style={TH}>บรรจุล่าสุด</th>
                </tr>
              </thead>
              <tbody>
                {pairs.map((g, i) => {
                  const isOpen = open.has(g.key);
                  const same = g.before && g.before === g.after;
                  return (
                    <Fragment key={g.key}>
                      <tr style={{ background: i % 2 ? T.bg : T.white, cursor: 'pointer' }} onClick={() => toggle(g.key)}>
                        <td style={{ ...TD, color: T.blue }}>{isOpen ? '▾' : '▸'}</td>
                        <td style={{ ...TD, ...mono }}>{g.before || '—'}</td>
                        <td style={{ ...TD, ...mono }}>{g.after || '—'}{same && <span style={{ marginLeft: 6 }}><Tag tone="plain" title="Batch 2X เท่ากับ Batch ตั้งต้น (ไม่ได้แปลง)">ไม่แปลง</Tag></span>}</td>
                        <td style={TD}>{g.mat || '—'}</td>
                        <td style={{ ...TD, whiteSpace: 'normal' }}>{g.mat_name || '—'}</td>
                        <td style={{ ...TD, textAlign: 'right' }}>{g.items.length}</td>
                        <td style={{ ...TD, whiteSpace: 'normal' }}>{g.codes.join(', ') || '—'}</td>
                        <td style={TD}>{g.last || '—'}</td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td />
                          <td colSpan={7} style={{ padding: '4px 10px 10px', background: T.bg }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead><tr>{['รายการ (mapping)', 'รถเข็น', 'เลขเอกสาร', 'Code สินค้า', 'ไลน์', 'น้ำหนัก', 'วันที่บรรจุ'].map((h) => <th key={h} style={{ ...TH, position: 'static' }}>{h}</th>)}</tr></thead>
                              <tbody>
                                {g.items.map((x) => (
                                  <tr key={x.mapping_id} style={{ background: T.white }}>
                                    <td style={TD}>{x.mapping_id}</td><td style={TD}>{x.tro_id || '—'}</td><td style={TD}>{x.doc_no || '—'}</td>
                                    <td style={TD}>{x.product_code || '—'}</td><td style={TD}>{x.line || '—'}</td>
                                    <td style={{ ...TD, textAlign: 'right' }}>{x.weight_RM ?? '—'}</td><td style={TD}>{x.pack_date || 'ยังไม่บรรจุ'}</td>
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

export default BatchLinkSection;
