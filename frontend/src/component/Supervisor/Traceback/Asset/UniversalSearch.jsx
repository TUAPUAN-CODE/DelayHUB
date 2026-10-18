// ค้นหาอัจฉริยะ (แบบ Batch Information Cockpit ของ SAP): พิมพ์/สแกนอะไรก็ได้ 1 ช่อง
//   เลขเอกสาร · Code สินค้า · รหัสรุ่น · Lot บรรจุภัณฑ์ · เลขรายการ → บอกว่าพบเป็นอะไร แล้วพาไปหน้าที่ถูก
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { T, inputCss } from './tracebackUI';
import { Btn, Spinner, Tag } from './TraceAtoms';
import { fmtDT } from './tracebackCore';

const API_URL = import.meta.env.VITE_API_URL;

const Hit = ({ title, sub, tone = 'blue', onClick }) => (
  <button type="button" onClick={onClick} style={{
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, textAlign: 'left', cursor: 'pointer',
    fontFamily: 'inherit', padding: '9px 12px', borderRadius: 10, background: T.white,
    border: `1.5px solid ${tone === 'orange' ? T.orangeLine : T.blueLine}`, minWidth: 220, flex: '1 1 220px',
  }}>
    <span style={{ fontSize: 13, fontWeight: 700, color: tone === 'orange' ? T.orange : T.blueDeep }}>{title}</span>
    {sub && <span style={{ fontSize: 12, color: T.text2 }}>{sub}</span>}
  </button>
);

const UniversalSearch = ({ onOpenRecord, onForward }) => {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const ref = useRef(null);

  // กด / ที่ไหนก็ได้ในหน้า = ไปที่ช่องค้นหา
  useEffect(() => {
    const h = (e) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) { e.preventDefault(); ref.current?.focus(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const run = async () => {
    const v = q.trim();
    if (v.length < 2) { setErr('พิมพ์อย่างน้อย 2 ตัวอักษร'); return; }
    try {
      setBusy(true); setErr(''); setRes(null);
      const r = await axios.get(`${API_URL}/api/traceback/lookup`, { params: { q: v } });
      setRes(r.data?.data || null);
    } catch (e) {
      console.error('Traceback lookup error:', e);
      setErr(e.response?.data?.error || e.message);
    } finally { setBusy(false); }
  };

  const nothing = res && !res.docs?.length && !res.batch && !res.pkg && !res.mapping;

  return (
    <div style={{ padding: '0 20px 14px' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') run(); }}
          placeholder="ค้นหาอัจฉริยะ: เลขเอกสาร / Code สินค้า / รหัสรุ่น / Lot บรรจุภัณฑ์ / เลขรายการ   (กด / เพื่อพิมพ์)"
          aria-label="ค้นหาอัจฉริยะ" style={{ ...inputCss, flex: '1 1 280px', height: 42, fontSize: 14 }} />
        <Btn variant="blue" onClick={run} disabled={busy} style={{ height: 42 }}>{busy ? <Spinner size={14} /> : null} ค้นหา</Btn>
      </div>
      {err && <div style={{ marginTop: 8 }}><Tag tone="bad">{err}</Tag></div>}
      {res && (
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {res.mapping && (
            <Hit title={`รายการ #${res.mapping.mapping_id} · ${res.mapping.mat_name || ''}`} sub={`อยู่ในเอกสาร ${res.mapping.doc_no} · ${res.mapping.code}`}
              onClick={() => onOpenRecord(res.mapping.doc_no, res.mapping.code)} />
          )}
          {res.batch && (
            <Hit tone="orange" title={`รหัสรุ่นวัตถุดิบ ${res.q.toUpperCase()}`} sub={`ใช้ใน ${res.batch.count} ล็อต → สอบไปข้างหน้า`} onClick={() => onForward(res.q.toUpperCase(), 'rm')} />
          )}
          {res.pkg && (
            <Hit tone="orange" title={`Batch/Lot บรรจุภัณฑ์ ${res.q}`} sub={`พบ ${res.pkg.count} รายการใช้ → สอบไปข้างหน้า`} onClick={() => onForward(res.q, 'pkg')} />
          )}
          {(res.docs || []).slice(0, 8).map((d) => (
            <Hit key={`${d.doc_no}|${d.code}`} title={d.doc_no} sub={`${d.code} · ${d.lots} ล็อต · บรรจุล่าสุด ${fmtDT(d.pack_last)}`} onClick={() => onOpenRecord(d.doc_no, d.code)} />
          ))}
          {nothing && (
            <Hit tone="orange" title="ไม่พบในเอกสาร / วัตถุดิบ / บรรจุภัณฑ์" sub="ลองค้นเป็นรหัสรุ่นส่วนผสม (ฐาน WC) → สอบไปข้างหน้าทุกประเภท" onClick={() => onForward(res.q, 'auto')} />
          )}
        </div>
      )}
    </div>
  );
};

export default UniversalSearch;
