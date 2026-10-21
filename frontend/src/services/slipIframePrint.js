// Slips are printed as ONE piece as long as their data (no fixed paper length).
// window.print() of a slip screen (a ".print-container" / ".print-content" box) is turned into: copy the slip into a hidden iframe,
// apply the "@media print" styles of the page there as normal styles (so the iframe is laid out exactly as the slip will print),
// shrink the lines that would wrap (one line per field), measure the real height, then print the iframe with
// "@page { size: 80mm <height>mm }" — the paper is as long as the slip, never cut at 297 mm and never split into pages.
// Anything else (A3 reports, the label slips of Pack, the slips of /other and of broth that print their own element) keeps the normal print.

const ROOT_SELECTOR = ".print-container, .print-content";
const PAPER_MM = 80;
const PX_PER_MM = 96 / 25.4;
const MIN_FONT_PX = 6;
const EXTRA_MM = 4; // a little paper after the last line (the cutter sits above the print head)

const nativePrint = typeof window !== "undefined" ? window.print.bind(window) : null;

const visible = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));

/** the slip box on screen: in the top open dialog, else on the page; null = not a slip screen */
export const findSlipRoot = () => {
  // pages that print their own element outside the dialog
  if (document.querySelector(".other-print-root > *") || document.getElementById("__broth_slip__")) return null;
  const dialogs = [...document.querySelectorAll(".MuiDialog-root:not(.MuiModal-hidden)")].filter(visible);
  const scope = dialogs.length ? dialogs[dialogs.length - 1] : document;
  const roots = [...scope.querySelectorAll(ROOT_SELECTOR)].filter(visible);
  return roots.length ? roots[roots.length - 1] : null;
};

/** CSS of the page with "@media print" turned on (its rules unwrapped) and without any @page rule */
const collectCss = () => {
  const links = [];
  const out = [];
  const isPrint = (mediaText) => /\bprint\b/i.test(mediaText) && !/not\s+print/i.test(mediaText);
  const walk = (rules) => {
    for (const r of rules) {
      if (r.type === CSSRule.PAGE_RULE) continue;
      if (r.type === CSSRule.MEDIA_RULE) {
        if (isPrint(r.media.mediaText)) walk(r.cssRules);
        else if (!/^\s*screen\s*$/i.test(r.media.mediaText)) out.push(r.cssText); // width queries: the iframe is 80 mm wide like the printed page
        continue;
      }
      out.push(r.cssText);
    }
  };
  for (const sheet of document.styleSheets) {
    const media = sheet.media ? sheet.media.mediaText : "";
    if (media && !isPrint(media) && !/all/i.test(media)) continue; // a screen-only sheet
    let rules;
    try { rules = sheet.cssRules; } catch { rules = null; }
    if (!rules) { if (sheet.href) links.push(`<link rel="stylesheet" href="${sheet.href}">`); continue; } // cross-origin (fonts)
    walk(rules);
  }
  return { links: links.join("\n"), css: out.join("\n") };
};

/** the slip as HTML: canvases (QR) become pictures, buttons / .no-print parts are left out */
const slipMarkup = (root) => {
  const copy = root.cloneNode(true);
  const live = root.querySelectorAll("canvas");
  copy.querySelectorAll("canvas").forEach((cv, i) => {
    try {
      const img = document.createElement("img");
      img.src = live[i].toDataURL("image/png");
      img.setAttribute("style", cv.getAttribute("style") || "");
      img.width = live[i].clientWidth || live[i].width;
      img.height = live[i].clientHeight || live[i].height;
      cv.replaceWith(img);
    } catch (err) { console.error("[slipIframePrint] canvas to image error:", err); }
  });
  copy.querySelectorAll(".no-print, button, .MuiDialogActions-root, input, textarea, select").forEach((n) => n.remove());
  return copy.outerHTML;
};

/** one line per field: a ".print-text" / ".print-title" line that would wrap gets a smaller font (measured in the real print layout) */
const fitLines = (doc) => {
  doc.querySelectorAll(".print-text, .print-title").forEach((line) => {
    const text = (line.innerText || "").trim();
    if (!text || text.includes("\n")) return;
    line.style.setProperty("white-space", "nowrap", "important");
    const over = line.scrollWidth - line.clientWidth;
    if (over <= 0 || !line.clientWidth) return;
    const fontPx = parseFloat(doc.defaultView.getComputedStyle(line).fontSize) || 12;
    const size = (fontPx * line.clientWidth) / line.scrollWidth * 0.98;
    if (size < MIN_FONT_PX) { line.style.removeProperty("white-space"); return; } // still too long: let it wrap
    line.style.setProperty("font-size", `${size.toFixed(2)}px`, "important");
  });
};

const waitLoaded = async (win) => {
  const doc = win.document;
  try { if (doc.fonts && doc.fonts.ready) await doc.fonts.ready; } catch { /* no font api */ }
  await Promise.all([...doc.images].map((img) => (img.complete ? null : new Promise((ok) => { img.onload = ok; img.onerror = ok; }))));
  await new Promise((ok) => win.requestAnimationFrame(() => win.requestAnimationFrame(ok)));
};

export const printInIframe = async (root) => {
  const { links, css } = collectCss();
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAPER_MM}mm;height:100px;border:0;opacity:0;pointer-events:none;`;
  document.body.appendChild(frame);
  try {
    const win = frame.contentWindow;
    const doc = win.document;
    doc.open();
    doc.write(`<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"><base href="${window.location.origin}/">${links}
<style>${css}</style>
<style>html, body { margin: 0 !important; padding: 0 !important; width: ${PAPER_MM}mm !important; height: auto !important; overflow: visible !important; background: #fff !important; }
body::before { display: none !important; }</style>
</head><body>${slipMarkup(root)}</body></html>`);
    doc.close();
    await waitLoaded(win);
    fitLines(doc);
    const heightPx = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight, doc.body.getBoundingClientRect().height);
    const heightMm = Math.ceil(heightPx / PX_PER_MM) + EXTRA_MM;
    const page = doc.createElement("style");
    page.textContent = `@page { size: ${PAPER_MM}mm ${heightMm}mm; margin: 0; }`;
    doc.head.appendChild(page);
    doc.title = document.title;
    win.focus();
    win.print(); // blocks until the print dialog is closed
  } finally {
    setTimeout(() => frame.remove(), 1000);
    // slip screens close themselves on "afterprint" of the page: the iframe printed instead of the page, so tell them
    try { window.dispatchEvent(new Event("afterprint")); } catch { /* old browser */ }
  }
};

if (typeof window !== "undefined" && nativePrint && !window.print.__pfcmSlip) {
  const patched = () => {
    let root = null;
    try { root = findSlipRoot(); } catch (err) { console.error("[slipIframePrint] find slip error:", err); }
    if (!root) { nativePrint(); return; }
    printInIframe(root).catch((err) => {
      console.error("[slipIframePrint] print error, normal print instead:", err);
      nativePrint();
    });
  };
  patched.__pfcmSlip = true;
  window.print = patched;
}
