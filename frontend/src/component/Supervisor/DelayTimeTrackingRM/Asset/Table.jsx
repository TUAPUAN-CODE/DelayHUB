import React, { useState, useEffect, useCallback, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL;

function getPercentileValue(rows, dbsField, p) {
  const vals = rows.map(r => r[dbsField]).filter(v => v !== null && v !== undefined).sort((a, b) => a - b);
  if (!vals.length) return null;
  const idx = Math.ceil((p / 100) * vals.length) - 1;
  return vals[Math.max(0, idx)];
}

function buildGroupedRows(data, groupBy, percentile) {
  const groups = {};
  data.forEach(r => {
    const key = r[groupBy] || '(ไม่ระบุ)';
    if (!groups[key]) groups[key] = {
      rows: [], rm_type_name: r.rm_type_name, rm_group_name: r.rm_group_name,
      prep_to_cold: r.prep_to_cold, cold_to_pack: r.cold_to_pack,
      cold: r.cold, prep_to_pack: r.prep_to_pack,
      line_set: new Set(), doc_set: new Set(),
    };
    groups[key].rows.push(r);
    if (r.rmm_line_name) groups[key].line_set.add(r.rmm_line_name);
    if (r.doc_no)        groups[key].doc_set.add(r.doc_no);
  });
  return Object.entries(groups).map(([name, g]) => ({
    name, rm_type_name: g.rm_type_name, rm_group_name: g.rm_group_name,
    rmm_line_name: [...g.line_set].sort().join(', '),
    doc_no:        [...g.doc_set].sort().join(', '),
    total: g.rows.length,
    rows: g.rows, // ← เก็บ raw rows ไว้สำหรับ expand
    prep_to_cold: g.prep_to_cold, cold_to_pack: g.cold_to_pack,
    cold: g.cold, prep_to_pack: g.prep_to_pack,
    dbs1: getPercentileValue(g.rows, 'DBS1', percentile),
    dbs2: getPercentileValue(g.rows, 'DBS2', percentile),
    dbs3: getPercentileValue(g.rows, 'DBS3', percentile),
    dbs4: getPercentileValue(g.rows, 'DBS4', percentile),
    dbs1_count: g.rows.filter(r => r.DBS1 != null).length,
    dbs2_count: g.rows.filter(r => r.DBS2 != null).length,
    dbs3_count: g.rows.filter(r => r.DBS3 != null).length,
    dbs4_count: g.rows.filter(r => r.DBS4 != null).length,
  }));
}

function fmtHr(h) {
  if (h == null) return null;
  const abs = Math.abs(h);
  const hh = Math.floor(abs), mm = Math.round((abs - hh) * 60);
  const sign = h < 0 ? '-' : '';
  if (hh === 0) return `${sign}${mm}m`;
  if (mm === 0) return `${sign}${hh}h`;
  return `${sign}${hh}h ${mm}m`;
}

function fmtDatetime(val) {
  if (!val) return '-';
  const d = new Date(val);
  if (isNaN(d)) return '-';
  const date = d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

// ── SearchDropdown ────────────────────────────────────────────────────────────
const SearchDropdown = ({ value, onChange, options, placeholder = 'ทั้งหมด', label }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const filtered = options.filter(o => o.toLowerCase().includes(query.toLowerCase()));
  const isActive = !!value;
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {label && <div style={labelStyle}>{label}</div>}
      <button onClick={() => { setOpen(o => !o); setQuery(''); }} style={{
        ...inputStyle, cursor: 'pointer', minWidth: 160,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        borderColor: isActive ? '#3B82F6' : '#D1D5DB',
        background: isActive ? '#EFF6FF' : '#fff',
        color: isActive ? '#1D4ED8' : '#6B7280',
        fontWeight: isActive ? 600 : 400,
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
          {value || placeholder}
        </span>
        <span style={{ fontSize: 10, opacity: 0.6, flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 100,
          background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 220, maxWidth: 300,
        }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #F3F4F6' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: 8, fontSize: 12, color: '#9CA3AF', pointerEvents: 'none' }}>🔍</span>
              <input autoFocus type="text" value={query} onChange={e => setQuery(e.target.value)}
                placeholder="ค้นหา..." style={{ ...inputStyle, paddingLeft: 26, width: '100%', fontSize: 12, height: 30 }} />
              {query && <button onClick={() => setQuery('')} style={{ position: 'absolute', right: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#9CA3AF', padding: 0 }}>✕</button>}
            </div>
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            <div onClick={() => { onChange(''); setOpen(false); setQuery(''); }}
              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, background: !value ? '#EFF6FF' : 'transparent', color: !value ? '#1D4ED8' : '#374151', fontWeight: !value ? 600 : 400, display: 'flex', alignItems: 'center', gap: 6 }}
              onMouseEnter={e => { if (value) e.currentTarget.style.background = '#F9FAFB'; }}
              onMouseLeave={e => { if (value) e.currentTarget.style.background = 'transparent'; }}>
              <span style={{ fontSize: 11, opacity: 0.5 }}>✕</span> ทั้งหมด
            </div>
            {filtered.length === 0
              ? <div style={{ padding: '10px 12px', fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>ไม่พบ "{query}"</div>
              : filtered.map(o => (
                <div key={o} onClick={() => { onChange(o); setOpen(false); setQuery(''); }}
                  style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, background: value === o ? '#EFF6FF' : 'transparent', color: value === o ? '#1D4ED8' : '#374151', fontWeight: value === o ? 600 : 400 }}
                  onMouseEnter={e => { if (value !== o) e.currentTarget.style.background = '#F9FAFB'; }}
                  onMouseLeave={e => { if (value !== o) e.currentTarget.style.background = 'transparent'; }}>
                  {highlightMatch(o, query)}
                </div>
              ))}
          </div>
          <div style={{ padding: '6px 12px', borderTop: '1px solid #F3F4F6', fontSize: 11, color: '#9CA3AF' }}>
            {filtered.length} รายการ{query ? ` (ค้นหา "${query}")` : ''}
          </div>
        </div>
      )}
    </div>
  );
};

// ── PercentileCell ────────────────────────────────────────────────────────────
const PercentileCell = ({ value, standard, count, percentile }) => {
  const [hovered, setHovered] = useState(false);
  if (value === null || value === undefined)
    return <td style={cellStyle}><span style={{ color: '#9CA3AF', fontSize: 12 }}>N/A</span></td>;
  const isDelay = standard != null && value > standard;
  const diff = standard != null ? value - standard : null;
  const color = isDelay ? '#B91C1C' : '#15803D';
  const badgeBg = isDelay ? '#FEE2E2' : '#DCFCE7';
  const badgeText = isDelay ? '#991B1B' : '#166534';
  return (
    <td style={cellStyle}>
      <div style={{ position: 'relative', display: 'inline-block' }}
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start', cursor: 'default' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums' }}>{fmtHr(value)}</span>
          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: badgeBg, color: badgeText, whiteSpace: 'nowrap' }}>
            {isDelay ? '⚠ delay' : '✓ ปกติ'}
          </span>
          {diff !== null && (
            <span style={{ fontSize: 10, color: isDelay ? '#EF4444' : '#9CA3AF', whiteSpace: 'nowrap' }}>
              {diff > 0 ? '+' : ''}{fmtHr(diff)} จาก {fmtHr(standard)}
            </span>
          )}
        </div>
        {hovered && (
          <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)', background: '#1F2937', color: '#fff', borderRadius: 8, padding: '10px 14px', fontSize: 12, whiteSpace: 'nowrap', zIndex: 50, boxShadow: '0 4px 16px rgba(0,0,0,0.25)', pointerEvents: 'none' }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>P{percentile} Percentile</div>
            <div>ค่า P{percentile}: <strong style={{ color: '#93C5FD' }}>{fmtHr(value)}</strong></div>
            {standard != null && <div>มาตรฐาน: <strong style={{ color: '#6EE7B7' }}>{fmtHr(standard)}</strong></div>}
            {diff !== null && <div>ต่าง: <strong style={{ color: isDelay ? '#FCA5A5' : '#6EE7B7' }}>{diff > 0 ? '+' : ''}{fmtHr(diff)}</strong></div>}
            <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px solid #374151', color: '#9CA3AF' }}>จาก {count} batch</div>
            <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #1F2937' }} />
          </div>
        )}
      </div>
    </td>
  );
};

