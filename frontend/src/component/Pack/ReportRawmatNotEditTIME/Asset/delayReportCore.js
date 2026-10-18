// คำนวณดีเลย์ของรายงานควบคุมเวลาการผลิต F3PFPF67 (ใช้ร่วม: หน้า Report และหน้าดำเนินการเสร็จสิ้น)
// ─────────────────────────────────────────────────────────────
// REMAP HELPER
// ─────────────────────────────────────────────────────────────
export const buildMappedRow = (row) => {
  const gid = Number(row.rm_group_id);

  if (gid === 55) {
    return {
      _A: row.gm_date,
      _B: row.start_mixed_date,
      _C: row.rmit_date,
      _D: null, _E: null, _D3: null, _E3: null,
      _F: row.sc_pack_date,
    };
  }

  if (gid === 85 || gid === 49 || gid === 82) {
    const colA = (row.out_cold_date && row.out_cold_date !== '-' && row.out_cold_date !== null)
      ? row.out_cold_date
      : (row.rmit_date_mix ?? null);
    return {
      _A: colA,
      _B: row.start_mixed_date,
      _C: row.rmit_date,
      _D: null, _E: null, _D3: null, _E3: null,
      _F: row.sc_pack_date,
    };
  }

  if (gid === 46) {
    return {
      _A: null,
      _B: row.rmit_date,
      _C: null,
      _D: null,
      _E: null,
      _D3: null,
      _E3: null,
      _F: row.sc_pack_date,
    };
  }

  return {
    _A: row.rmit_date,
    _B: row.come_cold_date,
    _C: row.out_cold_date,
    _D: row.come_cold_date_two,
    _E: row.out_cold_date_two,
    _D3: row.come_cold_date_three,
    _E3: row.out_cold_date_three,
    _F: row.sc_pack_date,
  };
};

export const getRemappedRow = (row) => { const m = buildMappedRow(row); ROW_OF.set(m, row); return m; };

export const isSpecialGroup = (row) => {
  const gid = Number(row.rm_group_id);
  return gid === 55 || gid === 85 || gid === 49 || gid === 46  || gid === 82;
};

// รวม cold storage pairs ทั้ง 6 คู่ → เรียงตามวันที่เข้า
export const getSortedColdStoragePairs = (row) => {
  const candidates = [
    { in: row.come_cold_date,           out: row.out_cold_date           },
    { in: row.come_cold_date_two,       out: row.out_cold_date_two       },
    { in: row.come_cold_date_three,     out: row.out_cold_date_three     },
    { in: row.cs_come_cold_date,        out: row.cs_out_cold_date        },
    { in: row.cs_come_cold_date_two,    out: row.cs_out_cold_date_two    },
    { in: row.cs_come_cold_date_three,  out: row.cs_out_cold_date_three  },
  ].filter(p => p.in && p.in !== '-');

  candidates.sort((a, b) => {
    const da = new Date(a.in);
    const db = new Date(b.in);
    if (isNaN(da)) return 1;
    if (isNaN(db)) return -1;
    return da - db;
  });

  while (candidates.length < 6) candidates.push({ in: null, out: null });
  return candidates;
};

// ─────────────────────────────────────────────────────────────
// COLUMN WIDTHS
// ─────────────────────────────────────────────────────────────
export const CUSTOM_COLUMN_WIDTHS = {
  delayTime: '180px',
  weight: '120px',
  prepDateTime: '200px',
  confirm: '90px',
  cart: '70px',
  complete: '70px',
  edit: '70px',
  delete: '70px'
};

// ─────────────────────────────────────────────────────────────
// DATE HELPERS
// ─────────────────────────────────────────────────────────────
export const formatDateOnly = (dateTime) => {
  if (!dateTime || dateTime === '-') return '';
  return dateTime.split(' ')[0];
};

export const calculateMinutesDifference = (startDate, endDate) => {
  if (!startDate || startDate === '-' || !endDate || endDate === '-') return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  const diffInMinutes = (end - start) / (1000 * 60);
  return diffInMinutes >= 0 ? diffInMinutes : null;
};

export const formatMinutesToTime = (minutes) => {
  if (minutes === null || minutes === undefined) return '-';
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  let timeString = '';
  if (hours > 0) timeString += `${hours} h`;
  if (mins > 0) {
    if (timeString) timeString += ' ';
    timeString += `${mins} m`;
  }
  return timeString || '-';
};

