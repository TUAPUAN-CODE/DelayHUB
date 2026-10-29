import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import SearchableSelect from './SearchableSelect';
import TracebackDetailView from './TracebackDetailView';
import {
  C, labelStyle, inputStyle, btnPrimary, btnSecondary,
  fmtDisplay, fmtNum, DELAY_STYLE,
} from './tracebackUI';
import { readRecent, pushRecent } from './tracebackCore';
import { exportResultsExcel } from './tracebackExport';

axios.defaults.withCredentials = true;
const API_URL = import.meta.env.VITE_API_URL;

const Chip = ({ label, bg, color, title }) => (
  <span title={title} style={{ fontSize: 11, background: bg, color, padding: '2px 9px', borderRadius: 20, whiteSpace: 'nowrap', fontWeight: 400 }}>{label}</span>
);
const Spinner = ({ size = 20, border = 2 }) => (
  <div style={{ width: size, height: size, border: `${border}px solid ${C.line}`, borderTop: `${border}px solid ${C.blue}`, borderRadius: '50%', animation: 'tbSpin 0.7s linear infinite', flexShrink: 0 }} />
);

const EMPTY_FILTERS = {
  code: '', doc_no: '', mat: '', mat_name: '', rmm_line_name: '', supplier: '', batch: '',
  sc_pack_date_from: '', sc_pack_date_to: '',
  pack_status: 'packed', // packed = บรรจุเสร็จ (เดิม) · all = ทุกสถานะ · unpacked = ยังไม่บรรจุเสร็จ
};

const PACK_STATUS_OPTIONS = [
  { value: 'packed', label: 'บรรจุเสร็จเท่านั้น' },
  { value: 'all', label: 'ทุกสถานะวัตถุดิบ' },
  { value: 'unpacked', label: 'ยังไม่บรรจุเสร็จ (อยู่ระหว่างกระบวนการ)' },
];

// ข้อ 7: เพิ่มตัวเลือกเรียงตาม Batch และ doc_no (ทั้ง 2 ทิศทาง)
// หมายเหตุ: ต้องให้ /api/traceback/search ส่งฟิลด์ batches_raw (STRING_AGG ของ batch_before)
// กลับมาด้วย (ดู traceback.routes.js ที่แก้ไปพร้อมกัน) ไม่งั้นการเรียงตาม batch จะใช้ไม่ได้จริง
const SORT_OPTIONS = [
  { value: 'pack_date_desc', label: 'วันบรรจุ ล่าสุด → เก่าสุด' },
  { value: 'pack_date_asc', label: 'วันบรรจุ เก่าสุด → ล่าสุด' },
  { value: 'severe_desc', label: 'ดีเลย์รุนแรง มาก → น้อย' },
  { value: 'delay_desc', label: 'ดีเลย์สูงสุด มาก → น้อย' },
  { value: 'weight_desc', label: 'น้ำหนักรวม มาก → น้อย' },
  { value: 'material_desc', label: 'จำนวนวัตถุดิบ มาก → น้อย' },
  { value: 'doc_no_asc', label: 'เลขเอกสาร (doc_no) ก → ฮ' },
  { value: 'doc_no_desc', label: 'เลขเอกสาร (doc_no) ฮ → ก' },
  { value: 'code_asc', label: 'Code ก → ฮ' },
  { value: 'batch_asc', label: 'รหัสรุ่น (Batch) ก → ฮ' },
  { value: 'batch_desc', label: 'รหัสรุ่น (Batch) ฮ → ก' },
];

// ปุ่มช่วงวันที่ลัด (วันที่ตามเวลาเครื่อง)
const ymd = (d) => {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const DATE_PRESETS = [
  { label: 'วันนี้', from: 0, to: 0 },
  { label: 'เมื่อวาน', from: 1, to: 1 },
  { label: '7 วัน', from: 6, to: 0 },
  { label: '30 วัน', from: 29, to: 0 },
];
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };

