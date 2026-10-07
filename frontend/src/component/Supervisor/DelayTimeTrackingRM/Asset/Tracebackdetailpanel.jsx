import React, { useState, useEffect } from 'react';
import axios from 'axios';
axios.defaults.withCredentials = true;

const API_URL = import.meta.env.VITE_API_URL;

// ── helpers ──────────────────────────────────────────────────────────────
function parseDate(val) { if (!val) return null; const d = new Date(val); return isNaN(d) ? null : d; }
function fmtDisplay(val) {
  const d = parseDate(val);
  if (!d) return '-';
  return `${d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })} ${d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`;
}
function fmtNum(v, digits = 2) { if (v == null || v === '') return '-'; const n = Number(v); return isNaN(n) ? String(v) : n.toLocaleString(undefined, { maximumFractionDigits: digits }); }
function fmtDuration(mins) {
  if (mins == null) return '-';
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60), m = abs % 60;
  const sign = mins < 0 ? '-' : '';
  if (h === 0) return `${sign}${m}m`;
  if (m === 0) return `${sign}${h}h`;
  return `${sign}${h}h ${m}m`;
}
function delayLevel(mins) {
  if (mins == null) return 'none';
  if (mins > 480) return 'severe';
  if (mins > 120) return 'warn';
  return 'ok';
}
const DELAY_STYLE = {
  severe: { bg: '#FEE2E2', color: '#991B1B', border: '#FECACA', label: '⚠️ ดีเลย์รุนแรง' },
  warn: { bg: '#FEF3C7', color: '#92400E', border: '#FDE68A', label: 'ดีเลย์' },
  ok: { bg: '#F0FDF4', color: '#166534', border: '#BBF7D0', label: 'ปกติ' },
  none: { bg: '#F3F4F6', color: '#6B7280', border: '#E5E7EB', label: '-' },
};

const Chip = ({ label, bg, color }) => (
  <span style={{ fontSize: 11, background: bg, color, padding: '2px 9px', borderRadius: 20, whiteSpace: 'nowrap', fontWeight: 500 }}>{label}</span>
);
const Dash = () => <span style={{ color: '#D1D5DB' }}>—</span>;
const th = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280', borderBottom: '1px solid #E5E7EB', background: '#F5F8FF', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' };
const td = { padding: '8px 12px', borderBottom: '0.5px solid #F3F4F6', fontSize: 12.5, color: '#111827', whiteSpace: 'nowrap' };
const cardBox = { border: '0.5px solid #E5E7EB', borderRadius: 12, overflow: 'hidden', marginBottom: 16 };
const sectionTitle = { fontSize: 15, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 };

const KpiCard = ({ label, value, color, icon }) => (
  <div style={{ background: '#F5F8FF', borderRadius: 10, padding: '12px 16px', border: '0.5px solid #F3F4F6' }}>
    <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>{icon} {label}</div>
    <div style={{ fontSize: 20, fontWeight: 700, color: color || '#111827' }}>{value}</div>
  </div>
);

const SortIcon = ({ field, sortField, sortDir }) => {
  if (sortField !== field) return <span style={{ opacity: 0.25, marginLeft: 4, fontSize: 10 }}>↕</span>;
  return <span style={{ marginLeft: 4, fontSize: 10, color: '#1552F0' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
};

// ── Decoded batch code chip block ───────────────────────────────────────
const DecodedBlock = ({ decoded }) => {
  if (!decoded) return null;
  const { mat, batch } = decoded;
  return (
    <div style={{ marginTop: 8, padding: '10px 12px', background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6 }}>🔎 ถอดรหัสอัตโนมัติ</div>
      {!mat?.material_type_code ? (
        <div style={{ fontSize: 11.5, color: '#9CA3AF' }}>{mat?.note || 'ไม่สามารถถอดรหัส mat นี้ได้'}</div>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: batch ? 8 : 0 }}>
            <Chip label={`ชนิด: ${mat.decoded.material_type}`} bg="#EAF0FF" color="#0F3FC4" />
            {Object.entries(mat.decoded).filter(([k]) => k !== 'material_type').map(([k, v]) => (
              <Chip key={k} label={`${k}: ${v}`} bg="#F1F5F9" color="#334155" />
            ))}
          </div>
          {batch?.decoded ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {batch.decoded.map((d, i) => (
                <Chip key={i} label={`${d.meaning}: ${d.resolved}`} bg="#FEF9C3" color="#854D0E" />
              ))}
            </div>
          ) : batch?.note ? (
            <div style={{ fontSize: 11.5, color: '#9CA3AF' }}>{batch.note}</div>
          ) : null}
        </>
      )}
    </div>
  );
};

