import { useEffect, useState } from 'react';
import axios from 'axios';
import SearchableSelect from './SearchableSelect';
import { Btn, ModeSwitch, Spinner } from './TraceAtoms';
import { T, inputCss } from './tracebackUI';
import { PACK_STATUS_OPTIONS, BACK_SORT_OPTIONS, FWD_SORT_OPTIONS } from './traceForm';

const API_URL = import.meta.env.VITE_API_URL;
const lbl = { fontSize: 11.5, fontWeight: 600, color: T.blueDeep, display: 'block', marginBottom: 4 };
const cell = (min = 130) => ({ flex: `1 1 ${min}px`, minWidth: min, maxWidth: 260 });

/**
 * The only search form of the page. Both directions share its fields; the buttons "สอบย้อนกลับ / สอบไปข้างหน้า" are part of it:
 *   backward: Batch + filters -> the list of productions · forward: Batch / Lot (+ kind, one / many) -> where it went, the filters narrow the result
 * Kept to few rows on purpose, so the data below starts as high as possible.
 */
const SearchPanel = ({ mode, onModeChange, form, setForm, onSearch, onReset, loading, recent = [], onPickRecent }) => {
  const [opts, setOpts] = useState({ code: [], doc_no: [], mat: [], mat_name: [], rmm_line_name: [], supplier: [], batch: [] });
  const [optsLoading, setOptsLoading] = useState(false);
  const fwd = mode === 'forward';
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setOptsLoading(true);
        const res = await axios.get(`${API_URL}/api/traceback/filters`);
        if (!cancelled) setOpts(prev => ({ ...prev, ...(res.data?.data || {}) }));
      } catch (e) {
        console.warn('โหลดรายการตัวกรองไม่สำเร็จ:', e.message);
      } finally {
        if (!cancelled) setOptsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const sortOptions = fwd ? FWD_SORT_OPTIONS : BACK_SORT_OPTIONS;
  const enter = e => { if (e.key === 'Enter') onSearch(); };

  return (
    <div className="tb-noprint" style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: 14, padding: '14px 18px', marginTop: 12 }}>
      {/* แถว 1: ปุ่มทิศทาง · รหัสรุ่น / Lot (หลายรหัสคั่นด้วย , หรือเว้นวรรค ค้นทุกประเภทเสมอ) · ค้นหา + ล้างเงื่อนไข ติดกัน */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <ModeSwitch mode={mode} onChange={onModeChange} />
        <div style={{ flex: '1 1 320px', minWidth: 240 }}>
          <label style={lbl}>รหัสรุ่น (Batch) / Lot บรรจุภัณฑ์</label>
          <input value={form.trace} onChange={e => set('trace', e.target.value.toUpperCase())} onKeyDown={enter}
            placeholder="สแกนหรือพิมพ์รหัสรุ่น / Lot (หลายรหัสคั่นด้วย , หรือเว้นวรรค) แล้วกด Enter"
            aria-label="รหัสรุ่นหรือ Lot"
            style={{ ...inputCss, fontFamily: 'ui-monospace,monospace', letterSpacing: 1, fontWeight: 600 }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={onSearch} disabled={loading}>{loading ? <Spinner size={14} /> : null}ค้นหา</Btn>
          <Btn variant="ghost" onClick={onReset} disabled={loading}>ล้างเงื่อนไข</Btn>
        </div>
      </div>

      {/* แถว 3-4: ตัวกรอง (ใช้ร่วมกันทั้งสองทิศทาง) */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 12 }}>
        <div style={cell(120)}><SearchableSelect label="เลขเอกสาร (doc_no)" value={form.doc_no} onChange={v => set('doc_no', v)} options={opts.doc_no} loading={optsLoading} placeholder="ทุกเอกสาร" /></div>
        <div style={cell(130)}><SearchableSelect label="Code สินค้า" value={form.code} onChange={v => set('code', v)} options={opts.code} loading={optsLoading} placeholder="ทุก Code" /></div>
        <div style={cell(120)}><SearchableSelect label="รหัสวัตถุดิบ (Mat)" value={form.mat} onChange={v => set('mat', v)} options={opts.mat} loading={optsLoading} placeholder="ทุกรหัส" /></div>
        <div style={cell(150)}><SearchableSelect label="ชื่อวัตถุดิบ" value={form.mat_name} onChange={v => set('mat_name', v)} options={opts.mat_name} loading={optsLoading} placeholder="ทุกชื่อ" /></div>
        <div style={cell(100)}><SearchableSelect label="ไลน์ผลิต" value={form.rmm_line_name} onChange={v => set('rmm_line_name', v)} options={opts.rmm_line_name} loading={optsLoading} placeholder="ทุกไลน์" /></div>
        <div style={cell(130)}>
          <SearchableSelect label="ผู้ขาย / ซัพพลายเออร์" value={form.supplier} onChange={v => set('supplier', v)} options={opts.supplier} loading={optsLoading}
            placeholder={!optsLoading && opts.supplier.length === 0 ? 'ไม่มีข้อมูลผู้ขายในระบบ' : 'ทุกราย'} />
        </div>
        <div style={{ ...cell(175), maxWidth: 210 }}>
          <label style={lbl}>สถานะวัตถุดิบที่แสดง</label>
          <select value={form.pack_status} onChange={e => set('pack_status', e.target.value)} style={inputCss}>
            {PACK_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <label style={{ fontSize: 12, color: T.text2, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', height: 38 }}>
          <input type="checkbox" checked={form.single} onChange={e => set('single', e.target.checked)} />
          ค้นหาแค่วันเดียว
        </label>
        <div style={{ width: 140 }}>
          <label style={lbl}>{form.single ? 'วันที่บรรจุ' : 'วันที่บรรจุ (จาก)'}</label>
          <input type="date" value={form.from} onChange={e => set('from', e.target.value)} style={inputCss} />
        </div>
        {!form.single && (
          <div style={{ width: 140 }}>
            <label style={lbl}>วันที่บรรจุ (ถึง)</label>
            <input type="date" value={form.to} onChange={e => set('to', e.target.value)} style={inputCss} />
          </div>
        )}
        <div style={cell(190)}>
          <SearchableSelect label="เรียงลำดับผลลัพธ์" value={form.sort} onChange={v => set('sort', v || sortOptions[0].value)} options={sortOptions} allowFree={false} placeholder={sortOptions[0].label} />
        </div>
      </div>

      {/* ล่าสุด: อยู่ล่างสุดของกล่อง */}
      {recent.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
          <span style={{ fontSize: 12, color: T.text2 }}>ล่าสุด:</span>
          {recent.slice(0, 6).map(r => (
            <button key={r.key} type="button" onClick={() => onPickRecent(r)}
              style={{ border: `1px solid ${T.blueLine}`, background: T.blueSoft, color: T.blueDeep, borderRadius: 20, padding: '3px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              {r.code}
            </button>
          ))}
        </div>
      )}

    </div>
  );
};

export default SearchPanel;
