import { forwardRef, useState, useCallback, useImperativeHandle, useMemo } from 'react';
import axios from 'axios';
import TracebackDetailView from './TracebackDetailView';
import { C, fmtDisplay, fmtNum, DELAY_STYLE } from './tracebackUI';
import { backwardFilters } from './traceForm';
import { readRecent, pushRecent } from './tracebackCore';
import { SimpleTable } from './TraceAtoms';

axios.defaults.withCredentials = true;
const API_URL = import.meta.env.VITE_API_URL;

// a long list of codes (a production can use 20+ batches): the first few, "+N" for the rest, the full list in the tooltip
const ListCell = ({ value, max = 3 }) => {
  const items = String(value || '').split(',').map(x => x.trim()).filter(Boolean);
  if (!items.length) return '—';
  return (
    <span title={items.join(', ')} style={{ fontFamily: 'ui-monospace,monospace' }}>
      {items.slice(0, max).join(', ')}{items.length > max ? <span style={{ color: C.muted }}>{` +${items.length - max}`}</span> : null}
    </span>
  );
};

const Chip = ({ label, bg, color, title }) => (
  <span title={title} style={{ fontSize: 11, background: bg, color, padding: '2px 9px', borderRadius: 20, whiteSpace: 'nowrap', fontWeight: 400 }}>{label}</span>
);
const Spinner = ({ size = 20, border = 2 }) => (
  <div style={{ width: size, height: size, border: `${border}px solid ${C.line}`, borderTop: `${border}px solid ${C.blue}`, borderRadius: '50%', animation: 'tbSpin 0.7s linear infinite', flexShrink: 0 }} />
);

