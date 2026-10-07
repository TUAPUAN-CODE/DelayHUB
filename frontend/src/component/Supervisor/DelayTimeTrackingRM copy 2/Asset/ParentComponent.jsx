import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
axios.defaults.withCredentials = true;

const API_URL = import.meta.env.VITE_API_URL;

// ── Time events ────────────────────────────────────────────────────────────────
// extras: ข้อมูลเพิ่มเติมที่แสดงใน timeline card ของ event นั้น
const TIME_EVENTS = [
  { key: 'cooked_date', label: 'เวลา ต้ม/อบเสร็จ', icon: '🔥', color: '#3f3f3f' },
  { key: 'rmit_date', label: 'เวลาเตรียมเสร็จ', icon: '✂️', color: '#3f3f3f' },
  { key: 'qc_datetime', label: 'เวลา QC ตรวจสอบวัตถุดิบหลังเตรียมเสร็จ', icon: '🔬', color: '#3f3f3f' },
  { key: 'md_time', label: 'เวลาผ่าน MD', icon: '🧲', color: '#3f3f3f' },

  { key: 'come_cold_date', label: 'เวลาเข้าห้องเย็น1 (ครั้งที่ 1)', icon: '❄️', color: '#3f3f3f' },
  { key: 'cs_come_cold_date', label: 'ห้องเย็นใหญ่รับเข้าวัตถุดิบเตรียมเสร็จแล้ว (ครั้งที่ 1)', icon: '🏠', color: '#3f3f3f' },
  { key: 'cs_out_cold_date', label: 'ห้องเย็นใหญ่ส่งออกวัตถุดิบเตรียมเสร็จแล้ว (ครั้งที่ 1)', icon: '📤', color: '#3f3f3f' },
  {
    key: 'out_cold_date', label: 'เวลาออกห้องเย็น1 (ครั้งที่ 1)', icon: '🔼', color: '#3f3f3f',
    extras: [
      { key: 'receiver_out_cold', label: 'ผู้ทำรายการส่งออกวัตถุดิบไปห้องเย็นใหญ่' },
      { key: 'at_pd_storage_purpose', label: 'สาเหตุการฝากวัตถุดิบ' },
      { key: 'at_pd_histamine', label: 'Histamine' },
    ]
  },
  { key: 'withdraw_date', label: 'ห้องเย็นใหญ่ทำรายการส่งออกผ่านบ่อละลายไฟฟ้า (ครั้งที่ 1)', icon: '📦', color: '#3f3f3f' },
  { key: 'start_defrost_date', label: 'เวลาเริ่มละลายวัตถุดิบ (ครั้งที่ 1)', icon: '💧', color: '#3f3f3f' },
  { key: 'end_defrost_date', label: 'เวลาละลายวัตถุดิบเสร็จ (ครั้งที่ 1)', icon: '✅', color: '#3f3f3f' },

  { key: 'come_cold_date_two', label: 'เวลาเข้าห้องเย็น1 (ครั้งที่ 2)', icon: '❄️', color: '#3f3f3f' },
  { key: 'cs_come_cold_date_two', label: 'เวลาห้องเย็นใหญ่รับเข้าวัตถุดิบเตรียมเสร็จแล้ว (ครั้งที่ 2)', icon: '🏠', color: '#3f3f3f' },
  { key: 'cs_out_cold_date_two', label: 'เวลาห้องเย็นใหญ่ส่งออกวัตถุดิบเตรียมเสร็จแล้ว (ครั้งที่ 2)', icon: '📤', color: '#3f3f3f' },
  {
    key: 'out_cold_date_two', label: 'เวลาออกห้องเย็น1 (ครั้งที่ 2)', icon: '🔼', color: '#3f3f3f',
    extras: [
      { key: 'receiver_out_cold_two', label: 'ผู้ทำรายการส่งออกวัตถุดิบไปห้องเย็นใหญ่' },
      { key: 'at_pd_storage_purpose_2', label: 'สาเหตุการฝากวัตถุดิบ' },
      { key: 'at_pd_histamine_2', label: 'Histamine' },
    ]
  },
  { key: 'withdraw_date_two', label: 'ห้องเย็นใหญ่ทำรายการส่งออกผ่านบ่อละลายไฟฟ้า (ครั้งที่ 2)', icon: '📦', color: '#3f3f3f' },
  { key: 'start_defrost_date_two', label: 'เวลาเริ่มละลายวัตถุดิบ (ครั้งที่ 2)', icon: '💧', color: '#3f3f3f' },
  { key: 'end_defrost_date_two', label: 'เวลาละลายวัตถุดิบเสร็จ (ครั้งที่ 2)', icon: '✅', color: '#3f3f3f' },

  { key: 'come_cold_date_three', label: 'เข้าห้องเย็น1 (ครั้งที่ 3)', icon: '❄️', color: '#3f3f3f' },
  { key: 'cs_come_cold_date_three', label: 'ห้องเย็นรับเข้าวัตถุดิบเตรียมเสร็จแล้ว (ครั้งที่ 3)', icon: '🏠', color: '#3f3f3f' },
  { key: 'cs_out_cold_date_three', label: 'ห้องเย็นส่งออกวัตถุดิบเตรียมเสร็จแล้ว (ครั้งที่ 3)', icon: '📤', color: '#3f3f3f' },
  {
    key: 'out_cold_date_three', label: 'ออกห้องเย็น1 (ครั้งที่ 3)', icon: '🔼', color: '#3f3f3f',
    extras: [
      { key: 'receiver_out_cold_three', label: 'ผู้ทำรายการส่งออกวัตถุดิบไปห้องเย็นใหญ่' },
      { key: 'at_pd_storage_purpose_3', label: 'สาเหตุการฝากวัตถุดิบ' },
      { key: 'at_pd_histamine_3', label: 'Histamine' },
    ]
  },
  { key: 'withdraw_date_three', label: 'เวลาห้องเย็นใหญ่ทำรายการส่งออกผ่านบ่อละลายไฟฟ้า (ครั้งที่ 3)', icon: '📦', color: '#3f3f3f' },
  { key: 'start_defrost_date_three', label: 'เวลาเริ่มละลายวัตถุดิบ (ครั้งที่ 3)', icon: '💧', color: '#3f3f3f' },
  { key: 'end_defrost_date_three', label: 'เวลาละลายวัตถุดิบเสร็จ (ครั้งที่ 3)', icon: '✅', color: '#3f3f3f' },

  { key: 'cs_come_cold_date_four', label: 'เวลาห้องเย็นรับเข้าวัตถุดิบเตรียมเสร็จแล้ว (ครั้งที่ 4)', icon: '🏠', color: '#3f3f3f' },
  { key: 'cs_out_cold_date_four', label: 'เวลาห้องเย็นส่งออกวัตถุดิบเตรียมเสร็จแล้ว (ครั้งที่ 4)', icon: '📤', color: '#3f3f3f' },
  { key: 'withdraw_date_four', label: 'เวลาห้องเย็นใหญ่ทำรายการส่งออกผ่านบ่อละลายไฟฟ้า (ครั้งที่ 4)', icon: '📦', color: '#3f3f3f' },
  { key: 'start_defrost_date_four', label: 'เวลาเริ่มละลายวัตถุดิบ (ครั้งที่ 4)', icon: '💧', color: '#3f3f3f' },
  { key: 'end_defrost_date_four', label: 'เวลาละลายวัตถุดิบเสร็จ (ครั้งที่ 4)', icon: '✅', color: '#3f3f3f' },

  { key: 'rework_date', label: 'เวลาแก้ไขวัตถุดิบ', icon: '🔄', color: '#78350F' },

  { key: 'input_pd_date', label: 'เวลา PD ทำรายรับเข้าวัตถุดิบจากห้องเย็นใหญ่ (ครั้งที่ 1)', icon: '🏭', color: '#3f3f3f' },
  {
    key: 'output_pd_date', label: 'เวลา PD ทำรายส่งคืนวัตถุดิบไม่ผ่านการแปรรูปไปห้องเย็นใหญ่ (ครั้งที่ 1)', icon: '↩️', color: '#3f3f3f',
    extras: [
      { key: 'pd_send', label: 'ผู้ทำรายการส่งวัตถุดิบยังไม่ผ่านการแปรรูปไปฝากห้องเย็นใหญ่' },
      { key: 'storage_purpose', label: 'สาเหตุการฝากวัตถุดิบ' },
      { key: 'histamine', label: 'Histamine' },
    ]
  },
  { key: 'input_pd_date_two', label: 'เวลา PD ทำรายรับเข้าวัตถุดิบจากห้องเย็นใหญ่ (ครั้งที่ 2)', icon: '🏭', color: '#3f3f3f' },
  {
    key: 'output_pd_date_two', label: 'เวลา PD ทำรายส่งคืนวัตถุดิบไม่ผ่านการแปรรูปไปห้องเย็นใหญ่ (ครั้งที่ 2)', icon: '↩️', color: '#3f3f3f',
    extras: [
      { key: 'pd_send_2', label: 'ผู้ทำรายการส่งวัตถุดิบยังไม่ผ่านการแปรรูปไปฝากห้องเย็นใหญ่' },
      { key: 'storage_purpose_2', label: 'สาเหตุการฝากวัตถุดิบ' },
      { key: 'histamine_2', label: 'Histamine' },
    ]
  },
  { key: 'input_pd_date_three', label: 'เวลา PD ทำรายรับเข้าวัตถุดิบจากห้องเย็นใหญ่ (ครั้งที่ 3)', icon: '🏭', color: '#3f3f3f' },
  {
    key: 'output_pd_date_three', label: 'เวลา PD ทำรายส่งคืนวัตถุดิบไม่ผ่านการแปรรูปไปห้องเย็นใหญ่ (ครั้งที่ 3)', icon: '↩️', color: '#3f3f3f',
    extras: [
      { key: 'pd_send_3', label: 'ผู้ทำรายการส่งวัตถุดิบยังไม่ผ่านการแปรรูปไปฝากห้องเย็นใหญ่' },
      { key: 'storage_purpose_3', label: 'สาเหตุการฝากวัตถุดิบ' },
      { key: 'histamine_3', label: 'Histamine' },
    ]
  },

  {
    key: 'input_cd_date', label: 'เวลาห้องเย็นใหญ่ทำรายการรับเข้าวัตถุดิบไม่ผ่านการแปรรูปจากในไลน์ (ครั้งที่ 1)', icon: '🗄️', color: '#3f3f3f',
    extras: [{ key: 'cs_re', label: 'ผู้ทำรายการรับวัตถุดิบเข้าห้องเย็นใหญ่' }]
  },
  {
    key: 'input_cd_date_two', label: 'เวลาห้องเย็นใหญ่ทำรายการรับเข้าวัตถุดิบไม่ผ่านการแปรรูปจากในไลน์ (ครั้งที่ 2)', icon: '🗄️', color: '#3f3f3f',
    extras: [{ key: 'cs_re_2', label: 'ผู้ทำรายการรับวัตถุดิบเข้าห้องเย็นใหญ่' }]
  },
  {
    key: 'input_cd_date_three', label: 'เวลาห้องเย็นใหญ่ทำรายการรับเข้าวัตถุดิบไม่ผ่านการแปรรูปจากในไลน์ (ครั้งที่ 3)', icon: '🗄️', color: '#3f3f3f',
    extras: [{ key: 'cs_re_3', label: 'ผู้ทำรายการรับวัตถุดิบเข้าห้องเย็นใหญ่' }]
  },

  { key: 'start_mixed_date', label: 'เวลาเริ่มผสมวัตถุดิบ', icon: '🥣', color: '#3f3f3f' },
  { key: 'start_gravy_date', label: 'เวลาเริ่มใส่ Gravy', icon: '🍲', color: '#3f3f3f' },
  { key: 'gm_date', label: 'เวลาบดวัตถุดิบ', icon: '📋', color: '#3f3f3f' },
  { key: 'sc_pack_date', label: 'เวลาบรรจุเสร็จ', icon: '🏁', color: '#ffc800' },
];

