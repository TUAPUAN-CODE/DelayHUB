// The lookup of the i18n dictionary (Thai text -> [English, Burmese, Khmer]), with no DOM / Vite code:
// the translator (translator.js) uses it on the screen, and scripts/check-i18n.mjs uses the same rules to list the texts that are missing.
//   "{n}" in a key = a number · "{x}" = any value the code puts in (a date, a trolley, a name ...);
//   a translation may use "{x1}" "{x2}" ... when the values come in another order than in Thai.
export const TH_RE = /[ก-๙]/;
const NUM_RE = /\d+(?:[.,]\d+)*/g;
// pieces put together by the code: " · ", " — ", " | ", new lines
const PART_SEP = /(\s+[·•|—]\s+|\n+)/;
// "label: value" put together by the code ("เกิดข้อผิดพลาด: " + err.message); the label ends with no digit, so a time (07:36) is not cut
const LABEL_VALUE = /^([^:：]*[ก-๙][^:：]*?[^\d\s:：])\s*([:：])\s*([\s\S]+)$/;
// "text (12)": a count the code puts after a text (a tab, a title ...)
const COUNT = /^([\s\S]*?[^\s(])(\s*\(\d[\d,.]*\))$/;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// no Burmese / Khmer text yet: the English one
const pick = (hit, col) => (hit[col] != null ? hit[col] : col > 0 && hit[0] != null ? hit[0] : null);

/**
 * lookup(core, col) -> the translation of a trimmed text, or null when the dictionary does not know it.
 * col: 0 = English, 1 = Burmese, 2 = Khmer. `onPieceMissing(piece)` hears the Thai pieces that stay untranslated.
 */
export const createLookup = (dictionary, { onPieceMissing } = {}) => {
  // keys with "{x}", the most specific (longest fixed text) first; the longest Thai piece of the key is checked with includes() before the RegExp
  const wild = Object.keys(dictionary)
    .filter((k) => k.includes("{x}") && TH_RE.test(k))
    .map((k) => {
      const parts = k.split("{x}");
      const anchor = parts.filter((p) => TH_RE.test(p)).map((p) => p.trim()).sort((a, b) => b.length - a.length)[0];
      return { re: new RegExp(`^${parts.map(escapeRe).join("([\\s\\S]+?)")}$`), anchor, out: dictionary[k], size: parts.join("").length };
    })
    .sort((a, b) => b.size - a.size);

  const plain = (core, col) => {
    const hit = dictionary[core];
    if (hit) { const t = pick(hit, col); if (t != null) return t; }
    const nums = core.match(NUM_RE);
    if (nums) {
      const t = dictionary[core.replace(NUM_RE, "{n}")];
      const text = t ? pick(t, col) : null;
      if (text != null) {
        let i = 0;
        return text.replace(/\{n\}/g, () => nums[Math.min(i++, nums.length - 1)]);
      }
    }
    return null;
  };

  // a Thai value the dictionary knows (a status, a room ...) is translated too; one it does not know (a name, a Thai date ...)
  // fails the key, unless `loose` (the last try of lookup(), after the label / pieces rules had their turn)
  const wildcard = (core, col, loose) => {
    for (const w of wild) {
      if (!core.includes(w.anchor)) continue;
      const m = core.match(w.re);
      if (!m) continue;
      const out = pick(w.out, col);
      if (out == null) continue;
      const vals = [];
      let known = true;
      for (const v of m.slice(1)) {
        const c = v.trim();
        const t = c && TH_RE.test(c) ? plain(c, col) : null;
        if (t == null && c && TH_RE.test(c) && !loose) { known = false; break; }
        vals.push(t != null ? v.replace(c, t) : v);
      }
      if (!known) continue;
      let i = 0;
      return out.replace(/\{x(\d*)\}/g, (_, d) => (d ? vals[Number(d) - 1] ?? "" : vals[i++] ?? ""));
    }
    return null;
  };

  const core1 = (core, col, loose) => plain(core, col) ?? wildcard(core, col, loose);

  // "label :" / "label:" / "text (12)"
  const labelled = (core, col, loose = false) => {
    const hit = core1(core, col, loose);
    if (hit !== null) return hit;
    const m = core.match(/^([\s\S]*?)\s*([:：])$/);
    if (m && m[1]) {
      const t = core1(m[1], col, loose);
      if (t !== null) return t + m[2];
    }
    const c = core.match(COUNT);
    if (c) {
      const t = core1(c[1], col, loose);
      if (t !== null) return t + c[2];
    }
    return null;
  };

  const lookup = (core, col) => {
    const out = labelled(core, col);
    if (out !== null) return out;
    const lv = core.match(LABEL_VALUE);
    if (lv) {
      const label = core1(lv[1], col);
      if (label !== null) {
        const v = lv[3];
        const vt = TH_RE.test(v) ? lookup(v.trim(), col) : null;
        return `${label}${lv[2]} ${vt ?? v}`;
      }
    }
    if (PART_SEP.test(core)) {
      const pieces = core.split(PART_SEP);
      const unknown = [];
      let changed = false;
      const res = pieces.map((p, i) => {
        const c = p.trim();
        if (i % 2 === 1 || !c || !TH_RE.test(c)) return p; // a separator / no Thai
        const t = labelled(c, col) ?? (LABEL_VALUE.test(c) ? lookup(c, col) : null) ?? labelled(c, col, true);
        if (t === null) { unknown.push(c); return p; }
        changed = true;
        return p.replace(c, t);
      });
      if (changed) {
        if (onPieceMissing) unknown.forEach(onPieceMissing);
        return res.join("");
      }
    }
    return labelled(core, col, true);
  };

  return lookup;
};
