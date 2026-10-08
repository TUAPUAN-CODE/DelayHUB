// DBS1–DBS4 (delay time) — ported verbatim from the Report page (Pack/ReportRawmatNotEditTIME/Asset/Table.jsx) so the numbers match it.
// DBS1 = prep -> cold, DBS2 = time in cold rooms (+ waiting-for-production deposits), DBS3 = cold -> packed, DBS4 = total.
// Standards (hours) come from the row: DBS1..DBS4.

const getRemappedRow = (row) => {
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

const isSpecialGroup = (row) => {
  const gid = Number(row.rm_group_id);
  return gid === 55 || gid === 85 || gid === 49 || gid === 46  || gid === 82;
};

// ─────────────────────────────────────────────────────────────
// DATE HELPERS
// ─────────────────────────────────────────────────────────────
const formatDateOnly = (dateTime) => {
  if (!dateTime || dateTime === '-') return '';
  return dateTime.split(' ')[0];
};

const calculateMinutesDifference = (startDate, endDate) => {
  if (!startDate || startDate === '-' || !endDate || endDate === '-') return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  const diffInMinutes = (end - start) / (1000 * 60);
  return diffInMinutes >= 0 ? diffInMinutes : null;
};

const formatMinutesToTime = (minutes) => {
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
// DBS CALCULATIONS
// ─────────────────────────────────────────────────────────────
const calculateDBS1FromMapped = (mapped, row) => {
  const gid = Number(row.rm_group_id);
  if (gid === 49 || gid === 85 || gid === 46 || gid === 82) return '-';
  return formatMinutesToTime(calculateMinutesDifference(mapped._A, mapped._B));
};

const CS_WAIT_ROUNDS = [
  { come: 'cs_come_cold_date',       out: 'cs_out_cold_date',       p1: 'at_pd_storage_purpose',   p2: 'storage_purpose'   },
  { come: 'cs_come_cold_date_two',   out: 'cs_out_cold_date_two',   p1: 'at_pd_storage_purpose_2', p2: 'storage_purpose_2' },
  { come: 'cs_come_cold_date_three', out: 'cs_out_cold_date_three', p1: 'at_pd_storage_purpose_3', p2: 'storage_purpose_3' },
];
const CS_WAIT_PURPOSE = 'ฝากเก็บเพื่อรอผลิต';

const getCsWaitMinutes = (row) => {
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

const calculateDBS2FromMapped = (mapped, isSpecial = false, row = null) => {
  if (isSpecial) return '-';
  let totalMinutes = 0;
  let hasData = false;
  const cold1 = calculateMinutesDifference(mapped._B, mapped._C);
  if (cold1 !== null) { totalMinutes += cold1; hasData = true; }
  if (mapped._D && mapped._E) {
    const cold2 = calculateMinutesDifference(mapped._D, mapped._E);
    if (cold2 !== null) { totalMinutes += cold2; hasData = true; }
  }
  if (mapped._D3 && mapped._E3) {
    const cold3 = calculateMinutesDifference(mapped._D3, mapped._E3);
    if (cold3 !== null) { totalMinutes += cold3; hasData = true; }
  }
  const csMin = getCsWaitMinutes(row);
  if (csMin > 0) { totalMinutes += csMin; hasData = true; }
  return hasData ? formatMinutesToTime(totalMinutes) : '-';
};

const calculateDBS3FromMapped = (mapped, isSpecial = false) => {
  if (isSpecial) return '-';

  // รวมเวลาในห้องเย็นทุกรอบที่มี (round 2 และ round 3)
  let totalColdMinutes = 0;

  if (mapped._D && mapped._D !== '-' && mapped._E && mapped._E !== '-') {
    const cold2 = calculateMinutesDifference(mapped._D, mapped._E);
    if (cold2 !== null) totalColdMinutes += cold2;
  }

  if (mapped._D3 && mapped._D3 !== '-' && mapped._E3 && mapped._E3 !== '-') {
    const cold3 = calculateMinutesDifference(mapped._D3, mapped._E3);
    if (cold3 !== null) totalColdMinutes += cold3;
  }

  const fc = calculateMinutesDifference(mapped._C, mapped._F);
  if (fc === null) return '-';

  const result = fc - totalColdMinutes;
  return formatMinutesToTime(result >= 0 ? result : 0);
};

const calculateDBS4FromMapped = (mapped, isSpecial = false, row = null) => {
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

const calcDBS4Minutes = (mapped, isSpecial, row = null) => {
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

const calcDBS1Minutes = (mapped, row) => {
  const gid = Number(row.rm_group_id);
  if (gid === 49 || gid === 85 || gid === 46 || gid === 82) return null;
  return calculateMinutesDifference(mapped._A, mapped._B);
};

const calcDBS2Minutes = (mapped, isSpecial, row = null) => {
  if (isSpecial) return null;
  let total = 0; let has = false;
  const c1 = calculateMinutesDifference(mapped._B, mapped._C);
  if (c1 !== null) { total += c1; has = true; }
  if (mapped._D && mapped._E) {
    const c2 = calculateMinutesDifference(mapped._D, mapped._E);
    if (c2 !== null) { total += c2; has = true; }
  }
  if (mapped._D3 && mapped._E3) {
    const c3 = calculateMinutesDifference(mapped._D3, mapped._E3);
    if (c3 !== null) { total += c3; has = true; }
  }
  const csMin = getCsWaitMinutes(row);
  if (csMin > 0) { total += csMin; has = true; }
  return has ? total : null;
};

const calcDBS3Minutes = (mapped, isSpecial) => {
  if (isSpecial) return null;

  // รวมเวลาในห้องเย็นทุกรอบที่มี (round 2 และ round 3)
  let totalColdMinutes = 0;

  if (mapped._D && mapped._D !== '-' && mapped._E && mapped._E !== '-') {
    const cold2 = calculateMinutesDifference(mapped._D, mapped._E);
    if (cold2 !== null) totalColdMinutes += cold2;
  }

  if (mapped._D3 && mapped._D3 !== '-' && mapped._E3 && mapped._E3 !== '-') {
    const cold3 = calculateMinutesDifference(mapped._D3, mapped._E3);
    if (cold3 !== null) totalColdMinutes += cold3;
  }

  const fc = calculateMinutesDifference(mapped._C, mapped._F);
  if (fc === null) return null;

  const result = fc - totalColdMinutes;
  return result >= 0 ? result : 0;
};

const parseStandardDBSToMinutes = (val) => {
  if (val === null || val === undefined || val === '-' || val === '') return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n * 60;
};


const parseTimeToMinutes = (txt) => {
  // "2 h 5 m" -> minutes (used only when a calculation returns text without minutes)
  if (!txt || txt === '-') return null;
  const h = /(\d+)\s*h/.exec(txt);
  const m = /(\d+)\s*m/.exec(txt);
  return (h ? parseInt(h[1], 10) * 60 : 0) + (m ? parseInt(m[1], 10) : 0);
};

// ─────────────────────────────────────────────────────────────
// LIVE TIME (the clock of the stage a material is in keeps running until the next event)
//   DBS1  rmit_date  -> come_cold_date   (running from rmit_date until the material enters a cold room)
//   DBS2  come_cold_date -> out_cold_date (running while it is in a cold room)
//   DBS3  out_cold_date  -> sc_pack_date  (running after it left the cold room, until packing is finished)
//   DBS4  DBS1 + DBS3 (special groups: whole time to packing) — so it also grows with the stage the material is in
// A finished row (sc_pack_date / "บรรจุเสร็จ" / "สำเร็จ") never runs any more.
// ─────────────────────────────────────────────────────────────
const isFinished = (row) => Boolean(row.sc_pack_date) || String(row.rm_status || '') === 'สำเร็จ' || String(row.dest || '').startsWith('บรรจุเสร็จ');

const applyLive = (m, row, nowD) => {
  if (isFinished(row)) return;
  const gid = Number(row.rm_group_id);
  if (isSpecialGroup(row)) {
    if (!m._F && (gid === 46 ? m._B : (m._C || m._A))) m._F = nowD;
    return;
  }
  if (m._A && !m._B && !m._C && !m._F) { m._B = nowD; return; }   // DBS1 running
  if (m._B && !m._C) { m._C = nowD; return; }                      // DBS2 running (first stay in a cold room)
  if (m._C && !m._F) {                                              // DBS3 running (a second / third stay in a cold room that is still open is counted up to now too)
    if (m._D && !m._E) m._E = nowD;
    if (m._D3 && !m._E3) m._E3 = nowD;
    m._F = nowD;
  }
};

/** [{text, minutes, std, over}] for DBS1..DBS4 of a mapping row (over = longer than the standard of its raw material group). `now` (ms or Date) makes the running stage count up to the present. */
export const getDbs = (row, now = null) => {
  const mapped = getRemappedRow(row);
  if (now) applyLive(mapped, row, new Date(now));
  const special = isSpecialGroup(row);
  const std = [row.DBS1, row.DBS2, row.DBS3, row.DBS4].map(parseStandardDBSToMinutes);
  const mins = [
    calcDBS1Minutes(mapped, row),
    calcDBS2Minutes(mapped, special, row),
    calcDBS3Minutes(mapped, special),
    calcDBS4Minutes(mapped, special, row),
  ];
  const texts = [
    calculateDBS1FromMapped(mapped, row),
    calculateDBS2FromMapped(mapped, special, row),
    calculateDBS3FromMapped(mapped, special),
    calculateDBS4FromMapped(mapped, special, row),
  ];
  return texts.map((text, i) => {
    const minutes = mins[i] ?? parseTimeToMinutes(text);
    const skip = (i === 1 || i === 2) && special; // special groups have no DBS2/DBS3 standard
    return { text, minutes, std: skip ? null : std[i], over: !skip && std[i] !== null && minutes !== null && minutes > std[i] };
  });
};