// option list สำหรับ dropdown เลือก "จุดเวลา" (ใช้กับฟีเจอร์หา diff ที่เกินกี่ชม.)
const TIME_EVENT_OPTIONS = TIME_EVENTS.map(e => ({ key: e.key, label: e.label }));

// ── helpers ────────────────────────────────────────────────────────────────────
function parseDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d) ? null : d;
}
function fmtDisplay(val) {
  const d = parseDate(val);
  if (!d) return '-';
  return `${d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })} ${d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`;
}
function fmtShort(val) {
  const d = parseDate(val);
  if (!d) return '-';
  return d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
function fmtTime(val) {
  const d = parseDate(val);
  if (!d) return '-';
  return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}
function diffMins(a, b) {
  const da = parseDate(a), db = parseDate(b);
  if (!da || !db) return null;
  return Math.round((db - da) / 60000);
}
function fmtDuration(mins) {
  if (mins == null) return null;
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60), m = abs % 60;
  const sign = mins < 0 ? '-' : '+';
  if (h === 0) return `${sign}${m}m`;
  if (m === 0) return `${sign}${h}h`;
  return `${sign}${h}h ${m}m`;
}
function highlightMatch(text, query) {
  if (!text || !query) return String(text || '');
  const s = String(text);
  const idx = s.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return s;
  return (
    <>{s.slice(0, idx)}<mark style={{ background: '#FDE68A', color: '#92400E', borderRadius: 2, padding: '0 2px' }}>{s.slice(idx, idx + query.length)}</mark>{s.slice(idx + query.length)}</>
  );
}

