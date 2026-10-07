/**
 * Times of one cold-room row, oldest first. A trolley can go in and out of the cold rooms many times:
 * the first three rounds are come_cold_date / out_cold_date (+ _two, _three), the next ones are cs_come_cold_date / cs_out_cold_date (+ _two … _ten).
 */
const IN_KEYS = ["come_cold_date", "come_cold_date_two", "come_cold_date_three", "cs_come_cold_date", "cs_come_cold_date_two", "cs_come_cold_date_three", "cs_come_cold_date_four",
  "cs_come_cold_date_five", "cs_come_cold_date_six", "cs_come_cold_date_seven", "cs_come_cold_date_eight", "cs_come_cold_date_nine", "cs_come_cold_date_ten"];
const OUT_KEYS = ["out_cold_date", "out_cold_date_two", "out_cold_date_three", "cs_out_cold_date", "cs_out_cold_date_two", "cs_out_cold_date_three", "cs_out_cold_date_four",
  "cs_out_out_date_five", "cs_out_cold_date_six", "cs_out_cold_date_seven", "cs_out_cold_date_eight", "cs_out_cold_date_nine", "cs_out_cold_date_ten"];

const stamp = (v) => String(v).replace(" ", "T");
const collect = (row, keys) => keys.map((k) => row?.[k]).filter(Boolean).sort((a, b) => stamp(a).localeCompare(stamp(b)));

export const comeTimes = (row) => collect(row, IN_KEYS);
export const outTimes = (row) => collect(row, OUT_KEYS);

/** "2026-10-07 08:15:00" → "07/10 08:15" */
export function shortTime(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(v ?? ""));
  return m ? `${m[3]}/${m[2]} ${m[4]}:${m[5]}` : String(v ?? "");
}