// ── Summary tab ──────────────────────────────────────────────────────────
const SummaryTab = ({ data }) => {
  const { summary, materials } = data;
  const events = [
    { label: 'รับวัตถุดิบเข้าเตรียม', getVal: m => m.rmit_date },
    { label: 'ต้ม/อบเสร็จ', getVal: m => m.cooked_date },
    { label: 'ส่งออกห้องเย็น', getVal: m => m.withdraw_date },
    { label: 'บรรจุเสร็จ', getVal: m => m.sc_pack_date },
  ];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 20 }}>
        <KpiCard icon="📋" label="รายการวัตถุดิบ" value={summary.material_count} color="#1552F0" />
        <KpiCard icon="⚖️" label="น้ำหนักรวม (kg)" value={fmtNum(summary.total_weight_rm, 1)} color="#10B981" />
        <KpiCard icon="⚠️" label="ดีเลย์รุนแรง (>8ชม.)" value={summary.severe_delay_count} color={summary.severe_delay_count > 0 ? '#DC2626' : '#111827'} />
        <KpiCard icon="⏱" label="ดีเลย์ (2-8ชม.)" value={summary.warn_delay_count} color={summary.warn_delay_count > 0 ? '#D97706' : '#111827'} />
        <KpiCard icon="📈" label="ดีเลย์เฉลี่ย" value={fmtDuration(summary.avg_delay_minutes)} color="#6366F1" />
        <KpiCard icon="🔺" label="ดีเลย์สูงสุด" value={fmtDuration(summary.max_delay_minutes)} color="#DC2626" />
      </div>

      <div style={sectionTitle}><span>🏭</span> ข้อมูลการผลิต</div>
      <div style={{ ...cardBox, padding: '14px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 14 }}>
        <div><div style={{ fontSize: 11, color: '#9CA3AF' }}>เลขเอกสาร</div><div style={{ fontSize: 14, fontWeight: 600 }}>{summary.doc_no}</div></div>
        <div><div style={{ fontSize: 11, color: '#9CA3AF' }}>Code</div><div style={{ fontSize: 14, fontWeight: 600 }}>{summary.code}</div></div>
        <div><div style={{ fontSize: 11, color: '#9CA3AF' }}>ไลน์</div><div style={{ fontSize: 14, fontWeight: 600 }}>{summary.lines?.join(', ') || '-'}</div></div>
        <div><div style={{ fontSize: 11, color: '#9CA3AF' }}>เริ่มบรรจุ</div><div style={{ fontSize: 14, fontWeight: 600 }}>{fmtDisplay(summary.pack_date_first)}</div></div>
        <div><div style={{ fontSize: 11, color: '#9CA3AF' }}>บรรจุเสร็จล่าสุด</div><div style={{ fontSize: 14, fontWeight: 600 }}>{fmtDisplay(summary.pack_date_last)}</div></div>
      </div>

      <div style={{ ...sectionTitle, marginTop: 20 }}><span>⏱️</span> Timeline โดยสรุป</div>
      <div style={{ ...cardBox, padding: '16px 18px' }}>
        {events.map((ev, i) => {
          const vals = materials.map(ev.getVal).filter(Boolean).sort();
          if (vals.length === 0) return null;
          return (
            <div key={i} style={{ display: 'flex', gap: 14, marginBottom: i === events.length - 1 ? 0 : 12, alignItems: 'center' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#1552F0', flexShrink: 0 }} />
              <div style={{ fontSize: 13, color: '#374151', minWidth: 160 }}>{ev.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{fmtDisplay(vals[0])}{vals.length > 1 ? ` → ${fmtDisplay(vals[vals.length - 1])}` : ''}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Detailed tab ─────────────────────────────────────────────────────────
const DetailedTab = ({ data }) => {
  const { materials } = data;
  const [sortField, setSortField] = useState('mat');
  const [sortDir, setSortDir] = useState('asc');
  const [expanded, setExpanded] = useState({});

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const sorted = [...materials].sort((a, b) => {
    let av = a[sortField], bv = b[sortField];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv, 'th') : bv.localeCompare(av, 'th');
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  const columns = [
    { key: 'mat', label: 'Mat' },
    { key: 'mat_2x', label: 'Mat 2x' },
    { key: 'mat_name', label: 'ชื่อวัตถุดิบ' },
    { key: 'batch_before', label: 'Batch Tag' },
    { key: 'batch_after', label: 'Batch หลังเตรียม' },
    { key: 'weight_RM', label: 'น้ำหนัก' },
    { key: 'sc_pack_date', label: 'บรรจุเสร็จ' },
    { key: 'total_delay_minutes', label: 'ดีเลย์รวม' },
  ];

  return (
    <div>
      <div style={sectionTitle}><span>🧾</span> รายการวัตถุดิบทั้งหมด ({materials.length})</div>
      <div style={{ ...cardBox, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, cursor: 'default' }}></th>
              {columns.map(c => (
                <th key={c.key} style={th} onClick={() => handleSort(c.key)}>
                  {c.label}<SortIcon field={c.key} sortField={sortField} sortDir={sortDir} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((m, i) => {
              const lvl = delayLevel(m.total_delay_minutes);
              const ds = DELAY_STYLE[lvl];
              const isOpen = expanded[m.mapping_id];
              return (
                <React.Fragment key={m.mapping_id ?? i}>
                  <tr style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA', cursor: 'pointer' }} onClick={() => setExpanded(p => ({ ...p, [m.mapping_id]: !p[m.mapping_id] }))}>
                    <td style={{ ...td, textAlign: 'center' }}>{isOpen ? '▼' : '▶'}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{m.mat || <Dash />}</td>
                    <td style={td}>{m.mat_2x || <Dash />}</td>
                    <td style={{ ...td, whiteSpace: 'normal', minWidth: 160 }}>{m.mat_name || <Dash />}</td>
                    <td style={td}>{m.batch_before ?? <Dash />}</td>
                    <td style={td}>{m.batch_after ?? <Dash />}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmtNum(m.weight_RM, 1)}</td>
                    <td style={td}>{fmtDisplay(m.sc_pack_date)}</td>
                    <td style={td}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: ds.color, background: ds.bg, border: `1px solid ${ds.border}`, padding: '3px 10px', borderRadius: 20 }}>
                        {fmtDuration(m.total_delay_minutes)}
                      </span>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={columns.length + 1} style={{ padding: '14px 18px 20px 40px', background: '#FAFBFC', borderBottom: '1px solid #E5E7EB' }}>
                        <DecodedBlock decoded={m.decoded} />

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 14 }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>🧪 เคมี/วัตถุดิบ (WO: {m.wo_no || '-'})</div>
                            {(!m.ingredients || m.ingredients.length === 0) ? (
                              <div style={{ fontSize: 12, color: '#9CA3AF' }}>{m.ingredients_error ? `ผิดพลาด: ${m.ingredients_error}` : 'ไม่พบข้อมูล'}</div>
                            ) : (
                              <div style={{ border: '0.5px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
                                {m.ingredients.map((it, ii) => (
                                  <div key={ii} style={{ padding: '6px 10px', fontSize: 11.5, borderBottom: ii < m.ingredients.length - 1 ? '0.5px solid #F3F4F6' : 'none', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{it.MaterialCode} — {it.MaterialName || it.MaterialShortName}</span>
                                    <span style={{ color: '#6B7280' }}>{fmtNum(it.NetWt)} kg ({fmtNum(it.Percentage)}%)</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>📦 บรรจุภัณฑ์</div>
                            {(!m.packaging || m.packaging.length === 0) ? (
                              <div style={{ fontSize: 12, color: '#9CA3AF' }}>{m.packaging_error ? `ผิดพลาด: ${m.packaging_error}` : 'ไม่พบข้อมูล'}</div>
                            ) : (
                              <div style={{ border: '0.5px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
                                {m.packaging.map((p, pi) => (
                                  <div key={pi} style={{ padding: '6px 10px', fontSize: 11.5, borderBottom: pi < m.packaging.length - 1 ? '0.5px solid #F3F4F6' : 'none', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{p.code} · {p.lot_no || '-'}</span>
                                    <span style={{ color: '#6B7280' }}>เหลือ {fmtNum(p.qty_remaining)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Main panel ───────────────────────────────────────────────────────────
const TracebackDetailPanel = ({ docNo, code, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('summary'); // 'summary' | 'detailed'

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await axios.get(`${API_URL}/api/traceback/detail`, { params: { doc_no: docNo, code } });
        if (!cancelled) setData(res.data?.data || null);
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.error || e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [docNo, code]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <style>{`@keyframes tbModalIn { from { opacity:0; transform:scale(0.96) } to { opacity:1; transform:scale(1) } } @keyframes tbSpin { to { transform: rotate(360deg) } }`}</style>
      <div
        style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 1300, maxHeight: '94vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.25)', animation: 'tbModalIn 0.2s ease' }}
        onClick={e => e.stopPropagation()}
      >
        {/* header */}
        <div style={{ padding: '18px 26px', borderBottom: '1px solid #E5E7EB', background: '#F5F8FF', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>📄</span> Traceback: {docNo} {code && `(${code})`}
            </div>
          </div>
          <button onClick={onClose} style={{ background: '#F3F4F6', border: '1px solid #E5E7EB', cursor: 'pointer', width: 36, height: 36, borderRadius: '50%', fontSize: 15, color: '#374151' }}>✕</button>
        </div>

        {/* tabs */}
        <div style={{ display: 'flex', gap: 4, padding: '10px 26px 0', borderBottom: '1px solid #E5E7EB', background: '#fff', flexShrink: 0 }}>
          {[{ key: 'summary', label: '📋 Summary Protocol' }, { key: 'detailed', label: '🔬 Detailed Protocol' }].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '10px 18px', fontSize: 13, fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer',
                color: tab === t.key ? '#0F3FC4' : '#6B7280',
                borderBottom: tab === t.key ? '2px solid #1552F0' : '2px solid transparent',
              }}
            >{t.label}</button>
          ))}
        </div>

        {/* body */}
        <div style={{ overflowY: 'auto', padding: '22px 26px', flex: 1, background: '#fff' }}>
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 160, gap: 12 }}>
              <div style={{ width: 30, height: 30, border: '3px solid #E5E7EB', borderTop: '3px solid #1552F0', borderRadius: '50%', animation: 'tbSpin 0.7s linear infinite' }} />
              <span style={{ color: '#6B7280', fontSize: 14 }}>กำลังโหลดข้อมูล...</span>
            </div>
          )}
          {error && !loading && (
            <div style={{ padding: '1rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, color: '#B91C1C', fontSize: 14 }}>เกิดข้อผิดพลาด: {error}</div>
          )}
          {!loading && !error && data && (
            tab === 'summary' ? <SummaryTab data={data} /> : <DetailedTab data={data} />
          )}
        </div>
      </div>
    </div>
  );
};

export default TracebackDetailPanel;