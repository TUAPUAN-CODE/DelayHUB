// Slip lines on one line: when a slip is printed, every ".print-text" / ".print-title" line of the slip that would wrap at the paper width
// (80 mm, see index.css --slip-zoom) gets a smaller font size, just enough for the whole line to fit, and no wrap.
// Lines that already fit keep their size. Everything is put back after printing.
//
// The print sizes are not visible on screen (they come from "@media print" rules: the slip modals' own <style> and MUI sx '@media print'),
// so they are read from the style sheets, and the text width is measured with a canvas (no layout needed).

const LINE_SELECTOR = ".print-text, .print-title";
const ROOT_SELECTOR = ".print-container, .print-content, .other-slip";
const PAPER_MM = 80;
const MM_PX = 96 / 25.4;
const MIN_FONT_PX = 6;
const SAFETY = 0.97; // keep a little room: fonts / rounding differ slightly between canvas and print

let changed = [];
let canvas = null;

const printRules = () => {
  const out = [];
  const walk = (rules, inPrint) => {
    for (const r of rules) {
      if (r.type === CSSRule.MEDIA_RULE) {
        const m = r.media.mediaText.toLowerCase();
        walk(r.cssRules, inPrint || (m.includes("print") && !m.includes("not print")));
      } else if (r.type === CSSRule.STYLE_RULE && inPrint) out.push(r);
    }
  };
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; } // cross-origin sheet (fonts)
    const sheetPrint = sheet.media && sheet.media.mediaText.toLowerCase().includes("print");
    walk(rules, sheetPrint);
  }
  return out;
};

/** value of a CSS property for el under "@media print": !important beats normal, the later rule beats the earlier one */
const printValue = (rules, el, prop) => {
  let best = null;
  let bestImportant = false;
  for (const r of rules) {
    let hit = false;
    try { hit = el.matches(r.selectorText); } catch { hit = false; }
    if (!hit) continue;
    const v = r.style.getPropertyValue(prop);
    if (!v) continue;
    const imp = r.style.getPropertyPriority(prop) === "important";
    if (imp || !bestImportant) { best = v; bestImportant = imp; }
  }
  return best;
};

const px = (v, fontPx) => {
  if (!v) return 0;
  const n = parseFloat(v);
  if (Number.isNaN(n)) return 0;
  if (v.endsWith("mm")) return n * MM_PX;
  if (v.endsWith("em") && !v.endsWith("rem")) return n * fontPx;
  if (v.endsWith("rem")) return n * 16;
  return n; // px
};

/** horizontal space taken by el (margin + padding + border) in print, falling back to the screen value for padding/border */
const sideSpace = (rules, el, fontPx) => {
  const cs = getComputedStyle(el);
  let sum = 0;
  ["left", "right"].forEach((side) => {
    const m = printValue(rules, el, `margin-${side}`);
    sum += m !== null ? px(m, fontPx) : 0;
    const p = printValue(rules, el, `padding-${side}`);
    sum += px(p !== null ? p : cs.getPropertyValue(`padding-${side}`), fontPx);
    sum += px(cs.getPropertyValue(`border-${side}-width`), fontPx);
  });
  return sum;
};

const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);

const fitLines = () => {
  restore();
  const roots = [...document.querySelectorAll(ROOT_SELECTOR)].filter(visible);
  if (!roots.length) return;
  const rules = printRules();
  const zoom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--slip-zoom")) || 1;
  canvas = canvas || document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  roots.forEach((root) => {
    const rootWidth = (PAPER_MM * MM_PX) / zoom; // index.css: the slip box is 80 mm / --slip-zoom wide, zoomed back to 80 mm
    root.querySelectorAll(LINE_SELECTOR).forEach((line) => {
      const text = (line.innerText || "").trim();
      if (!text || text.includes("\n")) return; // a block of several lines on purpose
      const cs = getComputedStyle(line);
      const fontPx = px(printValue(rules, line, "font-size") || cs.fontSize, 16) || 12;
      const weight = printValue(rules, line, "font-weight") || cs.fontWeight;
      let avail = rootWidth - sideSpace(rules, line, fontPx);
      for (let p = line.parentElement; p && p !== root && root.contains(p); p = p.parentElement) avail -= sideSpace(rules, p, fontPx);
      if (avail <= 20) return;
      ctx.font = `${cs.fontStyle} ${weight} ${fontPx}px ${cs.fontFamily}`;
      const spacing = px(cs.letterSpacing === "normal" ? "0" : cs.letterSpacing, fontPx) * text.length;
      const width = ctx.measureText(text).width + spacing;
      const room = avail * SAFETY;
      const prev = { el: line, fontSize: line.style.getPropertyValue("font-size"), fontPrio: line.style.getPropertyPriority("font-size"), ws: line.style.getPropertyValue("white-space"), wsPrio: line.style.getPropertyPriority("white-space") };
      if (width > room) {
        const size = Math.max(MIN_FONT_PX, Math.floor(((fontPx * room) / width) * 10) / 10);
        if (size <= MIN_FONT_PX && (width * MIN_FONT_PX) / fontPx > room) return; // would still not fit at the smallest size: let it wrap
        line.style.setProperty("font-size", `${size}px`, "important");
      }
      line.style.setProperty("white-space", "nowrap", "important");
      changed.push(prev);
    });
  });
};

function restore() {
  changed.forEach(({ el, fontSize, fontPrio, ws, wsPrio }) => {
    if (fontSize) el.style.setProperty("font-size", fontSize, fontPrio); else el.style.removeProperty("font-size");
    if (ws) el.style.setProperty("white-space", ws, wsPrio); else el.style.removeProperty("white-space");
  });
  changed = [];
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeprint", () => {
    try { fitLines(); } catch (err) { console.error("[slipFitLines] fit error:", err); }
  });
  window.addEventListener("afterprint", restore);
}