// ── BatchDetailRows — แถวย่อยแสดง batch แต่ละอัน ─────────────────────────────
const DBS_META = [
  { key: 'DBS1', label: 'DBS1', statusKey: 'dbs1_status', standard: 'prep_to_cold' },
  { key: 'DBS2', label: 'DBS2', statusKey: 'dbs2_status', standard: 'cold' },
  { key: 'DBS3', label: 'DBS3', statusKey: 'dbs3_status', standard: 'cold_to_pack' },
  { key: 'DBS4', label: 'DBS4', statusKey: 'dbs4_status', standard: 'prep_to_pack' },
];

const TimeTag = ({ label, value, highlight }) => (
  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 90 }}>
    <span style={{ fontSize: 9, color: '#9CA3AF', marginBottom: 1, whiteSpace: 'nowrap' }}>{label}</span>
    <span style={{
      fontSize: 11, fontWeight: highlight ? 600 : 400,
      color: highlight ? '#1D4ED8' : '#374151',
      background: highlight ? '#EFF6FF' : 'transparent',
      borderRadius: 4, padding: highlight ? '1px 5px' : 0,
      whiteSpace: 'nowrap',
    }}>{fmtDatetime(value)}</span>
  </div>
);

const DbsBadge = ({ value, standard, label }) => {
  if (value == null) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 64 }}>
      <span style={{ fontSize: 9, color: '#9CA3AF' }}>{label}</span>
      <span style={{ fontSize: 11, color: '#D1D5DB' }}>N/A</span>
    </div>
  );
  const isDelay = standard != null && value > standard;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 64 }}>
      <span style={{ fontSize: 9, color: '#9CA3AF', marginBottom: 2 }}>{label}</span>
      <span style={{
        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap',
        background: isDelay ? '#FEE2E2' : '#DCFCE7',
        color: isDelay ? '#991B1B' : '#166534',
      }}>
        {isDelay ? '⚠ ' : '✓ '}{fmtHr(value)}
      </span>
      {standard != null && (
        <span style={{ fontSize: 9, color: isDelay ? '#EF4444' : '#9CA3AF', marginTop: 1 }}>
          {isDelay ? `+${fmtHr(value - standard)}` : `≤ ${fmtHr(standard)}`}
        </span>
      )}
    </div>
  );
};

