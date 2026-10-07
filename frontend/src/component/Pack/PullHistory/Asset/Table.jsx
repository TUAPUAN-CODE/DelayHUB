import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
axios.defaults.withCredentials = true;

const API_URL = import.meta.env.VITE_API_URL;

// ── Icons ──────────────────────────────────────────────────────────
const IconPDF = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
);

const IconSort = ({ dir }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    {dir === 'asc'  && <polyline points="18 15 12 9 6 15"/>}
    {dir === 'desc' && <polyline points="6 9 12 15 18 9"/>}
    {!dir && (
      <>
        <polyline points="18 15 12 9 6 15" opacity="0.3"/>
        <polyline points="6 9 12 15 18 9" opacity="0.3"/>
      </>
    )}
  </svg>
);

const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

const IconDownload = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const IconEye = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const IconClose = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const IconFilter = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
  </svg>
);

// ── Helpers ────────────────────────────────────────────────────────
const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    const day   = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year  = d.getFullYear() + 543;
    return `${day}/${month}/${year}`;
  } catch { return dateStr; }
};

const ShiftBadge = ({ shift }) => {
  const isDS = shift === 'DS';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700',
      backgroundColor: isDS ? '#FFF8E1' : '#E8EAF6',
      color: isDS ? '#F57F17' : '#283593',
      border: `1px solid ${isDS ? '#FFD54F' : '#7986CB'}`,
    }}>
      {isDS ? '☀️' : '🌙'} {shift || '-'}
    </span>
  );
};

const StatusBadge = ({ status }) => {
  const colors = {
    active:   { bg: '#E8F5E9', color: '#2E7D32', border: '#A5D6A7', label: 'ใช้งาน' },
    archived: { bg: '#F3E5F5', color: '#6A1B9A', border: '#CE93D8', label: 'จัดเก็บ' },
    default:  { bg: '#F5F8FF', color: '#616161', border: '#BDBDBD', label: status || '-' },
  };
  const c = colors[status] || colors.default;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: '20px',
      fontSize: '12px', fontWeight: '600',
      backgroundColor: c.bg, color: c.color, border: `1px solid ${c.border}`,
    }}>{c.label}</span>
  );
};