// ─────────────────────────────────────────────────────────────
// DATETIME 24H HELPERS
// ─────────────────────────────────────────────────────────────
export const splitDateTimeParts = (val) => {
  if (!val || val === '-') return { date: '', hour: '', minute: '' };
  const s = String(val).replace('T', ' ').split('.')[0];
  const parts = s.split(' ');
  if (parts.length < 2) return { date: parts[0] || '', hour: '', minute: '' };
  const timeParts = parts[1].split(':');
  return {
    date: parts[0],
    hour: timeParts[0] || '',
    minute: timeParts[1] || '',
  };
};

export const joinDateTimeParts = (date, hour, minute) => {
  if (!date) return null;
  const h = (hour || '00').padStart(2, '0');
  const m = (minute || '00').padStart(2, '0');
  return `${date} ${h}:${m}:00`;
};

// ─────────────────────────────────────────────────────────────
// DBS CALCULATIONS
// ─────────────────────────────────────────────────────────────
export const calculateDBS1FromMapped = (mapped, row) => {
  const gid = Number(row.rm_group_id);
  if (gid === 49 || gid === 85 || gid === 46 || gid === 82) return '-';
  return formatMinutesToTime(calculateMinutesDifference(mapped._A, mapped._B));
};

export const CS_WAIT_ROUNDS = [
  { come: 'cs_come_cold_date',       out: 'cs_out_cold_date',       p1: 'at_pd_storage_purpose',   p2: 'storage_purpose'   },
  { come: 'cs_come_cold_date_two',   out: 'cs_out_cold_date_two',   p1: 'at_pd_storage_purpose_2', p2: 'storage_purpose_2' },
  { come: 'cs_come_cold_date_three', out: 'cs_out_cold_date_three', p1: 'at_pd_storage_purpose_3', p2: 'storage_purpose_3' },
];
export const CS_WAIT_PURPOSE = 'ฝากเก็บเพื่อรอผลิต';

export const getCsWaitMinutes = (row) => {
  if (!row) return 0;
  let total = 0;
  CS_WAIT_ROUNDS.forEach(({ come, out, p1, p2 }) => {
    if (row[p1] === CS_WAIT_PURPOSE || row[p2] === CS_WAIT_PURPOSE) {
      const mins = calculateMinutesDifference(row[come], row[out]);
      if (mins !== null) total += mins;
    }
  });
  return total;
};

export const calculateDBS2FromMapped = (mapped, isSpecial = false) => {
  if (isSpecial) return '-';
  const min = insideColdMinutes(mapped);
  return min === null ? '-' : formatMinutesToTime(min);
};

export const calculateDBS3FromMapped = (mapped, isSpecial = false) => {
  if (isSpecial) return '-';
  const min = calcDBS3Minutes(mapped, false);
  return min === null ? '-' : formatMinutesToTime(min);
};

export const calculateDBS4FromMapped = (mapped, isSpecial = false, row = null) => {
  const gid = Number(row?.rm_group_id);

  if (gid === 46) {
    return formatMinutesToTime(calculateMinutesDifference(mapped._B, mapped._F));
  }

  if (isSpecial) {
    const part2 = calculateMinutesDifference(mapped._C, mapped._F);
    if (part2 !== null) return formatMinutesToTime(part2);
    return formatMinutesToTime(calculateMinutesDifference(mapped._A, mapped._F));
  }

  const min1 = calcDBS1Minutes(mapped, row);
  const min3 = calcDBS3Minutes(mapped, isSpecial);

  // ✅ ถ้า DBS1 และ DBS3 ไม่มีค่าทั้งคู่ → ใช้ _A ถึง _F
  if (min1 === null && min3 === null) {
    return formatMinutesToTime(calculateMinutesDifference(mapped._A, mapped._F));
  }

  if (min1 !== null && min3 !== null) return formatMinutesToTime(min1 + min3);
  if (min1 !== null) return formatMinutesToTime(min1);
  if (min3 !== null) return formatMinutesToTime(min3);
  return '-';
};

