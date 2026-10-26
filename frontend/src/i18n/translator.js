import { loadDictionary } from "./dict";
import { TH_RE, createLookup } from "./lookup";

export const LANGS = [
  { code: "th", label: "ไทย", short: "TH" },
  { code: "en", label: "English", short: "EN" },
  { code: "my", label: "မြန်မာ", short: "MY" },
  { code: "km", label: "ខ្មែរ", short: "KM" },
];
const IDX = { en: 0, my: 1, km: 2 };
const STORAGE_KEY = "pfcm_lang";
const ATTRS = ["placeholder", "title", "aria-label", "alt"];
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE"]);

let lang = "th"; // the default language of the system is Thai (a user who picked another language keeps it: saved on this device)
let observer = null;
const listeners = new Set();
const textRec = new WeakMap(); // Text node -> { orig, out }
const attrRec = new WeakMap(); // Element -> { [attr]: { orig, out } }
export const missing = new Set();
const noteMissing = (t) => { if (missing.size < 5000) missing.add(t); };

// The dictionary is downloaded the first time a language other than Thai is used: Thai — the language the screens are written in — needs none of it
// (it was in the first bundle of every page, and it grows with every screen)
let lookup = null;
let dictPromise = null;
const memo = new Map(); // "col|text" -> translation or null (the same texts come back in every row of a table)
const ensureDictionary = () => {
  if (!dictPromise) {
    dictPromise = loadDictionary()
      .then((d) => { lookup = createLookup(d, { onPieceMissing: noteMissing }); memo.clear(); })
      .catch((err) => { console.error("[i18n] dictionary load error:", err); dictPromise = null; });
  }
  return dictPromise;
};

export const getLang = () => lang;
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export const translate = (text, to = lang) => {
  if (to === "th" || !text || !lookup || !TH_RE.test(text)) return text;
  const lead = text.match(/^\s*/)[0];
  const trail = text.match(/\s*$/)[0];
  const core = text.trim();
  if (!core) return text;
  const key = `${IDX[to]}|${core}`;
  let out = memo.get(key);
  if (out === undefined) {
    out = lookup(core, IDX[to]);
    if (memo.size > 20000) memo.clear();
    memo.set(key, out);
  }
  if (out === null) { noteMissing(core); return text; }
  return lead + out + trail;
};

const skip = (el) => !el || SKIP_TAGS.has(el.tagName) || el.closest?.("[data-no-i18n],[contenteditable='true']");

const processText = (node) => {
  const parent = node.parentElement;
  if (skip(parent)) return;
  const cur = node.data;
  const rec = textRec.get(node);
  const orig = rec && cur === rec.out ? rec.orig : cur;
  const out = lang === "th" ? orig : translate(orig);
  if (out !== cur) node.data = out;
  textRec.set(node, { orig, out });
};

const processAttrs = (el) => {
  if (skip(el)) return;
  let recs = attrRec.get(el);
  for (const a of ATTRS) {
    if (!el.hasAttribute(a)) continue;
    const cur = el.getAttribute(a);
    const rec = recs?.[a];
    const orig = rec && cur === rec.out ? rec.orig : cur;
    const out = lang === "th" ? orig : translate(orig);
    if (out !== cur) el.setAttribute(a, out);
    if (!recs) { recs = {}; attrRec.set(el, recs); }
    recs[a] = { orig, out };
  }
};

const walk = (root) => {
  if (!root) return;
  if (root.nodeType === 3) return processText(root);
  if (root.nodeType !== 1) return;
  processAttrs(root);
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n = tw.nextNode();
  while (n) {
    if (n.nodeType === 3) processText(n); else processAttrs(n);
    n = tw.nextNode();
  }
};

let queue = new Set();
let scheduled = false;
const flush = () => {
  scheduled = false;
  const items = queue; queue = new Set();
  items.forEach((n) => { if (n.isConnected) walk(n); });
};
const enqueue = (n) => {
  queue.add(n);
  if (!scheduled) { scheduled = true; requestAnimationFrame(flush); }
};

const startObserver = () => {
  if (observer || typeof MutationObserver === "undefined") return;
  observer = new MutationObserver((muts) => {
    // Thai is the language the screens are written in: nothing to translate (setLang restores the originals when the user comes back to Thai).
    // Walking every node that React adds made big tables slow for everyone.
    if (lang === "th") return;
    for (const m of muts) {
      if (m.type === "childList") m.addedNodes.forEach(enqueue);
      else if (m.type === "characterData") enqueue(m.target);
      else if (m.type === "attributes") enqueue(m.target);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
};

// window.alert / confirm are not in the DOM — translate them too
let nativePatched = false;
const patchNative = () => {
  if (nativePatched || typeof window === "undefined") return;
  nativePatched = true;
  const a = window.alert.bind(window);
  const c = window.confirm.bind(window);
  window.alert = (msg) => a(translate(String(msg ?? "")));
  window.confirm = (msg) => c(translate(String(msg ?? "")));
};

export const setLang = (next) => {
  if (!LANGS.some((l) => l.code === next)) return;
  lang = next;
  try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
  document.documentElement.lang = next;
  listeners.forEach((fn) => fn(next));
  if (next === "th") { walk(document.body); return; } // restores the originals
  ensureDictionary().then(() => { if (lang === next) walk(document.body); });
};

export const initI18n = () => {
  patchNative();
  let saved = "th";
  try { saved = localStorage.getItem(STORAGE_KEY) || "th"; } catch { /* ignore */ }
  lang = LANGS.some((l) => l.code === saved) ? saved : "th";
  document.documentElement.lang = lang;
  startObserver();
  if (lang !== "th") ensureDictionary().then(() => { if (lang !== "th") walk(document.body); });
  if (typeof window !== "undefined") window.__i18nMissing = missing;
};
