import { Fragment, useMemo, useState } from 'react';
import { Btn } from './TraceAtoms';
import { T } from './tracebackUI';
import { downloadCsv } from './tracebackCore';
import { isFishRow } from '../../../Sheet/Asset/fishBatch';

const TH = { padding: '7px 10px', fontSize: 12, fontWeight: 600, color: T.blueDeep, background: T.blueSoft, textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', top: 0 };
const TD = { padding: '6px 10px', fontSize: 12.5, color: T.text, borderTop: `1px solid ${T.line}`, whiteSpace: 'nowrap' };
const mono = { fontFamily: 'ui-monospace,monospace', fontWeight: 600, letterSpacing: 0.5 };

/**
 * Result view "Code สินค้า ใช้ปลากี่ Batch": from the same rows as the pairs view, only the fish raw materials (same types as the fish check of the Sheet),
 * per product Code: how many Batch ตั้งต้น and Batch 2X went in, and which (the arrow opens the list). rows = the rows of GET /api/traceback/batch-link.
 */
const CodeFishView = ({ rows }) => {
  const [open, setOpen] = useState(() => new Set());
  const fish = useMemo(() => rows.filter(isFishRow), [rows]);
  const products = useMemo(() => {
    const m = new Map();
    fish.forEach((r) => {
      const k = r.product_code || '—';
      if (!m.has(k)) m.set(k, { key: k, code: k, items: [] });
      m.get(k).items.push(r);
    });
    return [...m.values()].map((g) => {
      // one line per (Mat, Batch ตั้งต้น, Batch 2X, document, line)
      const lines = new Map();
      g.items.forEach((r) => {
        const lk = [r.mat, r.batch_before, r.batch_after, r.doc_no, r.line].join('\u0000');
        if (!lines.has(lk)) lines.set(lk, { ...r, n: 0, last: '' });
        const l = lines.get(lk);
        l.n += 1;
        if (r.pack_date && r.pack_date > l.last) l.last = r.pack_date;
      });
      return {
        ...g,
        lines: [...lines.values()],
        nBefore: new Set(g.items.map((i) => i.batch_before).filter(Boolean)).size,
        nAfter: new Set(g.items.map((i) => i.batch_after).filter(Boolean)).size,
        docs: new Set(g.items.map((i) => i.doc_no).filter(Boolean)).size,
        last: g.items.map((i) => i.pack_date).filter(Boolean).sort().pop() || '',
      };
    }).sort((a, b) => b.nBefore - a.nBefore || a.code.localeCompare(b.code));
  }, [fish]);

  const toggle = (k) => setOpen((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const exportCsv = () => downloadCsv(`Code_ใช้ปลา_${new Date().toISOString().slice(0, 10)}.csv`,
    ['CODE_สินค้า', 'เลขเอกสาร', 'ไลน์', 'MAT', 'ชื่อวัตถุดิบ', 'BATCH_ตั้งต้น', 'BATCH_2X', 'จำนวนรายการ', 'บรรจุล่าสุด'],
    products.flatMap((g) => g.lines.map((x) => [g.code, x.doc_no, x.line, x.mat, x.mat_name, x.batch_before, x.batch_after, x.n, x.last])));

  if (!products.length) return <div style={{ padding: 18, fontSize: 13, color: T.text2, border: `1px solid ${T.line}`, borderRadius: 10, background: T.white }}>ไม่พบวัตถุดิบกลุ่มปลาในผลค้นหา</div>;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: T.text2 }}>{`${products.length} Code · นับเฉพาะวัตถุดิบกลุ่มปลา`}</span>
        <Btn variant="outline" onClick={exportCsv}>ส่งออก CSV</Btn>
      </div>
      <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, overflow: 'auto', maxHeight: 520, background: T.white }}>
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
                            {g.lines.map((x, j) => (
                              <tr key={j} style={{ background: T.white }}>
                                <td style={TD}>{x.mat || '—'}</td><td style={{ ...TD, whiteSpace: 'normal' }}>{x.mat_name || '—'}</td>
                                <td style={{ ...TD, ...mono }}>{x.batch_before || '—'}</td><td style={{ ...TD, ...mono }}>{x.batch_after || '—'}</td>
                                <td style={TD}>{x.doc_no || '—'}</td><td style={TD}>{x.line || '—'}</td>
                                <td style={{ ...TD, textAlign: 'right' }}>{x.n}</td><td style={TD}>{x.last || '—'}</td>
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

export default CodeFishView;