export const calcDBS4Minutes = (mapped, isSpecial, row = null) => {
  const gid = Number(row?.rm_group_id);

  if (gid === 46) {
    return calculateMinutesDifference(mapped._B, mapped._F);
  }

  if (isSpecial) {
    const p2 = calculateMinutesDifference(mapped._C, mapped._F);
    if (p2 !== null) return p2;
    return calculateMinutesDifference(mapped._A, mapped._F);
  }

  const min1 = calcDBS1Minutes(mapped, row);
  const min3 = calcDBS3Minutes(mapped, isSpecial);

  // ✅ ถ้า DBS1 และ DBS3 ไม่มีค่าทั้งคู่ → ใช้ rmit_date (_A) ถึง sc_pack_date (_F)
  if (min1 === null && min3 === null) {
    return calculateMinutesDifference(mapped._A, mapped._F);
  }

  if (min1 !== null && min3 !== null) return min1 + min3;
  if (min1 !== null) return min1;
  if (min3 !== null) return min3;
  return null;
};

export const calcDBS1Minutes = (mapped, row) => {
  const gid = Number(row.rm_group_id);
  if (gid === 49 || gid === 85 || gid === 46 || gid === 82) return null;
  return calculateMinutesDifference(mapped._A, mapped._B);
};

export const calcDBS2Minutes = (mapped, isSpecial) => {
  if (isSpecial) return null;
  return insideColdMinutes(mapped);
};

// Cold rooms (small + big, up to 7 stays) sorted by time in. DBS2 = the time spent IN them, DBS3 = the time OUTSIDE them after the first exit:
//   DBS2 = (in 1 -> out 1) + (in 2 -> out 2) + ...      DBS3 = (out 1 -> in 2) + (out 2 -> in 3) + ... + (last out -> packed)
// so DBS1 + DBS2 + DBS3 = the whole time from "prep finished" to "packed". A stay that is still open counts up to now only on a live row (mapped._now).
export const ROW_OF = new WeakMap(); // mapped row -> the row it was made from
export const sortedColdStays = (mapped) => {
  const row = ROW_OF.get(mapped);
  if (!row) return [];
  const pairs = [
    { in: row.come_cold_date, out: row.out_cold_date },
    { in: row.come_cold_date_two, out: row.out_cold_date_two },
    { in: row.come_cold_date_three, out: row.out_cold_date_three },
    { in: row.cs_come_cold_date, out: row.cs_out_cold_date },
    { in: row.cs_come_cold_date_two, out: row.cs_out_cold_date_two },
    { in: row.cs_come_cold_date_three, out: row.cs_out_cold_date_three },
    { in: row.cs_come_cold_date_four, out: row.cs_out_cold_date_four },
  ].filter((p) => p.in && p.in !== '-');
  pairs.sort((a, b) => { const da = new Date(a.in); const db = new Date(b.in); return (isNaN(da) ? 1 : 0) - (isNaN(db) ? 1 : 0) || da - db; });
  return pairs;
};
export const insideColdMinutes = (mapped) => {
  let total = 0; let has = false;
  sortedColdStays(mapped).forEach((p) => {
    const out = p.out && p.out !== '-' ? p.out : mapped._now;
    const d = out ? calculateMinutesDifference(p.in, out) : null;
    if (d !== null) { total += d; has = true; }
  });
  return has ? total : null;
};
export const outsideColdMinutes = (mapped) => {
  const pairs = sortedColdStays(mapped);
  if (!pairs.length) return null;
  let total = 0; let has = false;
  for (let i = 0; i < pairs.length; i += 1) {
    const out = pairs[i].out;
    if (!out || out === '-') break; // still in a cold room: nothing is counted after it
    const next = i + 1 < pairs.length ? pairs[i + 1].in : mapped._F;
    const gap = calculateMinutesDifference(out, next);
    if (gap !== null) { total += gap; has = true; }
  }
  return has ? total : null;
};

export const calcDBS3Minutes = (mapped, isSpecial) => {
  if (isSpecial) return null;
  const min = outsideColdMinutes(mapped);
  return min === null ? null : (min >= 0 ? min : 0);
};

export const parseStandardDBSToMinutes = (val) => {
  if (val === null || val === undefined || val === '-' || val === '') return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n * 60;
};

export const calculateDBS1 = (row) => calculateDBS1FromMapped(getRemappedRow(row), row);
export const calculateDBS2 = (row) => calculateDBS2FromMapped(getRemappedRow(row), isSpecialGroup(row), row);
export const calculateDBS3 = (row) => calculateDBS3FromMapped(getRemappedRow(row), isSpecialGroup(row));
export const calculateDBS4 = (row) => calculateDBS4FromMapped(getRemappedRow(row), isSpecialGroup(row), row);
