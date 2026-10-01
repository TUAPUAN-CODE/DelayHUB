import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { C, labelStyle } from './tracebackUI';

/**
 * SearchableSelect
 * dropdown ที่ดึงค่าจริงจากระบบมาให้เลือก + มีช่องค้นหาอยู่ในตัว dropdown
 *
 * props
 *  - label         ป้ายกำกับด้านบน (ไม่ใส่ก็ได้)
 *  - value         ค่าปัจจุบัน (string)
 *  - onChange(v)   callback
 *  - options       [{ value, label, meta }] หรือ ['A','B'] ก็ได้
 *  - placeholder   ข้อความเมื่อยังไม่เลือก
 *  - loading       แสดงสถานะกำลังโหลดรายการ
 *  - allowFree     อนุญาตให้พิมพ์ค่าที่ไม่มีในรายการแล้วกดใช้ (default true)
 *  - emptyText     ข้อความเมื่อค้นหาไม่เจอ
 */
export default function SearchableSelect({
  label,
  value = '',
  onChange,
  options = [],
  placeholder = 'ทั้งหมด',
  loading = false,
  allowFree = true,
  emptyText = 'ไม่พบรายการที่ตรงกับคำค้น',
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const norm = useMemo(
    () =>
      (options || []).map(o =>
        typeof o === 'string' || typeof o === 'number'
          ? { value: String(o), label: String(o), meta: '' }
          : { value: String(o.value ?? ''), label: String(o.label ?? o.value ?? ''), meta: o.meta ?? '' }
      ),
    [options]
  );

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return norm.slice(0, 300);
    return norm
      .filter(o => o.label.toLowerCase().includes(k) || o.value.toLowerCase().includes(k) || String(o.meta).toLowerCase().includes(k))
      .slice(0, 300);
  }, [norm, q]);

  const current = useMemo(() => norm.find(o => o.value === value), [norm, value]);

  const close = useCallback(() => { setOpen(false); setQ(''); setCursor(0); }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) close(); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, close]);

  useEffect(() => { if (open && inputRef.current) inputRef.current.focus(); }, [open]);

  const pick = v => { onChange?.(v); close(); };

  const onKeyDown = e => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[cursor]) pick(filtered[cursor].value);
      else if (allowFree && q.trim()) pick(q.trim());
    }
  };

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${cursor}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const showFreeOption =
    allowFree && q.trim() && !filtered.some(o => o.value.toLowerCase() === q.trim().toLowerCase());

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      {label && <label style={labelStyle}>{label}</label>}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', height: 34, padding: '0 10px', textAlign: 'left',
          border: `0.5px solid ${open ? C.blue : '#D1D5DB'}`,
          boxShadow: open ? `0 0 0 3px rgba(59,130,246,0.12)` : 'none',
          borderRadius: 8, background: disabled ? C.bg : C.white,
          color: value ? C.text : C.faint, fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          fontFamily: 'inherit',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value ? (current?.label || value) : placeholder}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {value && (
            <span
              role="button"
              tabIndex={-1}
              onClick={e => { e.stopPropagation(); onChange?.(''); }}
              style={{ color: C.faint, fontSize: 13, padding: '0 2px' }}
              title="ล้างค่า"
            >✕</span>
          )}
          <span style={{ color: C.faint, fontSize: 10 }}>▾</span>
        </span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', zIndex: 60, top: 'calc(100% + 4px)', left: 0, right: 0,
            background: C.white, border: `0.5px solid ${C.line}`, borderRadius: 10,
            boxShadow: '0 12px 32px rgba(15,23,42,0.14)', overflow: 'hidden', minWidth: 220,
          }}
        >
          <div style={{ padding: 8, borderBottom: `0.5px solid ${C.line2}`, background: C.bg }}>
            <input
              ref={inputRef}
              value={q}
              onChange={e => { setQ(e.target.value); setCursor(0); }}
              onKeyDown={onKeyDown}
              placeholder="พิมพ์เพื่อค้นหา..."
              style={{
                width: '100%', height: 30, fontSize: 12.5, padding: '0 10px', boxSizing: 'border-box',
                border: `0.5px solid ${C.line}`, borderRadius: 7, outline: 'none', background: C.white,
                fontFamily: 'inherit',
              }}
            />
          </div>

          <div ref={listRef} style={{ maxHeight: 260, overflowY: 'auto' }}>
            {loading && (
              <div style={{ padding: '14px 12px', fontSize: 12, color: C.faint }}>กำลังโหลดรายการ...</div>
            )}

            {!loading && filtered.length === 0 && !showFreeOption && (
              <div style={{ padding: '14px 12px', fontSize: 12, color: C.faint }}>{emptyText}</div>
            )}

            {!loading && value && (
              <div
                onClick={() => pick('')}
                style={{ padding: '8px 12px', fontSize: 12.5, color: C.muted, cursor: 'pointer', borderBottom: `0.5px solid ${C.line2}` }}
              >
                ล้างค่าที่เลือก
              </div>
            )}

            {!loading && filtered.map((o, i) => (
              <div
                key={o.value + i}
                data-idx={i}
                onMouseEnter={() => setCursor(i)}
                onClick={() => pick(o.value)}
                style={{
                  padding: '8px 12px', fontSize: 12.5, cursor: 'pointer',
                  background: i === cursor ? C.blueSoft : 'transparent',
                  color: o.value === value ? C.blueDark : C.text,
                  fontWeight: o.value === value ? 600 : 400,
                  display: 'flex', justifyContent: 'space-between', gap: 10,
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
                {o.meta ? <span style={{ color: C.faint, fontSize: 11, flexShrink: 0 }}>{o.meta}</span> : null}
              </div>
            ))}

            {showFreeOption && (
              <div
                onClick={() => pick(q.trim())}
                style={{ padding: '8px 12px', fontSize: 12.5, cursor: 'pointer', color: C.blueDark, borderTop: `0.5px solid ${C.line2}` }}
              >
                ใช้คำค้น “{q.trim()}”
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}