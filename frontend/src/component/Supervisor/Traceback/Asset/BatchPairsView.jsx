import { Fragment, useMemo, useState } from 'react';
import { Btn, Tag } from './TraceAtoms';
import { T } from './tracebackUI';
import { downloadCsv } from './tracebackCore';

const TH = { padding: '7px 10px', fontSize: 12, fontWeight: 600, color: T.blueDeep, background: T.blueSoft, textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', top: 0 };
const TD = { padding: '6px 10px', fontSize: 12.5, color: T.text, borderTop: `1px solid ${T.line}`, whiteSpace: 'nowrap' };
const mono = { fontFamily: 'ui-monospace,monospace', fontWeight: 600, letterSpacing: 0.5 };
const uniq = (xs) => [...new Set(xs.filter(Boolean))];

/**
 * Result view "Batch ตั้งต้น ↔ 2X": one row per pair (Batch ตั้งต้น = batch_before, Batch 2X = batch_after, Mat); the arrow opens the rows (mappings)
 * that used the pair: trolley, document, product Code, line, weight, pack date. rows = the rows of GET /api/traceback/batch-link.
 */
const BatchPairsView = ({ rows }) => {
  const [open, setOpen] = useState(() => new Set());
  const pairs = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => {
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
    rows.map((r) => [r.batch_before, r.batch_after, r.mat, r.mat_name, r.mapping_id, r.tro_id, r.doc_no, r.product_code, r.line, r.weight_RM, r.pack_date]));

  if (!pairs.length) return <div style={{ padding: 18, fontSize: 13, color: T.text2, border: `1px solid ${T.line}`, borderRadius: 10, background: T.white }}>ไม่พบข้อมูล</div>;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: T.text2 }}>{`${pairs.length} คู่ · ${rows.length} รายการ`}</span>
        <Btn variant="outline" onClick={exportCsv}>ส่งออก CSV</Btn>
      </div>
      <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, overflow: 'auto', maxHeight: 520, background: T.white }}>
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
      </div>
    </div>
  );
};

export default BatchPairsView;