// ── Main Component ─────────────────────────────────────────────────
const PaperPDFViewer = () => {
  const [papers, setPapers]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [search, setSearch]         = useState('');
  const [sortKey, setSortKey]       = useState('date');
  const [sortDir, setSortDir]       = useState('desc');
  const [filterShift, setFilterShift] = useState('');
  const [filterLine,  setFilterLine]  = useState('');
  const [previewPaper, setPreviewPaper] = useState(null); // for PDF modal
  const [page, setPage]             = useState(0);
  const rowsPerPage = 20;

  // ── Fetch ──────────────────────────────────────────────────────
  const fetchPapers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/api/pack/paper/list`);
      if (res.data?.success) {
        setPapers(res.data.data || []);
      } else {
        setError('ไม่สามารถดึงข้อมูลได้');
      }
    } catch (err) {
      setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPapers(); }, [fetchPapers]);

  // ── Sort & Filter ──────────────────────────────────────────────
  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  };

  const uniqueLines  = [...new Set(papers.map(p => p.line).filter(Boolean))].sort();
  const uniqueShifts = [...new Set(papers.map(p => p.shift).filter(Boolean))].sort();

  const filtered = papers
    .filter(p => {
      const q = search.toLowerCase();
      if (q && ![p.recorded_by, p.reviewed_by, p.qc_manager, p.date, p.line, p.plant, p.shift]
        .some(v => v?.toString().toLowerCase().includes(q))) return false;
      if (filterShift && p.shift !== filterShift) return false;
      if (filterLine  && p.line  !== filterLine)  return false;
      return true;
    })
    .sort((a, b) => {
      let va = a[sortKey] ?? '';
      let vb = b[sortKey] ?? '';
      if (sortKey === 'date') { va = new Date(va); vb = new Date(vb); }
      else { va = String(va).toLowerCase(); vb = String(vb).toLowerCase(); }
      if (va < vb) return sortDir === 'asc' ? -1 :  1;
      if (va > vb) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });

  const paged = filtered.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
  const totalPages = Math.ceil(filtered.length / rowsPerPage);

  // ── Download PDF ───────────────────────────────────────────────
  const handleDownload = (paper) => {
    if (!paper.pdf) return;
    try {
      const byteChars = atob(paper.pdf);
      const byteArr   = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteArr], { type: 'application/pdf' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `F3PFPF67_${paper.date || 'report'}_${paper.shift || ''}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('ไม่สามารถดาวน์โหลด PDF ได้');
    }
  };

  // ── Preview PDF in modal ───────────────────────────────────────
  const getObjectURL = (paper) => {
    if (!paper?.pdf) return null;
    try {
      const byteChars = atob(paper.pdf);
      const byteArr   = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteArr], { type: 'application/pdf' });
      return URL.createObjectURL(blob);
    } catch { return null; }
  };

  // ── Columns config ─────────────────────────────────────────────
  const columns = [
    { key: 'paper_id',    label: '#',            width: '60px',  sortable: true  },
    { key: 'date',        label: 'วันที่',        width: '110px', sortable: true  },
    { key: 'shift',       label: 'Shift',         width: '90px',  sortable: true  },
    { key: 'line',        label: 'Line',          width: '130px', sortable: true  },
    { key: 'plant',       label: 'Plant',         width: '100px', sortable: true  },
    { key: 'recorded_by', label: 'Recorded by',   width: '150px', sortable: true  },
    { key: 'reviewed_by', label: 'Reviewed by',   width: '150px', sortable: true  },
    { key: 'qc_manager',  label: 'QC Manager',    width: '150px', sortable: true  },
    { key: 'paper_status',label: 'Status',        width: '100px', sortable: true  },
    { key: '_actions',    label: 'ดำเนินการ',      width: '120px', sortable: false },
  ];

  // ── Styles ─────────────────────────────────────────────────────
  const styles = {
    wrap: {
      fontFamily: "'Noto Sans Thai', 'Sarabun', sans-serif",
      background: 'linear-gradient(135deg, #F5F8FF 0%, #fafcff 100%)',
      minHeight: '100vh',
      padding: '24px',
    },
    card: {
      background: '#fff',
      borderRadius: '18px',
      boxShadow: '0 4px 24px rgba(33,150,243,0.10)',
      overflow: 'hidden',
    },
    header: {
      background: 'linear-gradient(135deg, #0F3FC4 0%, #1552F0 100%)',
      padding: '20px 28px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '12px',
    },
    headerTitle: {
      color: '#fff',
      fontSize: '20px',
      fontWeight: '700',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    },
    toolbar: {
      padding: '16px 24px',
      borderBottom: '1px solid #EAF0FF',
      display: 'flex',
      gap: '12px',
      flexWrap: 'wrap',
      alignItems: 'center',
      background: '#F5F8FF',
    },
    searchBox: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      background: '#fff',
      border: '1.5px solid #BBDEFB',
      borderRadius: '10px',
      padding: '8px 14px',
      flex: '1',
      minWidth: '200px',
      maxWidth: '340px',
    },
    searchInput: {
      border: 'none',
      outline: 'none',
      fontSize: '14px',
      width: '100%',
      color: '#333',
      background: 'transparent',
    },
    select: {
      padding: '8px 12px',
      borderRadius: '10px',
      border: '1.5px solid #BBDEFB',
      fontSize: '14px',
      color: '#333',
      background: '#fff',
      cursor: 'pointer',
      outline: 'none',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: '14px',
    },
    th: (col) => ({
      backgroundColor: '#1552F0',
      color: '#fff',
      padding: '12px 14px',
      textAlign: 'center',
      fontWeight: '600',
      whiteSpace: 'nowrap',
      width: col.width,
      borderRight: '1px solid rgba(255,255,255,0.15)',
      cursor: col.sortable ? 'pointer' : 'default',
      userSelect: 'none',
      fontSize: '13px',
    }),
    thInner: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '5px',
    },
    tdBase: (even) => ({
      padding: '10px 14px',
      textAlign: 'center',
      borderBottom: '1px solid #EAF0FF',
      borderRight: '1px solid #F0F8FF',
      backgroundColor: even ? '#fff' : '#F0F8FF',
      color: '#353535',
      fontSize: '13px',
      whiteSpace: 'nowrap',
    }),
    actionBtn: (color) => ({
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      padding: '5px 12px',
      borderRadius: '8px',
      border: 'none',
      cursor: 'pointer',
      fontSize: '12px',
      fontWeight: '600',
      color: '#fff',
      background: color,
      transition: 'opacity 0.2s, transform 0.1s',
    }),
    pagination: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 24px',
      borderTop: '1px solid #EAF0FF',
      background: '#F5F8FF',
      fontSize: '13px',
      color: '#546E7A',
      flexWrap: 'wrap',
      gap: '8px',
    },
    pageBtn: (active) => ({
      width: '34px',
      height: '34px',
      borderRadius: '8px',
      border: active ? 'none' : '1px solid #BBDEFB',
      background: active ? '#1552F0' : '#fff',
      color: active ? '#fff' : '#1552F0',
      cursor: 'pointer',
      fontWeight: active ? '700' : '400',
      fontSize: '13px',
    }),
    modalOverlay: {
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.65)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    },
    modalBox: {
      background: '#fff',
      borderRadius: '16px',
      width: '92vw',
      maxWidth: '1100px',
      height: '90vh',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      overflow: 'hidden',
    },
    modalHeader: {
      background: 'linear-gradient(135deg, #0F3FC4 0%, #1552F0 100%)',
      padding: '14px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: 0,
    },
  };

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div style={styles.wrap}>
      <div style={styles.card}>

        {/* ── Header ── */}
        <div style={styles.header}>
          <div style={styles.headerTitle}>
            <IconPDF />
            ประวัติ PDF รายงานควบคุมเวลากระบวนการผลิต
          </div>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '14px' }}>
            ทั้งหมด {filtered.length} รายการ
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div style={styles.toolbar}>
          <div style={styles.searchBox}>
            <IconSearch />
            <input
              style={styles.searchInput}
              placeholder="ค้นหา ผู้บันทึก, Line, วันที่..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#546E7A', fontSize: '13px' }}>
            <IconFilter />
            <span>ตัวกรอง:</span>
          </div>

          <select style={styles.select} value={filterShift} onChange={e => { setFilterShift(e.target.value); setPage(0); }}>
            <option value="">Shift ทั้งหมด</option>
            {uniqueShifts.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select style={styles.select} value={filterLine} onChange={e => { setFilterLine(e.target.value); setPage(0); }}>
            <option value="">Line ทั้งหมด</option>
            {uniqueLines.map(l => <option key={l} value={l}>{l}</option>)}
          </select>

          {(filterShift || filterLine || search) && (
            <button
              onClick={() => { setSearch(''); setFilterShift(''); setFilterLine(''); setPage(0); }}
              style={{ ...styles.actionBtn('#ef5350'), padding: '7px 14px', borderRadius: '10px' }}
            >
              ล้างตัวกรอง
            </button>
          )}
        </div>

        {/* ── Table ── */}
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                {columns.map(col => (
                  <th key={col.key} style={styles.th(col)} onClick={() => col.sortable && handleSort(col.key)}>
                    <div style={styles.thInner}>
                      {col.label}
                      {col.sortable && (
                        <IconSort dir={sortKey === col.key ? sortDir : null} />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.length} style={{ textAlign: 'center', padding: '60px', color: '#90A4AE' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '36px', height: '36px',
                        border: '3px solid #BBDEFB',
                        borderTop: '3px solid #1552F0',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                      }} />
                      <span style={{ fontSize: '15px' }}>กำลังโหลดข้อมูล...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={columns.length} style={{ textAlign: 'center', padding: '60px', color: '#ef5350', fontSize: '15px' }}>
                    ⚠️ {error}
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} style={{ textAlign: 'center', padding: '60px', color: '#90A4AE', fontSize: '15px' }}>
                    ไม่พบข้อมูล
                  </td>
                </tr>
              ) : (
                paged.map((row, idx) => {
                  const even = idx % 2 === 0;
                  const td = (content, opts = {}) => (
                    <td style={{ ...styles.tdBase(even), ...opts }}>{content}</td>
                  );
                  return (
                    <tr key={row.paper_id}
                      onMouseEnter={e => Array.from(e.currentTarget.cells).forEach(c => { c.style.backgroundColor = even ? '#EAF0FF' : '#DCEEFB'; })}
                      onMouseLeave={e => Array.from(e.currentTarget.cells).forEach(c => { c.style.backgroundColor = even ? '#fff' : '#F0F8FF'; })}
                      style={{ transition: 'background 0.15s' }}
                    >
                      {td(<span style={{ color: '#90A4AE', fontSize: '12px' }}>#{row.paper_id}</span>)}
                      {td(
                        <span style={{ fontWeight: '600', color: '#0F3FC4' }}>{formatDate(row.date)}</span>
                      )}
                      {td(<ShiftBadge shift={row.shift} />)}
                      {td(
                        <span style={{
                          display: 'inline-block',
                          background: '#EAF0FF',
                          color: '#0D47A1',
                          borderRadius: '8px',
                          padding: '2px 10px',
                          fontSize: '12px',
                          fontWeight: '600',
                        }}>{row.line || '-'}</span>
                      )}
                      {td(row.plant || '-')}
                      {td(
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'center' }}>
                          <span style={{
                            width: '26px', height: '26px', borderRadius: '50%',
                            background: '#EAF0FF', color: '#0F3FC4',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '11px', fontWeight: '700', flexShrink: 0,
                          }}>
                            {(row.recorded_by || '?')[0]?.toUpperCase()}
                          </span>
                          {row.recorded_by || '-'}
                        </span>
                      )}
                      {td(row.reviewed_by || '-')}
                      {td(row.qc_manager  || '-')}
                      {td(<StatusBadge status={row.paper_status} />)}
                      {td(
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            style={styles.actionBtn('#1552F0')}
                            title="ดู PDF"
                            onClick={() => setPreviewPaper(row)}
                            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                          >
                            <IconEye /> ดู
                          </button>
                          <button
                            style={styles.actionBtn('#43A047')}
                            title="ดาวน์โหลด PDF"
                            onClick={() => handleDownload(row)}
                            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                          >
                            <IconDownload />
                          </button>
                        </div>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        <div style={styles.pagination}>
          <span>
            แสดง {paged.length === 0 ? 0 : page * rowsPerPage + 1}–{Math.min((page + 1) * rowsPerPage, filtered.length)} จาก {filtered.length} รายการ
          </span>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button style={styles.pageBtn(false)} disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹</button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const p = totalPages <= 7 ? i : (page < 4 ? i : page - 3 + i);
              if (p >= totalPages) return null;
              return (
                <button key={p} style={styles.pageBtn(p === page)} onClick={() => setPage(p)}>{p + 1}</button>
              );
            })}
            <button style={styles.pageBtn(false)} disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>›</button>
          </div>
        </div>
      </div>

      {/* ── PDF Preview Modal ── */}
      {previewPaper && (() => {
        const url = getObjectURL(previewPaper);
        return (
          <div style={styles.modalOverlay} onClick={() => setPreviewPaper(null)}>
            <div style={styles.modalBox} onClick={e => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <div style={{ color: '#fff', fontWeight: '700', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <IconPDF />
                  PDF — {formatDate(previewPaper.date)} | {previewPaper.shift} | {previewPaper.line}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    style={{ ...styles.actionBtn('#43A047'), padding: '7px 16px' }}
                    onClick={() => handleDownload(previewPaper)}
                  >
                    <IconDownload /> ดาวน์โหลด
                  </button>
                  <button
                    style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', padding: '7px', cursor: 'pointer', color: '#fff', display: 'flex' }}
                    onClick={() => setPreviewPaper(null)}
                  >
                    <IconClose />
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, overflow: 'hidden' }}>
                {url ? (
                  <iframe
                    src={url}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    title="PDF Preview"
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#90A4AE', fontSize: '16px' }}>
                    ไม่มีไฟล์ PDF
                  </div>
                )}
              </div>

              {/* Info bar */}
              <div style={{
                padding: '10px 20px',
                borderTop: '1px solid #EAF0FF',
                background: '#F5F8FF',
                display: 'flex',
                gap: '24px',
                flexWrap: 'wrap',
                fontSize: '13px',
                color: '#546E7A',
                flexShrink: 0,
              }}>
                {[
                  ['ผู้บันทึก',   previewPaper.recorded_by],
                  ['ผู้ตรวจสอบ', previewPaper.reviewed_by],
                  ['QC Manager', previewPaper.qc_manager],
                  ['Plant',      previewPaper.plant],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', gap: '6px' }}>
                    <span style={{ color: '#90A4AE' }}>{label}:</span>
                    <span style={{ fontWeight: '600', color: '#333' }}>{val || '-'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default PaperPDFViewer;