// selected / onSelect มาจาก TracebackPage เพื่อให้ URL (?doc_no=&code=) เปิดใบสอบกลับตรงได้
const ProductionLineDelayDashboard = ({ selected = null, onSelect }) => {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [singleDayMode, setSingleDayMode] = useState(true);
  const [sortBy, setSortBy] = useState('pack_date_desc');

  const [opts, setOpts] = useState({ code: [], doc_no: [], mat: [], mat_name: [], rmm_line_name: [], supplier: [], batch: [] });
  const [optsLoading, setOptsLoading] = useState(false);

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);
  const [recent, setRecent] = useState(() => readRecent().filter(r => r.kind === 'doc'));
  const setSelected = useCallback(v => onSelect?.(v), [onSelect]);

  const setF = (key, val) => setFilters(p => ({ ...p, [key]: val }));

  // ── โหลดค่าที่เลือกได้ทั้งหมดจากระบบ ─────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setOptsLoading(true);
        const res = await axios.get(`${API_URL}/api/traceback/filters`, { params: { pack_status: filters.pack_status } });
        if (!cancelled) setOpts(prev => ({ ...prev, ...(res.data?.data || {}) }));
      } catch (e) {
        console.warn('โหลดรายการตัวกรองไม่สำเร็จ:', e.message);
      } finally {
        if (!cancelled) setOptsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [filters.pack_status]);

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

  const handleSearch = () => fetchData(filters);
  const applyPreset = (pr) => {
    const next = { ...filters, sc_pack_date_from: daysAgo(pr.from), sc_pack_date_to: daysAgo(pr.to) };
    setSingleDayMode(pr.from === pr.to);
    setFilters(next);
    fetchData(next);
  };
  const handleReset = () => {
    setFilters(EMPTY_FILTERS); setResults([]); setSearched(false); setError(null);
  };

  // ขอบเขตของใบสอบกลับ = ตัวกรองทุกช่องที่ตั้งไว้ในหน้าค้นหา (ทุกตัวมีผลบังคับ ไม่ผูกกับการ์ดที่กด):
  //   ใบสอบกลับครอบคลุม "ข้อมูลทั้งหมดที่ตรงกับตัวกรองครบทุกช่อง" ข้ามเอกสาร/Code/Batch/ไลน์
  //   เช่น ตั้ง Batch → ทุก Code ทุกไลน์ที่ใช้ Batch นี้ · ตั้ง Code → ทุก Batch ทุกไลน์ของ Code นี้ · ตั้ง Code + Batch → ทุกไลน์ที่ใช้ทั้งสองอย่าง
  //   ไม่ได้ตั้งตัวกรองเลย → เปิดตามเอกสารของการ์ดที่กด (เหมือนเดิม)
  const buildScope = r => {
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
    <div style={{ padding: '1rem 0', fontFamily: 'inherit' }}>
      <style>{`
        @keyframes tbSpin { to { transform: rotate(360deg) } }
        .tb-cards { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
        .tb-grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }
        .tb-card:focus-visible { outline: 2px solid ${C.blue}; outline-offset: 2px; }
      `}</style>

      {/* ── แถบค้นหา ─────────────────────────────────────────────────────── */}
      <div style={{ background: C.white, border: `0.5px solid ${C.line}`, borderRadius: 14, padding: '18px 20px', marginBottom: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text2, marginBottom: 14 }}>ค้นหาการผลิตเพื่อสอบกลับ</div>

        <div className="tb-grid" style={{ marginBottom: 12 }}>
          <SearchableSelect label="เลขเอกสาร (doc_no)" value={filters.doc_no} onChange={v => setF('doc_no', v)} options={opts.doc_no} loading={optsLoading} placeholder="ทุกเอกสาร" />
          <SearchableSelect label="Code สินค้า" value={filters.code} onChange={v => setF('code', v)} options={opts.code} loading={optsLoading} placeholder="ทุก Code" />
          <SearchableSelect label="รหัสวัตถุดิบ (Mat)" value={filters.mat} onChange={v => setF('mat', v)} options={opts.mat} loading={optsLoading} placeholder="ทุกรหัส" />
          <SearchableSelect label="ชื่อวัตถุดิบ" value={filters.mat_name} onChange={v => setF('mat_name', v)} options={opts.mat_name} loading={optsLoading} placeholder="ทุกชื่อ" />
          <SearchableSelect label="รหัสรุ่น (Batch)" value={filters.batch} onChange={v => setF('batch', v)} options={opts.batch} loading={optsLoading} placeholder="ทุกรหัสรุ่น" />
          <SearchableSelect label="ไลน์ผลิต" value={filters.rmm_line_name} onChange={v => setF('rmm_line_name', v)} options={opts.rmm_line_name} loading={optsLoading} placeholder="ทุกไลน์" />
          <SearchableSelect
            label="ผู้ขาย / ซัพพลายเออร์"
            value={filters.supplier}
            onChange={v => setF('supplier', v)}
            options={opts.supplier}
            loading={optsLoading}
            placeholder={!optsLoading && opts.supplier.length === 0 ? 'ไม่มีข้อมูลผู้ขายในระบบ' : 'ทุกราย'}
          />
        </div>

        <div style={{ marginBottom: 10, maxWidth: 360 }}>
          <label style={labelStyle}>สถานะวัตถุดิบที่แสดง</label>
          <select style={inputStyle} value={filters.pack_status} onChange={e => setF('pack_status', e.target.value)}>
            {PACK_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <label style={{ fontSize: 12, color: C.text2, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: 10, fontWeight: 400 }}>
          <input
            type="checkbox"
            checked={singleDayMode}
            onChange={e => {
              const checked = e.target.checked;
              setSingleDayMode(checked);
              if (checked) setF('sc_pack_date_to', filters.sc_pack_date_from);
            }}
          />
          ค้นหาแค่วันเดียว
        </label>

        <div className="tb-grid" style={{ marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>{singleDayMode ? 'วันที่บรรจุ' : 'วันที่บรรจุ (จาก)'}</label>
            <input
              type="date"
              style={inputStyle}
              value={filters.sc_pack_date_from}
              onChange={e => { setF('sc_pack_date_from', e.target.value); if (singleDayMode) setF('sc_pack_date_to', e.target.value); }}
            />
          </div>
          {!singleDayMode && (
            <div>
              <label style={labelStyle}>วันที่บรรจุ (ถึง)</label>
              <input type="date" style={inputStyle} value={filters.sc_pack_date_to} onChange={e => setF('sc_pack_date_to', e.target.value)} />
            </div>
          )}
          <SearchableSelect label="เรียงลำดับผลลัพธ์" value={sortBy} onChange={v => setSortBy(v || 'pack_date_desc')} options={SORT_OPTIONS} allowFree={false} placeholder="เลือกการเรียง" />
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: C.text2, fontWeight: 500 }}>ช่วงวันที่ลัด:</span>
          {DATE_PRESETS.map(pr => (
            <button key={pr.label} type="button" onClick={() => applyPreset(pr)} disabled={loading}
              style={{ border: `1px solid ${C.line}`, background: C.blueSoft, color: C.blueDark, borderRadius: 20, padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
              {pr.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={handleSearch} disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
            {loading ? <Spinner size={14} /> : null} ค้นหา
          </button>
          <button onClick={handleReset} disabled={loading} style={{ ...btnSecondary, fontWeight: 500 }}>ล้างเงื่อนไข</button>
          {searched && !loading && (
            <span style={{ fontSize: 12, color: C.muted, fontWeight: 400 }}>พบ {results.length} การผลิต</span>
          )}
          {searched && !loading && results.length > 0 && (
            <button type="button" onClick={() => exportResultsExcel(sorted)} style={{ ...btnSecondary, marginLeft: 'auto', fontWeight: 500 }}>
              ส่งออกผลการค้นหา (Excel)
            </button>
          )}
        </div>

        {recent.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: `1px dashed ${C.line}` }}>
            <span style={{ fontSize: 12, color: C.text2, fontWeight: 500 }}>เปิดล่าสุด:</span>
            {recent.slice(0, 6).map(r => (
              <button key={r.key} type="button" onClick={() => openRecord(r)} title={r.code}
                style={{ border: `1px solid ${C.line}`, background: C.white, color: C.blueDark, borderRadius: 20, padding: '3px 11px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.doc_no}
              </button>
            ))}
          </div>
        )}
      </div>

      {searched && !loading && results.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 14 }}>
          {[
            ['เอกสารผลิต', results.length, C.blue],
            ['ดีเลย์รุนแรง', results.filter(r => r.severe_delay_count > 0).length, DELAY_STYLE.severe.color],
            ['ดีเลย์เตือน', results.filter(r => !r.severe_delay_count && r.warn_delay_count > 0).length, DELAY_STYLE.warn.color],
            ['ปกติ', results.filter(r => !r.severe_delay_count && !r.warn_delay_count).length, DELAY_STYLE.ok.color],
            ['น้ำหนักรวม (kg)', fmtNum(results.reduce((a, r) => a + (Number(r.total_weight_rm) || 0), 0), 1), C.blueDark],
          ].map(([l, v, c]) => (
            <div key={l} style={{ background: C.white, border: `1px solid ${C.line}`, borderLeft: `4px solid ${c}`, borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 11.5, color: C.text2, fontWeight: 500 }}>{l}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: c }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ padding: '1rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, color: '#B91C1C', fontSize: 14, marginBottom: 16, fontWeight: 400 }}>
          ค้นหาไม่สำเร็จ: {error} — ตรวจสอบเงื่อนไขแล้วลองอีกครั้ง
        </div>
      )}

      {!searched && !loading && (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: C.faint, border: `0.5px dashed ${C.line}`, borderRadius: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: C.text2, marginBottom: 6 }}>เลือกเงื่อนไขแล้วกดค้นหา</div>
          <div style={{ fontSize: 13, fontWeight: 400 }}>ผลลัพธ์ 1 การ์ด = 1 การผลิต กดที่การ์ดเพื่อเปิดใบสอบกลับเต็มหน้า</div>
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
        <div className="tb-cards">
          {sorted.map((r, i) => {
            const lvl = r.severe_delay_count > 0 ? 'severe' : r.warn_delay_count > 0 ? 'warn' : 'ok';
            const ds = DELAY_STYLE[lvl];
            return (
              <div
                key={`${r.doc_no}-${r.code}-${i}`}
                className="tb-card"
                role="button"
                tabIndex={0}
                onClick={() => openRecord(r)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openRecord(r); } }}
                style={{
                  background: C.white,
                  border: `0.5px solid ${C.line}`,
                  borderLeft: `4px solid ${ds.border}`,
                  borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
                  boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.doc_no}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2, fontWeight: 400 }}>{r.code}</div>
                  </div>
                  <Chip
                    label={lvl === 'ok' ? 'ปกติ' : `${ds.label} ${lvl === 'severe' ? r.severe_delay_count : r.warn_delay_count}`}
                    bg={ds.bg} color={ds.color}
                  />
                </div>

                <div style={{ fontSize: 12.5, color: C.text2, marginBottom: 8, lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontWeight: 400 }}>
                  {r.mat_names || '-'}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  <Chip label={`${r.material_count} วัตถุดิบ`} bg={C.line2} color={C.text2} />
                  <Chip label={`${fmtNum(r.total_weight_rm, 1)} kg`} bg={C.line2} color={C.text2} />
                  {r.lines && <Chip label={r.lines} bg={C.violetSoft} color="#5B21B6" />}
                </div>

                <div style={{ fontSize: 11, color: C.faint, fontWeight: 400 }}>
                  บรรจุ {fmtDisplay(r.pack_date_first)}
                  {r.pack_date_first !== r.pack_date_last ? ` → ${fmtDisplay(r.pack_date_last)}` : ''}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProductionLineDelayDashboard;