// ── TimelineModal ──────────────────────────────────────────────────────────────
const TimelineModal = ({ row, onClose }) => {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  if (!row) return null;
  const events = TIME_EVENTS
    .map(e => ({ ...e, val: row[e.key] }))
    .filter(e => e.val && parseDate(e.val))
    .map(e => ({ ...e, d: parseDate(e.val) }))
    .sort((a, b) => a.d - b.d);

  const totalMins = events.length >= 2 ? diffMins(events[0].d, events[events.length - 1].d) : null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 1400, maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.25)', animation: 'modalIn 0.2s ease' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── header ── */}
        <div style={{ padding: '22px 28px 18px', borderBottom: '1px solid #E5E7EB', flexShrink: 0, background: '#F5F8FF' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 24 }}>⏱️</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.mat_name || row.mat || '-'}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {row.mat && <Chip label={`รหัส: ${row.mat}`} bg="#F3F4F6" color="#374151" />}
                {row.doc_no && <Chip label={row.doc_no} bg="#DBEAFE" color="#0F3FC4" />}
                {row.code && <Chip label={row.code} bg="#E0F2FE" color="#0369A1" />}
                {row.rmm_line_name && <Chip label={row.rmm_line_name} bg="#EDE9FE" color="#5B21B6" />}
                {row.batch_before != null && <Chip label={`Tag: ${row.batch_before}`} bg="#FEF3C7" color="#92400E" />}
                {row.batch_after != null && <Chip label={`Batch: ${row.batch_after}`} bg="#DCFCE7" color="#166534" />}
                {row.hu && <Chip label={`HU: ${row.hu}`} bg="#FFEDD5" color="#C2410C" />}
                {row.weight_RM && <Chip label={`${Number(row.weight_RM).toLocaleString()} kg`} bg="#F3F4F6" color="#374151" />}
              </div>
            </div>
            <button onClick={onClose} style={{ background: '#F3F4F6', border: '1px solid #E5E7EB', cursor: 'pointer', width: 38, height: 38, borderRadius: '50%', fontSize: 16, color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
          </div>

          {totalMins !== null && (
            <div style={{ marginTop: 14, padding: '10px 18px', background: '#EAF0FF', borderRadius: 10, border: '1px solid #BFDBFE', display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#374151' }}>ระยะเวลาทั้งหมด: <strong style={{ color: '#0F3FC4', fontSize: 15 }}>{fmtDuration(totalMins)}</strong></span>
              <span style={{ fontSize: 13, color: '#6B7280' }}>{events.length} events</span>
              <span style={{ fontSize: 13, color: '#6B7280' }}>เริ่ม: <strong style={{ color: '#111827' }}>{fmtDisplay(events[0]?.val)}</strong></span>
              <span style={{ fontSize: 13, color: '#6B7280' }}>สิ้นสุด: <strong style={{ color: '#111827' }}>{fmtDisplay(events[events.length - 1]?.val)}</strong></span>
            </div>
          )}
        </div>

        {/* ── timeline body ── */}
        <div style={{ overflowY: 'auto', padding: '24px 28px', flex: 1, background: '#fff' }}>
          {events.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF', fontSize: 15 }}>ไม่มีข้อมูลเวลา</div>
          ) : (
            <div style={{ position: 'relative' }}>
              {/* vertical line */}
              <div style={{ position: 'absolute', left: 17, top: 20, bottom: 20, width: 2, background: '#E5E7EB', borderRadius: 2 }} />

              {events.map((ev, i) => {
                const dur = i > 0 ? diffMins(events[i - 1].d, ev.d) : null;
                const isLast = i === events.length - 1;
                const extrasToShow = (ev.extras || []).filter(e => row[e.key] != null && row[e.key] !== '');
                const isWarn = dur !== null && dur > 480;
                const isAlert = dur !== null && dur > 120 && dur <= 480;

                return (
                  <div key={ev.key}>
                    {/* duration badge */}
                    {dur !== null && (
                      <div style={{ paddingLeft: 52, marginBottom: 5, marginTop: -1 }}>
                        <span style={{
                          fontSize: 12, fontWeight: 600,
                          color: isWarn ? '#991B1B' : isAlert ? '#92400E' : '#6B7280',
                          background: isWarn ? '#FEE2E2' : isAlert ? '#FEF3C7' : '#F3F4F6',
                          border: `1px solid ${isWarn ? '#FECACA' : isAlert ? '#FDE68A' : '#E5E7EB'}`,
                          borderRadius: 20, padding: '3px 12px',
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                        }}>
                          ⏱ {fmtDuration(dur)}
                          {isWarn && <span>⚠️</span>}
                        </span>
                      </div>
                    )}

                    {/* event row */}
                    <div style={{ display: 'flex', gap: 16, marginBottom: isLast ? 0 : 4 }}>
                      {/* icon dot */}
                      <div style={{ flexShrink: 0, paddingTop: 12, position: 'relative', zIndex: 1 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: ev.color,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 16,
                          boxShadow: `0 0 0 3px #fff, 0 0 0 5px ${ev.color}`,
                        }}>{ev.icon}</div>
                      </div>

                      {/* card */}
                      <div style={{
                        flex: 1,
                        background: '#FAFAFA',
                        border: `1px solid #E5E7EB`,
                        borderLeft: `4px solid ${ev.color}`,
                        borderRadius: 12,
                        padding: '12px 18px',
                        marginBottom: 14,
                      }}>
                        {/* label */}
                        <div style={{ fontSize: 28, fontWeight: 700, color: ev.color, marginBottom: 5 }}>
                          {ev.label}
                        </div>
                        {/* datetime */}
                        <div style={{ fontSize: 17, fontWeight: 700, color: '#111827' }}>
                          {fmtDisplay(ev.val)}
                        </div>

                        {/* extras */}
                        {extrasToShow.length > 0 && (
                          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #E5E7EB', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {extrasToShow.map(e => (
                              <div key={e.key} style={{
                                fontSize: 13, background: '#fff',
                                border: '1px solid #E5E7EB', borderRadius: 8,
                                padding: '5px 12px', display: 'flex', gap: 6, alignItems: 'center',
                              }}>
                                <span style={{ color: '#6B7280' }}>{e.label}:</span>
                                <span style={{ color: '#111827', fontWeight: 600 }}>{String(row[e.key])}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Chip / Dash / ActiveTag ────────────────────────────────────────────────────
const Chip = ({ label, bg, color }) => (
  <span style={{ fontSize: 11, background: bg, color, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>{label}</span>
);
const DarkChip = ({ label, c }) => (
  <span style={{ fontSize: 12, background: '#1E293B', color: c, border: '1px solid #334155', padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap', fontWeight: 500 }}>{label}</span>
);
const Dash = () => <span style={{ color: '#E5E7EB' }}>—</span>;
const ActiveTag = ({ label, onRemove }) => (
  <div style={{ fontSize: 11, color: '#0F3FC4', background: '#EAF0FF', padding: '3px 10px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
    {label}
    <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#6B7280', padding: 0, lineHeight: 1 }}>✕</button>
  </div>
);

// ── Shared styles ──────────────────────────────────────────────────────────────
const labelStyle = { fontSize: 11, color: '#6B7280', marginBottom: 4, display: 'block' };
const inputStyle = { fontSize: 13, padding: '6px 10px', height: 34, border: '0.5px solid #D1D5DB', borderRadius: 8, background: '#fff', color: '#111827', outline: 'none', boxSizing: 'border-box' };
const btnPrimary = { fontSize: 13, padding: '0 18px', height: 34, border: 'none', borderRadius: 8, cursor: 'pointer', background: '#1552F0', color: '#fff', fontWeight: 600 };
const btnSecondary = { fontSize: 13, padding: '0 14px', height: 34, border: '0.5px solid #D1D5DB', borderRadius: 8, cursor: 'pointer', background: '#fff', color: '#374151' };
const btnWarn = { fontSize: 13, padding: '0 18px', height: 34, border: 'none', borderRadius: 8, cursor: 'pointer', background: '#F59E0B', color: '#fff', fontWeight: 600 };
const cellStyle = { padding: '10px 14px', borderBottom: '0.5px solid #F3F4F6', verticalAlign: 'middle' };
const thStyle = { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280', borderBottom: '1px solid #E5E7EB', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', background: '#F5F8FF' };

const SortIcon = ({ field, sortField, sortDir }) => {
  if (sortField !== field) return <span style={{ opacity: 0.25, marginLeft: 4, fontSize: 10 }}>↕</span>;
  return <span style={{ marginLeft: 4, fontSize: 10, color: '#1552F0' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
};

// ── SearchableSelect ───────────────────────────────────────────────────────────
const SearchableSelect = ({ value, onChange, options, placeholder = 'ทั้งหมด', labelKey, valueKey }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const getLabel = (o) => labelKey ? o[labelKey] : String(o);
  const getValue = (o) => valueKey ? o[valueKey] : String(o);

  const filtered = options.filter(o =>
    String(getLabel(o) || '').toLowerCase().includes(search.toLowerCase())
  );

  const selectedLabel = value
    ? (() => {
      const found = options.find(o => String(getValue(o)) === String(value));
      return found ? getLabel(found) : value;
    })()
    : '';

  const handleToggle = () => {
    setOpen(o => !o);
    setSearch('');
  };

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      {/* trigger */}
      <div
        onClick={handleToggle}
        style={{
          ...inputStyle, width: '100%', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          userSelect: 'none', boxSizing: 'border-box',
          outline: open ? '2px solid #93C5FD' : 'none',
          borderColor: open ? '#1552F0' : '#D1D5DB',
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: value ? '#111827' : '#9CA3AF', fontSize: 13 }}>
          {selectedLabel || placeholder}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 4 }}>
          {value && (
            <span
              onClick={e => { e.stopPropagation(); onChange(''); }}
              style={{ fontSize: 11, color: '#9CA3AF', cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}
              title="ล้าง"
            >✕</span>
          )}
          <span style={{ fontSize: 9, color: '#9CA3AF' }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 3px)', left: 0, right: 0, zIndex: 200,
          background: '#fff', border: '0.5px solid #D1D5DB', borderRadius: 10,
          boxShadow: '0 8px 30px rgba(0,0,0,0.14)', overflow: 'hidden',
        }}>
          {/* search box */}
          <div style={{ padding: '8px 8px 5px', borderBottom: '0.5px solid #F3F4F6' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: 8, fontSize: 11, color: '#9CA3AF', pointerEvents: 'none' }}>🔍</span>
              <input
                ref={inputRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="ค้นหา..."
                style={{ ...inputStyle, width: '100%', paddingLeft: 26, fontSize: 12, height: 30 }}
                onClick={e => e.stopPropagation()}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#9CA3AF', padding: 0 }}>✕</button>
              )}
            </div>
          </div>

          {/* option list */}
          <div style={{ maxHeight: 210, overflowY: 'auto' }}>
            {/* "ทั้งหมด" option */}
            <div
              onClick={() => { onChange(''); setOpen(false); }}
              style={{
                padding: '8px 12px', fontSize: 13, cursor: 'pointer',
                color: !value ? '#1552F0' : '#6B7280',
                background: !value ? '#EAF0FF' : '#fff',
                fontStyle: 'italic',
              }}
            >
              {placeholder}
            </div>

            {filtered.length === 0 ? (
              <div style={{ padding: '12px', fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>ไม่พบข้อมูล</div>
            ) : (
              filtered.map((o, i) => {
                const v = String(getValue(o));
                const l = getLabel(o);
                const sel = String(value) === v;
                return (
                  <div
                    key={i}
                    onClick={() => { onChange(v); setOpen(false); }}
                    style={{
                      padding: '8px 12px', fontSize: 13, cursor: 'pointer',
                      color: sel ? '#0F3FC4' : '#111827',
                      background: sel ? '#EAF0FF' : '#fff',
                      fontWeight: sel ? 600 : 400,
                      borderLeft: sel ? '3px solid #1552F0' : '3px solid transparent',
                    }}
                    onMouseEnter={e => { if (!sel) e.currentTarget.style.background = '#F5F8FF'; }}
                    onMouseLeave={e => { if (!sel) e.currentTarget.style.background = '#fff'; }}
                  >
                    {l}
                  </div>
                );
              })
            )}
          </div>

          {/* count */}
          {search && (
            <div style={{ padding: '4px 10px', fontSize: 10, color: '#9CA3AF', borderTop: '0.5px solid #F3F4F6', background: '#FAFAFA' }}>
              {filtered.length} รายการ
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Spinner ────────────────────────────────────────────────────────────────────
const Spinner = ({ size = 20, border = 2 }) => (
  <div style={{ width: size, height: size, border: `${border}px solid #E5E7EB`, borderTop: `${border}px solid #1552F0`, borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
);

// ── EMPTY state ────────────────────────────────────────────────────────────────
const EMPTY_FILTERS = {
  sc_pack_date_from: '', sc_pack_date_to: '',
  mat: '', mat_name: '',
  batch_before: '', batch_after: '',
  hu: '',
  rmm_line_name: '', doc_no: '', code: ''
};

// ฟิลเตอร์ใหม่: หาช่วงเวลาที่ห่างกันเกินกี่ชั่วโมง ระหว่าง 2 จุดเวลาที่เลือก
const EMPTY_DELAY = { startKey: '', endKey: '', hours: '' };

// ── Main Component ─────────────────────────────────────────────────────────────
const ProductionLineDelayDashboard = () => {
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);  // เปิดหน้ามายังไม่ดึงข้อมูล
  const [timelineRow, setTimelineRow] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('sc_pack_date');
  const [sortDir, setSortDir] = useState('desc');

  // ── ฟีเจอร์ใหม่: ค้นหาช่วงเวลาที่ "ห่างกันเกิน N ชั่วโมง" ระหว่าง 2 จุดเวลาที่เลือก ──
  const [delayFilter, setDelayFilter] = useState(EMPTY_DELAY);   // ค่าที่กำลังตั้งอยู่ใน input
  const [delayActive, setDelayActive] = useState(false);          // true เมื่อกด "ค้นหา/Sort" แล้ว
  const [delayError, setDelayError] = useState('');

  // dropdown options
  const [optLines, setOptLines] = useState([]);
  const [optDocNo, setOptDocNo] = useState([]);
  const [optCode, setOptCode] = useState([]);
  const [optBatchBefore, setOptBatchBefore] = useState([]);
  const [optBatchAfter, setOptBatchAfter] = useState([]);
  const [optHu, setOptHu] = useState([]);
  const [optMat, setOptMat] = useState([]);
  const [optMatName, setOptMatName] = useState([]);

  // fetch all dropdowns on mount
  useEffect(() => {
    const load = async (path, setter, key) => {
      try {
        const res = await axios.get(`${API_URL}/api/${path}`);
        const data = Array.isArray(res.data?.data) ? res.data.data : [];
        setter(key ? data.map(r => r[key]).filter(Boolean) : data);
      } catch { /* dropdown silently fails */ }
    };
    load('dropdown/lines', setOptLines, null);          // object {line_id, line_name}
    load('dropdown/doc-no', setOptDocNo, 'doc_no');
    load('dropdown/code', setOptCode, 'code');
    load('dropdown/batch-before', setOptBatchBefore, 'batch_before');
    load('dropdown/batch-after', setOptBatchAfter, 'batch_after');
    load('dropdown/hu', setOptHu, 'hu');
    load('dropdown/mat', setOptMat, null);          // object {mat, mat_name}
    load('dropdown/mat-name', setOptMatName, 'mat_name');
  }, []);

  // ── fetch main data (only on search) ────────────────────────────────────────
  const fetchData = useCallback(async (activeFilters) => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      Object.entries(activeFilters).forEach(([k, v]) => {
        if (v && String(v).trim()) params[k] = String(v).trim();
      });
      const res = await axios.get(`${API_URL}/api/all/delay/tracking/rm`, { params });
      const raw = res.data;
      setRawData(Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []));
      setSearched(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── ฟังก์ชันสำหรับฟีเจอร์ "หาช่วงเวลาห่างเกิน N ชั่วโมง" ──────────────────────
  const handleDelaySearch = () => {
    if (!delayFilter.startKey || !delayFilter.endKey) {
      setDelayError('กรุณาเลือกจุดเวลาเริ่มต้นและจุดเวลาสิ้นสุดให้ครบ');
      return;
    }
    if (delayFilter.hours === '' || isNaN(Number(delayFilter.hours))) {
      setDelayError('กรุณาระบุจำนวนชั่วโมงที่ต้องการ');
      return;
    }
    setDelayError('');
    setDelayActive(true);
    // เมื่อ active แล้วให้ sort เรียงตามระยะเวลาห่าง (มากไปน้อย) โดยอัตโนมัติ
    setSortField('__diffMins');
    setSortDir('desc');
  };

  const handleDelayReset = () => {
    setDelayFilter(EMPTY_DELAY);
    setDelayActive(false);
    setDelayError('');
    if (sortField === '__diffMins') {
      setSortField('sc_pack_date');
      setSortDir('desc');
    }
  };

  const setDF = (key, val) => setDelayFilter(p => ({ ...p, [key]: val }));

  // label ของจุดเวลาที่เลือกไว้ (ใช้แสดงผล)
  const startLabel = TIME_EVENT_OPTIONS.find(o => o.key === delayFilter.startKey)?.label || '';
  const endLabel = TIME_EVENT_OPTIONS.find(o => o.key === delayFilter.endKey)?.label || '';

  // ── filter / sort ────────────────────────────────────────────────────────────
  const displayData = React.useMemo(() => {
    let data = rawData;
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      data = data.filter(r =>
        ['mat_name', 'mat', 'doc_no', 'code', 'rmm_line_name'].some(k => String(r[k] || '').toLowerCase().includes(q)) ||
        String(r.batch_before ?? '').toLowerCase().includes(q) ||
        String(r.batch_after ?? '').toLowerCase().includes(q) ||
        String(r.hu ?? '').toLowerCase().includes(q)
      );
    }

    // ── ฟิลเตอร์ช่วงเวลาห่างเกิน N ชั่วโมง ──
    if (delayActive && delayFilter.startKey && delayFilter.endKey && delayFilter.hours !== '') {
      const thresholdMins = Number(delayFilter.hours) * 60;
      data = data
        .map(r => ({ ...r, __diffMins: diffMins(r[delayFilter.startKey], r[delayFilter.endKey]) }))
        .filter(r => r.__diffMins != null && r.__diffMins > thresholdMins);
    }

    return [...data].sort((a, b) => {
      if (sortField === '__diffMins') {
        const av = a.__diffMins, bv = b.__diffMins;
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      let av = a[sortField], bv = b[sortField];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv, 'th') : bv.localeCompare(av, 'th');
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [rawData, searchTerm, sortField, sortDir, delayActive, delayFilter]);

  const metrics = React.useMemo(() => ({
    total: displayData.length,
    totalWeight: displayData.reduce((s, r) => s + (Number(r.weight_RM) || 0), 0),
    totalTray: displayData.reduce((s, r) => s + (Number(r.tray_count) || 0), 0),
  }), [displayData]);

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const handleSearch = () => fetchData(filters);

  const handleReset = () => {
    setFilters(EMPTY_FILTERS);
    setSearchTerm('');
    setRawData([]);
    setSearched(false);
    handleDelayReset();
  };

  const setF = (key, val) => setFilters(p => ({ ...p, [key]: val }));

  const columns = [
    { key: 'mat_name', label: 'ชื่อวัตถุดิบ', minW: 160 },
    { key: 'mat', label: 'Mat', minW: 90 },
    { key: 'doc_no', label: 'เลขเอกสาร', minW: 110 },
    { key: 'code', label: 'Code', minW: 90 },
    { key: 'rmm_line_name', label: 'ไลน์', minW: 90 },
    { key: 'batch_before', label: 'Batch Tag', minW: 110 },
    { key: 'batch_after', label: 'Batch หลังเตรียม', minW: 130 },
    { key: 'hu', label: 'HU', minW: 90 },
    { key: 'weight_RM', label: 'น้ำหนัก (kg)', minW: 100 },
    { key: 'sc_pack_date', label: 'บรรจุเสร็จ', minW: 130 },
    // คอลัมน์ "ระยะเวลาห่าง" จะแสดงเมื่อเปิดใช้ฟิลเตอร์ delay เท่านั้น
    ...(delayActive ? [{ key: '__diffMins', label: `ระยะเวลาห่าง (${startLabel.slice(0, 14)}… → ${endLabel.slice(0, 14)}…)`, minW: 170 }] : []),
    { key: '_timeline', label: 'Timeline', minW: 72 },
  ];

  // ── bound SearchableSelect ──────────────────────────────────────────────────
  const Sel = ({ fkey, opts, placeholder = 'ทั้งหมด', labelKey, valueKey }) => (
    <SearchableSelect
      value={filters[fkey]}
      onChange={v => setF(fkey, v)}
      options={opts}
      placeholder={placeholder}
      labelKey={labelKey}
      valueKey={valueKey}
    />
  );

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '1rem 0', fontFamily: 'inherit' }}>
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg) } }
        @keyframes modalIn { from { opacity:0; transform:scale(0.95) } to { opacity:1; transform:scale(1) } }
        @keyframes fadeIn  { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
      `}</style>

      {/* ── filter bar ── */}
      <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 14, padding: '18px 20px', marginBottom: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 14 }}>🔍 ตัวกรองข้อมูล</div>

        {/* row 1: text / date */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(155px,1fr))', gap: 10, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>วันบรรจุ (จาก)</label>
            <input type="date" style={{ ...inputStyle, width: '100%' }} value={filters.sc_pack_date_from} onChange={e => setF('sc_pack_date_from', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>วันบรรจุ (ถึง)</label>
            <input type="date" style={{ ...inputStyle, width: '100%' }} value={filters.sc_pack_date_to} onChange={e => setF('sc_pack_date_to', e.target.value)} />
          </div>
        </div>

        {/* row 2: dropdowns */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(155px,1fr))', gap: 10, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>ชื่อวัตถุดิบ (mat_name)</label>
            <Sel fkey="mat_name" opts={optMatName} />
          </div>
          <div>
            <label style={labelStyle}>รหัส (mat)</label>
            <Sel fkey="mat" opts={optMat} valueKey="mat" labelKey="mat" />
          </div>
          <div>
            <label style={labelStyle}>Batch Tag (batch_before)</label>
            <Sel fkey="batch_before" opts={optBatchBefore} />
          </div>
          <div>
            <label style={labelStyle}>Batch หลังเตรียม (batch_after)</label>
            <Sel fkey="batch_after" opts={optBatchAfter} />
          </div>
          <div>
            <label style={labelStyle}>HU</label>
            <Sel fkey="hu" opts={optHu} />
          </div>
          <div>
            <label style={labelStyle}>ไลน์ (rmm_line_name)</label>
            <SearchableSelect
              value={filters.rmm_line_name}
              onChange={v => setF('rmm_line_name', v)}
              options={optLines}
              placeholder="ทั้งหมด"
              labelKey="line_name"
              valueKey="line_name"
            />
          </div>
          <div>
            <label style={labelStyle}>เลขเอกสาร (doc_no)</label>
            <Sel fkey="doc_no" opts={optDocNo} />
          </div>
          <div>
            <label style={labelStyle}>Code</label>
            <Sel fkey="code" opts={optCode} />
          </div>
        </div>

        {/* row 3: search + actions */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <div>
            <label style={labelStyle}>ค้นหาทุกฟิลด์</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: 9, fontSize: 13, color: '#9CA3AF', pointerEvents: 'none' }}>🔍</span>
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="พิมพ์เพื่อค้นหา (client-side)..."
                style={{ ...inputStyle, paddingLeft: 28, minWidth: 200 }}
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#9CA3AF', padding: 0 }}>✕</button>
              )}
            </div>
          </div>
          <button onClick={handleSearch} disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            {loading ? <Spinner size={14} border={2} /> : null}
            ยืนยัน
          </button>
          <button onClick={handleReset} disabled={loading} style={btnSecondary}>รีเซ็ต</button>
        </div>

        {/* active filter tags */}
        {searched && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {(filters.sc_pack_date_from || filters.sc_pack_date_to) && (
              <div style={{ fontSize: 11, color: '#0F3FC4', background: '#EAF0FF', padding: '3px 10px', borderRadius: 6 }}>
                📅 {filters.sc_pack_date_from || '…'} → {filters.sc_pack_date_to || '…'}
              </div>
            )}
            {filters.mat_name && <ActiveTag label={`ชื่อ: ${filters.mat_name}`} onRemove={() => { setF('mat_name', ''); fetchData({ ...filters, mat_name: '' }); }} />}
            {filters.mat && <ActiveTag label={`รหัส: ${filters.mat}`} onRemove={() => { setF('mat', ''); fetchData({ ...filters, mat: '' }); }} />}
            {filters.batch_before && <ActiveTag label={`Batch Tag: ${filters.batch_before}`} onRemove={() => { setF('batch_before', ''); fetchData({ ...filters, batch_before: '' }); }} />}
            {filters.batch_after && <ActiveTag label={`Batch After: ${filters.batch_after}`} onRemove={() => { setF('batch_after', ''); fetchData({ ...filters, batch_after: '' }); }} />}
            {filters.hu && <ActiveTag label={`HU: ${filters.hu}`} onRemove={() => { setF('hu', ''); fetchData({ ...filters, hu: '' }); }} />}
            {filters.rmm_line_name && <ActiveTag label={`ไลน์: ${filters.rmm_line_name}`} onRemove={() => { setF('rmm_line_name', ''); fetchData({ ...filters, rmm_line_name: '' }); }} />}
            {filters.doc_no && <ActiveTag label={`เอกสาร: ${filters.doc_no}`} onRemove={() => { setF('doc_no', ''); fetchData({ ...filters, doc_no: '' }); }} />}
            {filters.code && <ActiveTag label={`Code: ${filters.code}`} onRemove={() => { setF('code', ''); fetchData({ ...filters, code: '' }); }} />}
            {searchTerm && <ActiveTag label={`🔍 ${searchTerm}`} onRemove={() => setSearchTerm('')} />}
            <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 'auto', alignSelf: 'center' }}>
              แสดง {displayData.length.toLocaleString()} / {rawData.length.toLocaleString()} รายการ
            </span>
          </div>
        )}
      </div>

      {/* ── delay-range filter bar (ฟีเจอร์ใหม่) ── */}
      <div style={{ background: '#FFFBEB', border: '0.5px solid #FDE68A', borderRadius: 14, padding: '16px 20px', marginBottom: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E', marginBottom: 12 }}>⏱️ ค้นหา/Sort ช่วงเวลาที่ห่างกันเกินกี่ชั่วโมง</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 10, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>1. เวลาเริ่มต้น</label>
            <SearchableSelect
              value={delayFilter.startKey}
              onChange={v => setDF('startKey', v)}
              options={TIME_EVENT_OPTIONS}
              placeholder="เลือกจุดเวลา..."
              labelKey="label"
              valueKey="key"
            />
          </div>
          <div>
            <label style={labelStyle}>2. เวลาสิ้นสุด</label>
            <SearchableSelect
              value={delayFilter.endKey}
              onChange={v => setDF('endKey', v)}
              options={TIME_EVENT_OPTIONS}
              placeholder="เลือกจุดเวลา..."
              labelKey="label"
              valueKey="key"
            />
          </div>
          <div>
            <label style={labelStyle}>3. ห่างกันเกิน (ชั่วโมง)</label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={delayFilter.hours}
              onChange={e => setDF('hours', e.target.value)}
              placeholder="เช่น 2"
              style={{ ...inputStyle, width: '100%' }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <button onClick={handleDelaySearch} style={btnWarn}>ค้นหา / Sort</button>
          <button onClick={handleDelayReset} style={btnSecondary}>ล้างตัวกรองนี้</button>
          {delayError && <span style={{ fontSize: 12, color: '#B91C1C' }}>{delayError}</span>}
          {delayActive && !delayError && (
            <span style={{ fontSize: 12, color: '#92400E' }}>
              กำลังแสดงรายการที่ "{startLabel}" → "{endLabel}" ห่างกันเกิน {delayFilter.hours} ชั่วโมง
              (เรียงจากห่างมากไปน้อย) — พบ {displayData.length.toLocaleString()} รายการ
            </span>
          )}
        </div>
      </div>

      {/* ── error ── */}
      {error && (
        <div style={{ padding: '1rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, color: '#B91C1C', fontSize: 14, marginBottom: 16 }}>
          เกิดข้อผิดพลาด: {error}
        </div>
      )}

      {/* ── empty state before search ── */}
      {!searched && !loading && (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#9CA3AF', border: '0.5px dashed #E5E7EB', borderRadius: 14, animation: 'fadeIn 0.3s ease' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 6 }}>เลือกตัวกรองแล้วกด "ยืนยัน"</div>
          <div style={{ fontSize: 13 }}>ระบบจะดึงข้อมูลตาม filter ที่เลือก</div>
        </div>
      )}

      {/* ── loading ── */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 180, gap: 12 }}>
          <Spinner size={34} border={3} />
          <span style={{ color: '#6B7280', fontSize: 14 }}>กำลังโหลดข้อมูล...</span>
        </div>
      )}

      {/* ── metrics (show only after search) ── */}
      {searched && !loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 16, animation: 'fadeIn 0.3s ease' }}>
          {[
            { label: 'รายการทั้งหมด', value: metrics.total.toLocaleString(), color: '#1552F0', icon: '📋' },
            { label: 'น้ำหนักรวม (kg)', value: metrics.totalWeight.toLocaleString(undefined, { maximumFractionDigits: 1 }), color: '#10B981', icon: '⚖️' },
          ].map((m, i) => (
            <div key={i} style={{ background: '#F5F8FF', borderRadius: 10, padding: '12px 16px', border: '0.5px solid #F3F4F6' }}>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>{m.icon} {m.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: m.color }}>{m.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── table ── */}
      {searched && !loading && (
        displayData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#9CA3AF', fontSize: 14, border: '0.5px solid #F3F4F6', borderRadius: 14, animation: 'fadeIn 0.3s ease' }}>
            {searchTerm ? `ไม่พบผลลัพธ์สำหรับ "${searchTerm}"` : (delayActive ? 'ไม่พบรายการที่ห่างกันเกินเวลาที่กำหนด' : 'ไม่มีข้อมูลที่ตรงกับเงื่อนไข')}
          </div>
        ) : (
          <div style={{ border: '0.5px solid #E5E7EB', borderRadius: 14, overflowX: 'auto', boxShadow: '0 1px 6px rgba(0,0,0,0.04)', animation: 'fadeIn 0.3s ease' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, cursor: 'default', minWidth: 40, textAlign: 'center' }}>#</th>
                  {columns.map(col => (
                    <th key={col.key}
                      onClick={() => col.key !== '_timeline' && handleSort(col.key)}
                      style={{ ...thStyle, minWidth: col.minW, cursor: col.key === '_timeline' ? 'default' : 'pointer' }}>
                      {col.label}
                      {col.key !== '_timeline' && <SortIcon field={col.key} sortField={sortField} sortDir={sortDir} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayData.map((row, i) => (
                  <tr key={row.mapping_id ?? i}
                    style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F0F9FF'}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#FAFAFA'}>

                    <td style={{ ...cellStyle, color: '#9CA3AF', fontSize: 11, textAlign: 'center' }}>{i + 1}</td>

                    <td style={{ ...cellStyle, fontWeight: 500 }}>
                      {searchTerm ? highlightMatch(row.mat_name, searchTerm) : (row.mat_name || '-')}
                    </td>
                    <td style={cellStyle}>
                      <span style={{ fontSize: 11, background: '#F3F4F6', color: '#374151', padding: '2px 8px', borderRadius: 20 }}>{row.mat || '-'}</span>
                    </td>
                    <td style={cellStyle}>
                      {row.doc_no ? <span style={{ fontSize: 11, background: '#EAF0FF', color: '#0F3FC4', padding: '2px 8px', borderRadius: 20 }}>{row.doc_no}</span> : <Dash />}
                    </td>
                    <td style={cellStyle}>
                      {row.code ? <span style={{ fontSize: 11, background: '#F0F9FF', color: '#0369A1', padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>{row.code}</span> : <Dash />}
                    </td>
                    <td style={cellStyle}>
                      {row.rmm_line_name ? <span style={{ fontSize: 11, background: '#F5F3FF', color: '#5B21B6', padding: '2px 8px', borderRadius: 20 }}>{row.rmm_line_name}</span> : <Dash />}
                    </td>
                    <td style={cellStyle}>
                      {row.batch_before != null ? <span style={{ fontSize: 11, background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: 20 }}>{row.batch_before}</span> : <Dash />}
                    </td>
                    <td style={cellStyle}>
                      {row.batch_after != null ? <span style={{ fontSize: 11, background: '#F0FDF4', color: '#166534', padding: '2px 8px', borderRadius: 20 }}>{row.batch_after}</span> : <Dash />}
                    </td>
                    <td style={cellStyle}>
                      {row.hu != null ? <span style={{ fontSize: 11, background: '#FFF7ED', color: '#C2410C', padding: '2px 8px', borderRadius: 20 }}>{row.hu}</span> : <Dash />}
                    </td>
                    <td style={{ ...cellStyle, textAlign: 'right' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                        {row.weight_RM != null ? Number(row.weight_RM).toLocaleString(undefined, { maximumFractionDigits: 1 }) : '-'}
                      </span>
                    </td>


                    <td style={cellStyle}>
                      {row.sc_pack_date ? (
                        <div>
                          <div style={{ fontSize: 11, color: '#6B7280' }}>{fmtShort(row.sc_pack_date)}</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#7C3AED' }}>{fmtTime(row.sc_pack_date)}</div>
                        </div>
                      ) : <Dash />}
                    </td>

                    {/* คอลัมน์ระยะเวลาห่าง (เฉพาะตอนเปิดใช้ฟิลเตอร์ delay) */}
                    {delayActive && (
                      <td style={cellStyle}>
                        {row.__diffMins != null ? (
                          <span style={{
                            fontSize: 12, fontWeight: 700,
                            color: row.__diffMins > 480 ? '#991B1B' : '#92400E',
                            background: row.__diffMins > 480 ? '#FEE2E2' : '#FEF3C7',
                            border: `1px solid ${row.__diffMins > 480 ? '#FECACA' : '#FDE68A'}`,
                            padding: '3px 10px', borderRadius: 20, display: 'inline-block',
                          }}>
                            ⏱ {fmtDuration(row.__diffMins)}
                          </span>
                        ) : <Dash />}
                      </td>
                    )}

                    <td style={{ ...cellStyle, textAlign: 'center' }}>
                      <button
                        onClick={() => setTimelineRow(row)}
                        title="ดู Timeline เวลา"
                        style={{ width: 34, height: 34, borderRadius: '50%', background: '#EAF0FF', border: '1px solid #BFDBFE', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, transition: 'all 0.15s', color: '#0F3FC4' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#DBEAFE'; e.currentTarget.style.transform = 'scale(1.12)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(59,130,246,0.3)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#EAF0FF'; e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                      >
                        ⏱️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {timelineRow && <TimelineModal row={timelineRow} onClose={() => setTimelineRow(null)} />}
    </div>
  );
};

export default ProductionLineDelayDashboard;