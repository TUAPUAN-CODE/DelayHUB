// ชิ้นส่วน UI ที่ใช้ร่วมกันในหน้า Traceback (Forward / Mock Recall / ผังต้นไม้ / ไทม์ไลน์)
import { T } from './tracebackUI';
import { useRemarkCs, remarkCsText } from '../../../Layout/RemarkCs';

const TONES = {
  blue: [T.blueSoft, T.blueDeep, T.blueLine],
  orange: [T.orangeSoft, T.orange, T.orangeLine],
  ok: [T.okSoft, T.ok, T.okLine],
  bad: [T.badSoft, T.bad, T.badLine],
  plain: [T.white, T.text2, T.line],
};

export const Tag = ({ children, tone = 'blue', title }) => {
  const [bg, fg, bd] = TONES[tone] || TONES.blue;
  return (
    <span title={title} style={{
      display: 'inline-block', fontSize: 11.5, fontWeight: 500, padding: '2px 9px', borderRadius: 6,
      background: bg, color: fg, border: `1px solid ${bd}`, whiteSpace: 'nowrap',
    }}>{children}</span>
  );
};

export const Kpi = ({ label, value, sub, tone = 'blue' }) => {
  const c = { bad: T.bad, orange: T.orange, ok: T.ok }[tone] || T.blue;
  return (
    <div style={{ background: T.white, border: `1px solid ${T.line}`, borderLeft: `4px solid ${c}`, borderRadius: 10, padding: '11px 13px' }}>
      <div style={{ fontSize: 11.5, color: T.text2, fontWeight: 500, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: c, lineHeight: 1.15 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.text2, marginTop: 3 }}>{sub}</div>}
    </div>
  );
};

export const Card = ({ title, right, tone = 'blue', children, pad = '14px 16px' }) => (
  <div style={{ marginTop: 14, border: `1px solid ${T.line}`, borderRadius: 12, overflow: 'hidden', background: T.white }}>
    {title && (
      <div style={{
        background: tone === 'orange' ? T.orange : T.blue, color: T.white, padding: '9px 14px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{title}</span>
        {right && <span style={{ fontSize: 12 }}>{right}</span>}
      </div>
    )}
    <div style={{ padding: pad }}>{children}</div>
  </div>
);

export const Btn = ({ children, onClick, variant = 'primary', disabled, title, style }) => {
  const v = {
    primary: [T.orange, T.orange, T.white],
    blue: [T.blue, T.blue, T.white],
    outline: [T.white, T.blue, T.blue],
    ghost: [T.white, T.line, T.text2],
  }[variant];
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} style={{
      height: 38, padding: '0 15px', borderRadius: 9, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
      background: v[0], border: `1.5px solid ${v[1]}`, color: v[2], fontSize: 13, fontWeight: 600,
      opacity: disabled ? 0.55 : 1, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', ...style,
    }}>{children}</button>
  );
};

/** ปุ่มเลือกแบบกลุ่ม (segmented control) */
export const Segmented = ({ value, onChange, options }) => (
  <div style={{ display: 'inline-flex', background: T.blueSoft, border: `1px solid ${T.blueLine}`, borderRadius: 10, padding: 3, gap: 3, flexWrap: 'wrap' }}>
    {options.map(o => {
      const on = o.value === value;
      return (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} style={{
          border: 'none', borderRadius: 8, padding: '7px 13px', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 12.5, fontWeight: 600, background: on ? T.blue : 'transparent', color: on ? T.white : T.blueDeep,
        }}>{o.label}</button>
      );
    })}
  </div>
);

const TH = {
  background: T.blue, color: T.white, fontSize: 12.5, fontWeight: 600, padding: '9px 11px',
  whiteSpace: 'nowrap', position: 'sticky', top: 0, textAlign: 'left',
};
const TD = { fontSize: 12.5, color: T.text, padding: '8px 11px', borderBottom: `1px solid ${T.line}` };

/** ตารางอย่างง่าย: columns = [{ key, label, align, render, wrap }] */
export const SimpleTable = ({ columns, rows, getKey, empty = 'ไม่มีข้อมูล', rowTone, maxHeight }) => {
  if (!rows?.length) {
    return <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: 18, fontSize: 13, color: T.text2, background: T.white }}>{empty}</div>;
  }
  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, overflow: 'auto', background: T.white, maxHeight }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{columns.map(c => <th key={c.key} style={{ ...TH, textAlign: c.align || 'left' }}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => {
            const tone = rowTone?.(r);
            const bg = tone === 'bad' ? T.badSoft : tone === 'orange' ? T.orangeSoft : tone === 'ok' ? T.okSoft : (i % 2 ? T.bg : T.white);
            return (
              <tr key={getKey ? getKey(r, i) : i} style={{ background: bg }}>
                {columns.map(c => (
                  <td key={c.key} style={{ ...TD, textAlign: c.align || 'left', whiteSpace: c.wrap ? 'normal' : 'nowrap' }}>
                    {c.render ? c.render(r, i) : (r[c.key] === 0 || r[c.key] ? r[c.key] : '—')}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/** วงแหวนเปอร์เซ็นต์ (คะแนนความครบถ้วน) */
export const Ring = ({ pct = 0, size = 74, label }) => {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const color = pct >= 85 ? T.ok : pct >= 60 ? T.orange : T.bad;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <svg width={size} height={size} role="img" aria-label={`${label || ''} ${pct}%`}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={T.line} strokeWidth="8" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth="8" fill="none"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        <text x="50%" y="53%" textAnchor="middle" dominantBaseline="middle" fontSize="16" fontWeight="700" fill={color}>{pct}%</text>
      </svg>
      {label && <span style={{ fontSize: 12.5, fontWeight: 600, color: T.blueDeep, maxWidth: 110 }}>{label}</span>}
    </div>
  );
};

export const Spinner = ({ size = 22 }) => (
  <div style={{ width: size, height: size, border: `3px solid ${T.blueLine}`, borderTop: `3px solid ${T.blue}`, borderRadius: '50%', animation: 'tbSpin 0.7s linear infinite', flexShrink: 0 }} />
);

export const Field = ({ label, children, width }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, width, minWidth: 0 }}>
    <span style={{ fontSize: 11.5, fontWeight: 600, color: T.blueDeep }}>{label}</span>
    {children}
  </label>
);

/**
 * Remark CS of a lot (m = a material row of the traceback: mapping_id, mat, batch_before): the note of its HU, typed when the preparation receives the HU
 * or puts the plan in a trolley, the same text that is printed on the slips. "—" when there is none. Read in one request for the cells shown together.
 */
export const RemarkCsText = ({ m }) => {
  const text = useRemarkCs([{ mappingId: m.mapping_id }]); // by the lot's own HU only: a batch can have several HUs, each with its own note
  return text ? <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{text}</span> : '—';
};

/** Remark CS of a Mat + Batch group of the summary table: a batch can have several HUs, each with its own note — lots with the same note share a line, marked by mapping_id */
export const RemarkCsGroupText = ({ lots }) => {
  const sources = (lots || []).map(m => ({ mappingId: m.mapping_id }));
  useRemarkCs(sources); // loads the notes and renders again when they arrive
  const byText = new Map();
  sources.forEach(src => {
    const t = remarkCsText([src]);
    if (t) byText.set(t, [...(byText.get(t) || []), src.mappingId]);
  });
  if (!byText.size) return '—';
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      {[...byText].map(([t, ids]) => (
        <div key={t} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {(lots || []).length > 1 && <b style={{ marginRight: 4 }}>{ids.map(id => `#${id}`).join(', ')}</b>}{t}
        </div>
      ))}
    </div>
  );
};