// selected / onSelect มาจาก TracebackPage เพื่อให้ URL (?doc_no=&code=) เปิดใบสอบกลับตรงได้
// selected / onSelect / form มาจาก TracebackPage: ฟอร์มค้นหาอยู่ที่ SearchPanel ใช้ร่วมกับสอบไปข้างหน้า; ปุ่มค้นหาเรียก search() ผ่าน ref
const ProductionLineDelayDashboard = forwardRef(({ selected = null, onSelect, form }, ref) => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);
  const [, setRecent] = useState(() => readRecent().filter(r => r.kind === 'doc'));
  const setSelected = useCallback(v => onSelect?.(v), [onSelect]);
  const sortBy = form.sort;

  const fetchData = useCallback(async (activeFilters) => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      Object.entries(activeFilters).forEach(([k, v]) => { if (v && String(v).trim()) params[k] = String(v).trim(); });
      const res = await axios.get(`${API_URL}/api/traceback/search`, { params });
      setResults(res.data?.data || []);
      setSearched(true);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useImperativeHandle(ref, () => ({
    search: () => fetchData(backwardFilters(form)),
    reset: () => { setResults([]); setSearched(false); setError(null); },
  }), [fetchData, form]);

  // ขอบเขตของใบสอบกลับ = ตัวกรองทุกช่องที่ตั้งไว้ในหน้าค้นหา (ทุกตัวมีผลบังคับ ไม่ผูกกับการ์ดที่กด):
  //   ใบสอบกลับครอบคลุม "ข้อมูลทั้งหมดที่ตรงกับตัวกรองครบทุกช่อง" ข้ามเอกสาร/Code/Batch/ไลน์
  //   เช่น ตั้ง Batch → ทุก Code ทุกไลน์ที่ใช้ Batch นี้ · ตั้ง Code → ทุก Batch ทุกไลน์ของ Code นี้ · ตั้ง Code + Batch → ทุกไลน์ที่ใช้ทั้งสองอย่าง
  //   ไม่ได้ตั้งตัวกรองเลย → เปิดตามเอกสารของการ์ดที่กด (เหมือนเดิม)
  const buildScope = r => {
    const filters = backwardFilters(form);
    const t = v => String(v || '').trim();
    const all = {
      doc_no: t(filters.doc_no), code: t(filters.code), batch: t(filters.batch), line: t(filters.rmm_line_name),
      mat: t(filters.mat), mat_name: t(filters.mat_name), supplier: t(filters.supplier),
      pack_from: t(filters.sc_pack_date_from), pack_to: t(filters.sc_pack_date_to),
    };
    const packStatus = filters.pack_status && filters.pack_status !== 'packed' ? filters.pack_status : '';
    if (!Object.values(all).some(Boolean)) return packStatus ? { scope: true, doc_no: r.doc_no, code: r.code, pack_status: packStatus } : { doc_no: r.doc_no, code: r.code };
    return Object.fromEntries(Object.entries({ scope: true, ...all, pack_status: packStatus }).filter(([, v]) => v));
  };

  // เปิดใบสอบกลับ → เลื่อนขึ้นบนสุดเสมอ
  const openRecord = r => {
    setRecent(pushRecent({ kind: 'doc', doc_no: r.doc_no, code: r.code }).filter(x => x.kind === 'doc'));
    setSelected(r.scope ? r : buildScope(r));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const sorted = useMemo(() => {
    const arr = [...results];
    const t = v => (v ? new Date(v).getTime() : 0);
    const n = v => Number(v || 0);
    // batches: คาดว่า backend ส่ง "batches" เป็น string คั่นด้วย comma (ดู routes.js)
    const first2x = v => String(v || '').split(',')[0].trim();
    const firstBatch = r => String(r.batches || '').split(',')[0].trim();
    const cmp = {
      pack_date_desc: (a, b) => t(b.pack_date_last) - t(a.pack_date_last),
      pack_date_asc: (a, b) => t(a.pack_date_first) - t(b.pack_date_first),
      severe_desc: (a, b) => n(b.severe_delay_count) - n(a.severe_delay_count) || n(b.warn_delay_count) - n(a.warn_delay_count),
      delay_desc: (a, b) => n(b.max_delay_minutes) - n(a.max_delay_minutes),
      weight_desc: (a, b) => n(b.total_weight_rm) - n(a.total_weight_rm),
      material_desc: (a, b) => n(b.material_count) - n(a.material_count),
      doc_no_asc: (a, b) => String(a.doc_no || '').localeCompare(String(b.doc_no || ''), 'th'),
      doc_no_desc: (a, b) => String(b.doc_no || '').localeCompare(String(a.doc_no || ''), 'th'),
      code_asc: (a, b) => String(a.code || '').localeCompare(String(b.code || ''), 'th'),
      batch_asc: (a, b) => firstBatch(a).localeCompare(firstBatch(b), 'th'),
      batch_desc: (a, b) => firstBatch(b).localeCompare(firstBatch(a), 'th'),
      mat_2x_asc: (a, b) => first2x(a.mats_2x).localeCompare(first2x(b.mats_2x), 'th'),
      mat_2x_desc: (a, b) => first2x(b.mats_2x).localeCompare(first2x(a.mats_2x), 'th'),
      batch_2x_asc: (a, b) => first2x(a.batches_2x).localeCompare(first2x(b.batches_2x), 'th'),
      batch_2x_desc: (a, b) => first2x(b.batches_2x).localeCompare(first2x(a.batches_2x), 'th'),
    }[sortBy];
    return cmp ? arr.sort(cmp) : arr;
  }, [results, sortBy]);

  // ── โหมดเต็มหน้า: เปิดใบสอบกลับแล้วซ่อนหน้าค้นหาไว้ทั้งหมด ───────────────
  if (selected) {
    return (
      <div style={{ padding: '1rem 0', fontFamily: 'inherit' }}>
        <style>{`@keyframes tbSpin { to { transform: rotate(360deg) } }`}</style>
        <TracebackDetailView
          docNo={selected.doc_no}
          code={selected.code}
          scope={selected.scope ? selected : null}
          onBack={() => setSelected(null)}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '0.5rem 0 1rem', fontFamily: 'inherit' }}>
      <style>{`
        @keyframes tbSpin { to { transform: rotate(360deg) } }
        .tb-cards { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
        .tb-grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }
        .tb-card:focus-visible { outline: 2px solid ${C.blue}; outline-offset: 2px; }
      `}</style>

      {error && (
        <div style={{ padding: '1rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, color: '#B91C1C', fontSize: 14, marginBottom: 16, fontWeight: 400 }}>
          ค้นหาไม่สำเร็จ: {error} — ตรวจสอบเงื่อนไขแล้วลองอีกครั้ง
        </div>
      )}

      {!searched && !loading && (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: C.faint, border: `0.5px dashed ${C.line}`, borderRadius: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: C.text2, marginBottom: 6 }}>เลือกเงื่อนไขแล้วกดค้นหา</div>
          <div style={{ fontSize: 13, fontWeight: 400 }}>ผลลัพธ์ 1 แถว = 1 การผลิต กดที่แถวเพื่อเปิดใบสอบกลับเต็มหน้า</div>
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 180, gap: 12 }}>
          <Spinner size={34} border={3} />
          <span style={{ color: C.muted, fontSize: 14, fontWeight: 400 }}>กำลังค้นหา...</span>
        </div>
      )}

      {searched && !loading && results.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: C.faint, fontSize: 14, border: `0.5px solid ${C.line2}`, borderRadius: 14, fontWeight: 400 }}>
          ไม่มีการผลิตที่ตรงเงื่อนไขนี้ ลองขยายช่วงวันที่หรือเอาตัวกรองบางตัวออก
        </div>
      )}

      {searched && !loading && results.length > 0 && (
        <div style={{ fontSize: 12, color: C.muted, margin: '0 0 6px 2px' }}>พบ {results.length} การผลิต</div>
      )}

      {searched && !loading && results.length > 0 && (
        <SimpleTable
          rows={sorted} getKey={(r, i) => `${r.doc_no}-${r.code}-${i}`} plain onRowClick={openRecord}
          columns={[
            { key: 'doc_no', label: 'เลขเอกสาร', render: r => <b>{r.doc_no}</b> },
            { key: 'code', label: 'Code สินค้า', wrap: true },
            { key: 'mat_names', label: 'วัตถุดิบ', wrap: true, minWidth: 220, render: r => <ListCell value={r.mat_names} max={2} /> },
            { key: 'batches', label: 'Batch', wrap: true, render: r => <ListCell value={r.batches} /> },
            { key: 'batches_2x', label: 'Batch 2x', wrap: true, render: r => <ListCell value={r.batches_2x} /> },
            { key: 'mats_2x', label: 'Mat 2x', wrap: true, render: r => <ListCell value={r.mats_2x} /> },
            { key: 'lines', label: 'ไลน์' },
            { key: 'material_count', label: 'วัตถุดิบ (ล็อต)', align: 'right' },
            { key: 'total_weight_rm', label: 'น้ำหนัก (kg)', align: 'right', render: r => fmtNum(r.total_weight_rm, 1) },
            { key: 'pack_date_first', label: 'วันบรรจุ', render: r => `${fmtDisplay(r.pack_date_first)}${r.pack_date_first !== r.pack_date_last ? ` → ${fmtDisplay(r.pack_date_last)}` : ''}` },
            {
              key: 'delay', label: 'ดีเลย์', sortValue: r => (r.severe_delay_count || 0) * 1000 + (r.warn_delay_count || 0),
              render: r => {
                const lvl = r.severe_delay_count > 0 ? 'severe' : r.warn_delay_count > 0 ? 'warn' : 'ok';
                const ds = DELAY_STYLE[lvl];
                return <Chip label={lvl === 'ok' ? 'ปกติ' : `${ds.label} ${lvl === 'severe' ? r.severe_delay_count : r.warn_delay_count}`} bg={ds.bg} color={ds.color} />;
              },
            },
          ]}
        />
      )}
    </div>
  );
});

ProductionLineDelayDashboard.displayName = 'ProductionLineDelayDashboard';

export default ProductionLineDelayDashboard;