const BatchDetailRows = ({ rows, colSpan }) => {
  const sorted = [...rows].sort((a, b) => new Date(a.sc_pack_date) - new Date(b.sc_pack_date));

  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: 0, background: '#F8FAFF', borderBottom: '2px solid #DBEAFE' }}>
        <div style={{ padding: '12px 20px 16px 48px' }}>

          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1D4ED8' }}>📦 {rows.length} batch</span>
          </div>

          {/* ── batch table ── */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
              <thead>
                <tr style={{ background: '#EFF6FF' }}>
                  {[
                    { label: '#',               sub: null },
                    { label: 'เลขเอกสาร',       sub: null },
                    { label: 'ไลน์',            sub: null },
                    { label: 'สถานะ',           sub: null },
                    { label: 'เวลาเตรียมเสร็จ', sub: 'rmit_date_fac' },
                    { label: 'เข้าห้องเย็น',    sub: 'come_cold_date' },
                    { label: 'ออกห้องเย็น',     sub: 'out_cold_date' },
                    { label: 'เข้าห้องเย็น 2',  sub: 'come_cold_date_two' },
                    { label: 'ออกห้องเย็น 2',   sub: 'out_cold_date_two' },
                    { label: 'เข้าห้องเย็น 3',  sub: 'come_cold_date_three' },
                    { label: 'ออกห้องเย็น 3',   sub: 'out_cold_date_three' },
                    { label: 'บรรจุเสร็จ',      sub: 'sc_pack_date' },
                    { label: 'DBS1',            sub: 'เตรียม→เย็น' },
                    { label: 'DBS2',            sub: 'เวลาในเย็น' },
                    { label: 'DBS3',            sub: 'ออกเย็น→บรรจุ' },
                    { label: 'DBS4',            sub: 'เตรียม→บรรจุ' },
                  ].map((col, ci) => (
                    <th key={ci} style={{
                      padding: '7px 12px', textAlign: 'left', whiteSpace: 'nowrap',
                      fontSize: 11, fontWeight: 600, color: '#374151',
                      borderBottom: '1px solid #BFDBFE',
                    }}>
                      {col.label}
                      {col.sub && <div style={{ fontSize: 9, fontWeight: 400, color: '#93C5FD', marginTop: 1 }}>{col.sub}</div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((row, i) => {
                  const isDelayAny =
                    row.dbs1_status === 'delay' ||
                    row.dbs2_status === 'delay' ||
                    row.dbs3_status === 'delay' ||
                    row.dbs4_status === 'delay';

                  const rowBg = i % 2 === 0 ? '#fff' : '#F8FAFF';

                  return (
                    <tr key={row.mapping_id || i} style={{ background: rowBg, borderLeft: `3px solid ${isDelayAny ? '#EF4444' : '#22C55E'}` }}>

                      {/* # */}
                      <td style={dtCell}>{i + 1}</td>

                      {/* เลขเอกสาร */}
                      <td style={dtCell}>
                        {row.doc_no
                          ? <span style={{ fontSize: 11, background: '#F3F4F6', color: '#374151', padding: '2px 7px', borderRadius: 20 }}>{row.doc_no}</span>
                          : <span style={{ color: '#D1D5DB' }}>-</span>}
                      </td>

                      {/* ไลน์ */}
                      <td style={dtCell}>
                        {row.rmm_line_name
                          ? <span style={{ fontSize: 11, background: '#EFF6FF', color: '#1D4ED8', padding: '2px 7px', borderRadius: 20 }}>{row.rmm_line_name}</span>
                          : <span style={{ color: '#D1D5DB' }}>-</span>}
                      </td>

                      {/* สถานะ */}
                      <td style={dtCell}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap',
                          background: isDelayAny ? '#FEE2E2' : '#DCFCE7',
                          color: isDelayAny ? '#991B1B' : '#166534',
                        }}>
                          {isDelayAny ? '⚠ delay' : '✓ ปกติ'}
                        </span>
                      </td>

                      {/* timestamps */}
                      <td style={dtCell}><DateCell val={row.rmit_date_fac} /></td>
                      <td style={dtCell}><DateCell val={row.come_cold_date} /></td>
                      <td style={dtCell}><DateCell val={row.out_cold_date} /></td>
                      <td style={dtCell}><DateCell val={row.come_cold_date_two} dim /></td>
                      <td style={dtCell}><DateCell val={row.out_cold_date_two} dim /></td>
                      <td style={dtCell}><DateCell val={row.come_cold_date_three} dim /></td>
                      <td style={dtCell}><DateCell val={row.out_cold_date_three} dim /></td>
                      <td style={dtCell}><DateCell val={row.sc_pack_date} /></td>

                      {/* DBS */}
                      <td style={dtCell}><DbsCell value={row.DBS1} standard={row.prep_to_cold} isDelay={row.dbs1_status === 'delay'} /></td>
                      <td style={dtCell}><DbsCell value={row.DBS2} standard={row.cold}         isDelay={row.dbs2_status === 'delay'} /></td>
                      <td style={dtCell}><DbsCell value={row.DBS3} standard={row.cold_to_pack} isDelay={row.dbs3_status === 'delay'} /></td>
                      <td style={dtCell}><DbsCell value={row.DBS4} standard={row.prep_to_pack} isDelay={row.dbs4_status === 'delay'} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </td>
    </tr>
  );
};

// ── DateCell ──────────────────────────────────────────────────────────────────
const DateCell = ({ val, dim }) => {
  if (!val) return <span style={{ color: '#E5E7EB', fontSize: 11 }}>—</span>;
  const d = new Date(val);
  if (isNaN(d)) return <span style={{ color: '#D1D5DB' }}>-</span>;
  const date = d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  return (
    <div style={{ opacity: dim ? 0.5 : 1 }}>
      <div style={{ fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap' }}>{date}</div>
      <div style={{ fontSize: 12, fontWeight: 500, color: '#111827', whiteSpace: 'nowrap' }}>{time}</div>
    </div>
  );
};

// ── DbsCell ───────────────────────────────────────────────────────────────────
const DbsCell = ({ value, standard, isDelay }) => {
  if (value == null) return <span style={{ color: '#D1D5DB', fontSize: 11 }}>N/A</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{
        fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap', display: 'inline-block',
        background: isDelay ? '#FEE2E2' : '#DCFCE7',
        color: isDelay ? '#991B1B' : '#166534',
      }}>
        {isDelay ? '⚠ ' : '✓ '}{fmtHr(value)}
      </span>
      {standard != null && (
        <span style={{ fontSize: 10, color: isDelay ? '#EF4444' : '#9CA3AF', paddingLeft: 2, whiteSpace: 'nowrap' }}>
          {isDelay ? `+${fmtHr(value - standard)}` : `≤ ${fmtHr(standard)}`}
        </span>
      )}
    </div>
  );
};

const dtCell = {
  padding: '8px 12px',
  borderBottom: '0.5px solid #EFF6FF',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
};

const MultiValueCell = ({ value, searchTerm }) => {
  if (!value) return <td style={cellStyle}><span style={{ color: '#9CA3AF' }}>-</span></td>;
  return (
    <td style={cellStyle}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {value.split(', ').map((v, i) => {
          const isMatch = searchTerm && v.toLowerCase().includes(searchTerm.toLowerCase());
          return (
            <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap', background: isMatch ? '#FDE68A' : '#F3F4F6', color: isMatch ? '#92400E' : '#374151', fontWeight: isMatch ? 600 : 400 }}>{v}</span>
          );
        })}
      </div>
    </td>
  );
};

const SortIcon = ({ field, sortField, sortDir }) => {
  if (sortField !== field) return <span style={{ opacity: 0.3, marginLeft: 4, fontSize: 10 }}>↕</span>;
  return <span style={{ marginLeft: 4, fontSize: 10, color: '#3B82F6' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
};

const cellStyle = { padding: '10px 14px', borderBottom: '0.5px solid #F3F4F6', verticalAlign: 'middle' };
const thStyle = { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280', borderBottom: '1px solid #E5E7EB', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', background: '#F9FAFB' };
const P_OPTIONS = Array.from({ length: 99 }, (_, i) => i + 1);

const ProductionLineDelayDashboard = () => {
  const [rawData, setRawData]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [startDate, setStartDate]     = useState('');
  const [endDate, setEndDate]         = useState('');
  const [groupBy, setGroupBy]         = useState('mat_name');
  const [sortField, setSortField]     = useState('name');
  const [sortDir, setSortDir]         = useState('asc');
  const [searchTerm, setSearchTerm]   = useState('');
  const [filterLine, setFilterLine]   = useState('');
  const [filterDoc, setFilterDoc]     = useState('');
  const [percentile, setPercentile]   = useState(80);
  const [expandedRows, setExpandedRows] = useState(new Set()); // ← ใหม่

  const fetchData = useCallback(async (sd = startDate, ed = endDate) => {
    try {
      setLoading(true); setError(null);
      const params = new URLSearchParams();
      if (sd) params.append('start_date', sd);
      if (ed) params.append('end_date', ed);
      const res = await fetch(`${API_URL}/api/report/rm-delay/%tie/line?${params}`, {
        headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      });
      if (!res.ok) throw new Error('โหลดข้อมูลล้มเหลว');
      const json = await res.json();
      setRawData(json.success && json.data ? json.data : []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [startDate, endDate]);

  useEffect(() => { fetchData(); }, []);

  const uniqueLines = React.useMemo(() => [...new Set(rawData.map(r => r.rmm_line_name).filter(Boolean))].sort(), [rawData]);
  const uniqueDocs  = React.useMemo(() => [...new Set(rawData.map(r => r.doc_no).filter(Boolean))].sort(), [rawData]);

  const filteredRaw = React.useMemo(() =>
    rawData.filter(r => {
      if (filterLine && r.rmm_line_name !== filterLine) return false;
      if (filterDoc  && r.doc_no        !== filterDoc)  return false;
      return true;
    }), [rawData, filterLine, filterDoc]);

  const rows = React.useMemo(() => {
    const grouped = buildGroupedRows(filteredRaw, groupBy, percentile);
    const q = searchTerm.trim().toLowerCase();
    const filtered = q
      ? grouped.filter(r =>
          r.name?.toLowerCase().includes(q) ||
          r.rm_type_name?.toLowerCase().includes(q) ||
          r.rm_group_name?.toLowerCase().includes(q) ||
          r.rmm_line_name?.toLowerCase().includes(q) ||
          r.doc_no?.toLowerCase().includes(q))
      : grouped;
    return [...filtered].sort((a, b) => {
      let av = a[sortField], bv = b[sortField];
      if (av == null && bv == null) return 0;
      if (av == null) return 1; if (bv == null) return -1;
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv, 'th') : bv.localeCompare(av, 'th');
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [filteredRaw, groupBy, percentile, sortField, sortDir, searchTerm]);

  const metrics = React.useMemo(() => {
    const total = filteredRaw.length, groups = rows.length;
    const delayCount = rows.filter(r =>
      (r.dbs1 != null && r.prep_to_cold != null && r.dbs1 > r.prep_to_cold) ||
      (r.dbs2 != null && r.cold         != null && r.dbs2 > r.cold)         ||
      (r.dbs3 != null && r.cold_to_pack != null && r.dbs3 > r.cold_to_pack) ||
      (r.dbs4 != null && r.prep_to_pack != null && r.dbs4 > r.prep_to_pack)
    ).length;
    return { total, groups, delayCount };
  }, [rows, filteredRaw]);

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir(['name', 'rmm_line_name', 'doc_no'].includes(field) ? 'asc' : 'desc'); }
  };

  const toggleExpand = (name) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const handleReset = () => {
    setStartDate(''); setEndDate('');
    setGroupBy('mat_name'); setSortField('name'); setSortDir('asc');
    setSearchTerm(''); setFilterLine(''); setFilterDoc('');
    setPercentile(80); setExpandedRows(new Set());
    fetchData('', '');
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
      <div style={{ width: 36, height: 36, border: '3px solid #E5E7EB', borderTop: '3px solid #3B82F6', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if (error) return (
    <div style={{ padding: '1rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#B91C1C', fontSize: 14 }}>
      เกิดข้อผิดพลาด: {error}
    </div>
  );

  const searchPlaceholder =
    groupBy === 'mat_name'      ? 'ค้นหา RM name...'   :
    groupBy === 'rm_type_name'  ? 'ค้นหา RM type...'   :
    groupBy === 'rmm_line_name' ? 'ค้นหา ไลน์...'      :
    groupBy === 'doc_no'        ? 'ค้นหา เลขเอกสาร...' : 'ค้นหา RM group...';

  const columns = [
    { key: 'expand',        label: '',          sub: null,            minW: 40  },
    { key: 'name',          label: 'ชื่อ',      sub: null,            minW: 160 },
    { key: 'rm_type_name',  label: 'RM Type',   sub: null,            minW: 100 },
    { key: 'rm_group_name', label: 'RM Group',  sub: null,            minW: 100 },
    { key: 'rmm_line_name', label: 'ไลน์',      sub: null,            minW: 120 },
    { key: 'doc_no',        label: 'เลขเอกสาร', sub: null,            minW: 130 },
    { key: 'total',         label: 'Batch',     sub: null,            minW: 60  },
    { key: 'dbs1', label: 'DBS1', sub: 'เตรียม→เย็น',   minW: 130 },
    { key: 'dbs2', label: 'DBS2', sub: 'เวลาในเย็น',    minW: 130 },
    { key: 'dbs3', label: 'DBS3', sub: 'ออกเย็น→บรรจุ', minW: 130 },
    { key: 'dbs4', label: 'DBS4', sub: 'เตรียม→บรรจุ',  minW: 130 },
  ];

  const activeFilters = filterLine || filterDoc;

  return (
    <div style={{ padding: '1rem 0', fontFamily: 'inherit' }}>

      {/* ── filter bar ── */}
      <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12 }}>ตัวกรองข้อมูล</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <div>
            <div style={labelStyle}>จัดกลุ่มตาม</div>
            <select value={groupBy} onChange={e => { setGroupBy(e.target.value); setSearchTerm(''); setExpandedRows(new Set()); }} style={inputStyle}>
              <option value="mat_name">Mat Name</option>
              <option value="rm_type_name">RM Type</option>
              <option value="rm_group_name">RM Group</option>
              <option value="rmm_line_name">ไลน์</option>
              <option value="doc_no">เลขเอกสาร</option>
            </select>
          </div>
          <SearchDropdown label="ไลน์" value={filterLine} onChange={setFilterLine} options={uniqueLines} placeholder="ทั้งหมด" />
          <SearchDropdown label="เลขเอกสาร" value={filterDoc} onChange={setFilterDoc} options={uniqueDocs} placeholder="ทั้งหมด" />
          <div>
            <div style={labelStyle}>Percentile (P)</div>
            <select value={percentile} onChange={e => setPercentile(Number(e.target.value))}
              style={{ ...inputStyle, borderColor: '#3B82F6', color: '#1D4ED8', fontWeight: 600, minWidth: 90 }}>
              {P_OPTIONS.map(p => <option key={p} value={p}>P{p}</option>)}
            </select>
          </div>
          <div>
            <div style={labelStyle}>ค้นหา</div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: 9, fontSize: 13, color: '#9CA3AF', pointerEvents: 'none' }}>🔍</span>
              <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder={searchPlaceholder}
                style={{ ...inputStyle, paddingLeft: 28, minWidth: 180 }} />
              {searchTerm && <button onClick={() => setSearchTerm('')} style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#9CA3AF', padding: 0 }}>✕</button>}
            </div>
          </div>
          <div>
            <div style={labelStyle}>เรียงตาม</div>
            <select value={sortField} onChange={e => { const f = e.target.value; setSortField(f); setSortDir(['name', 'rmm_line_name', 'doc_no'].includes(f) ? 'asc' : 'desc'); }} style={inputStyle}>
              <option value="name">ชื่อ</option>
              <option value="rmm_line_name">ไลน์</option>
              <option value="doc_no">เลขเอกสาร</option>
              <option value="dbs1">DBS1</option>
              <option value="dbs2">DBS2</option>
              <option value="dbs3">DBS3</option>
              <option value="dbs4">DBS4</option>
              <option value="total">จำนวน batch</option>
            </select>
          </div>
          <div>
            <div style={labelStyle}>ทิศทาง</div>
            <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
              style={{ ...inputStyle, cursor: 'pointer', minWidth: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {sortDir === 'asc' ? <><span>↑</span><span>น้อย→มาก</span></> : <><span>↓</span><span>มาก→น้อย</span></>}
            </button>
          </div>
          <div>
            <div style={labelStyle}>วันเริ่มต้น</div>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>วันสิ้นสุด</div>
            <input type="date" value={endDate} min={startDate || undefined} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
          </div>
          <button onClick={() => fetchData()} style={btnPrimary}>ยืนยัน</button>
          <button onClick={handleReset} style={btnSecondary}>รีเซ็ต</button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {(startDate || endDate) && (
            <div style={{ fontSize: 12, color: '#1D4ED8', background: '#EFF6FF', padding: '4px 10px', borderRadius: 6 }}>
              📅 {startDate ? `ตั้งแต่ ${startDate}` : ''}{endDate ? ` ถึง ${endDate}` : ''}
            </div>
          )}
          {filterLine && (
            <div style={{ fontSize: 12, color: '#1D4ED8', background: '#EFF6FF', padding: '4px 10px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              📍 ไลน์: <strong>{filterLine}</strong>
              <button onClick={() => setFilterLine('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#1D4ED8', padding: 0 }}>✕</button>
            </div>
          )}
          {filterDoc && (
            <div style={{ fontSize: 12, color: '#1D4ED8', background: '#EFF6FF', padding: '4px 10px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              📄 เอกสาร: <strong>{filterDoc}</strong>
              <button onClick={() => setFilterDoc('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#1D4ED8', padding: 0 }}>✕</button>
            </div>
          )}
          {searchTerm && (
            <div style={{ fontSize: 12, color: '#6D28D9', background: '#EDE9FE', padding: '4px 10px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              🔍 <strong>{searchTerm}</strong>
              <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#6D28D9', padding: 0 }}>✕</button>
            </div>
          )}
          <div style={{ fontSize: 12, color: '#6D28D9', background: '#EDE9FE', padding: '4px 10px', borderRadius: 6 }}>📊 P{percentile}</div>
          {activeFilters && (
            <div style={{ fontSize: 12, color: '#6B7280', background: '#F9FAFB', padding: '4px 10px', borderRadius: 6, border: '0.5px solid #E5E7EB' }}>
              คำนวณจาก <strong>{filteredRaw.length}</strong> batch (จาก {rawData.length})
            </div>
          )}
        </div>
      </div>

      {/* ── metric cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'batch ทั้งหมด',                     value: metrics.total,                       sub: `${metrics.groups} กลุ่ม`,     color: '#3B82F6' },
          { label: `กลุ่มที่ P${percentile} > มาตรฐาน`, value: metrics.delayCount,                  sub: `จาก ${metrics.groups} กลุ่ม`, color: '#EF4444' },
          { label: 'กลุ่มที่ปกติ',                       value: metrics.groups - metrics.delayCount, sub: 'ทุก DBS ≤ มาตรฐาน',           color: '#22C55E' },
        ].map((m, i) => (
          <div key={i} style={{ background: '#F9FAFB', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: m.color }}>{m.value}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* ── legend ── */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 12, fontSize: 11, color: '#6B7280', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, color: '#374151' }}>P{percentile}:</span>
        {[{ dot: '#22C55E', label: 'ปกติ (≤ มาตรฐาน)' }, { dot: '#EF4444', label: 'delay (> มาตรฐาน)' }].map((l, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.dot }} />
            <span>{l.label}</span>
          </div>
        ))}
        <span style={{ fontSize: 11, color: '#9CA3AF' }}>▶ คลิกแถวเพื่อดู batch detail</span>
        <span style={{ marginLeft: 'auto', color: '#9CA3AF' }}>
          {rows.length} กลุ่ม · {filteredRaw.length} batch{activeFilters ? ' (กรองแล้ว)' : ''}
        </span>
      </div>

      {/* ── table ── */}
      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9CA3AF', fontSize: 13, border: '0.5px solid #F3F4F6', borderRadius: 12 }}>
          {searchTerm ? `ไม่พบผลลัพธ์สำหรับ "${searchTerm}"` : 'ไม่มีข้อมูล'}
        </div>
      ) : (
        <div style={{ border: '0.5px solid #E5E7EB', borderRadius: 12, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {columns.map(col => (
                  <th key={col.key}
                    onClick={() => col.key !== 'expand' && handleSort(col.key)}
                    style={{ ...thStyle, minWidth: col.minW, cursor: col.key === 'expand' ? 'default' : 'pointer' }}>
                    <span>{col.label}</span>
                    {col.sub && <div style={{ fontSize: 10, fontWeight: 400, color: '#9CA3AF' }}>{col.sub}</div>}
                    {col.key !== 'expand' && <SortIcon field={col.key} sortField={sortField} sortDir={sortDir} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const isExpanded = expandedRows.has(r.name);
                const hasDelay =
                  (r.dbs1 != null && r.prep_to_cold != null && r.dbs1 > r.prep_to_cold) ||
                  (r.dbs2 != null && r.cold         != null && r.dbs2 > r.cold)         ||
                  (r.dbs3 != null && r.cold_to_pack != null && r.dbs3 > r.cold_to_pack) ||
                  (r.dbs4 != null && r.prep_to_pack != null && r.dbs4 > r.prep_to_pack);

                return (
                  <React.Fragment key={r.name}>
                    <tr
                      style={{ background: isExpanded ? '#EFF6FF' : (i % 2 === 0 ? '#fff' : '#FAFAFA'), cursor: 'pointer' }}
                      onClick={() => toggleExpand(r.name)}
                      onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = '#F0F9FF'; }}
                      onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#FAFAFA'; }}>

                      {/* expand toggle */}
                      <td style={{ ...cellStyle, textAlign: 'center', width: 40 }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 22, height: 22, borderRadius: 6,
                          background: isExpanded ? '#DBEAFE' : '#F3F4F6',
                          color: isExpanded ? '#1D4ED8' : '#6B7280',
                          fontSize: 11, fontWeight: 700, transition: 'all 0.15s',
                        }}>
                          {isExpanded ? '▼' : '▶'}
                        </span>
                      </td>

                      <td style={{ ...cellStyle, fontWeight: 500 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {hasDelay && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444', flexShrink: 0, display: 'inline-block' }} />}
                          {searchTerm && r.name?.toLowerCase().includes(searchTerm.toLowerCase()) ? highlightMatch(r.name, searchTerm) : r.name}
                        </div>
                      </td>
                      <td style={{ ...cellStyle, color: '#6B7280' }}>{r.rm_type_name || '-'}</td>
                      <td style={{ ...cellStyle, color: '#6B7280' }}>{r.rm_group_name || '-'}</td>
                      <MultiValueCell value={r.rmm_line_name} searchTerm={searchTerm} />
                      <MultiValueCell value={r.doc_no} searchTerm={searchTerm} />
                      <td style={{ ...cellStyle, color: '#6B7280' }}>{r.total}</td>
                      <PercentileCell value={r.dbs1} standard={r.prep_to_cold} count={r.dbs1_count} percentile={percentile} />
                      <PercentileCell value={r.dbs2} standard={r.cold}         count={r.dbs2_count} percentile={percentile} />
                      <PercentileCell value={r.dbs3} standard={r.cold_to_pack} count={r.dbs3_count} percentile={percentile} />
                      <PercentileCell value={r.dbs4} standard={r.prep_to_pack} count={r.dbs4_count} percentile={percentile} />
                    </tr>

                    {/* ── expanded detail ── */}
                    {isExpanded && (
                      <BatchDetailRows
                        rows={r.rows}
                        colSpan={columns.length}
                        groupRow={r}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

function highlightMatch(text, query) {
  if (!text || !query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return <>{text.slice(0, idx)}<mark style={{ background: '#FDE68A', color: '#92400E', borderRadius: 2, padding: '0 2px' }}>{text.slice(idx, idx + query.length)}</mark>{text.slice(idx + query.length)}</>;
}

const labelStyle = { fontSize: 11, color: '#6B7280', marginBottom: 4 };
const inputStyle = { fontSize: 13, padding: '6px 10px', height: 34, border: '0.5px solid #D1D5DB', borderRadius: 8, background: '#fff', color: '#111827', outline: 'none' };
const btnPrimary   = { fontSize: 13, padding: '0 16px', height: 34, border: 'none', borderRadius: 8, cursor: 'pointer', background: '#3B82F6', color: '#fff', fontWeight: 500 };
const btnSecondary = { fontSize: 13, padding: '0 16px', height: 34, border: '0.5px solid #D1D5DB', borderRadius: 8, cursor: 'pointer', background: '#fff', color: '#374151' };

export default ProductionLineDelayDashboard;