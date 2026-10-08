import dictionary from "./dict";

export const LANGS = [
  { code: "th", label: "ไทย", short: "TH" },
  { code: "en", label: "English", short: "EN" },
  { code: "my", label: "မြန်မာ", short: "MY" },
  { code: "km", label: "ខ្មែរ", short: "KM" },
];
const IDX = { en: 0, my: 1, km: 2 };
const STORAGE_KEY = "pfcm_lang";
const TH_RE = /[ก-๙]/;
const NUM_RE = /\d+(?:[.,]\d+)*/g;
const ATTRS = ["placeholder", "title", "aria-label", "alt"];
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE"]);

let lang = "th";
let observer = null;
const listeners = new Set();
const textRec = new WeakMap(); // Text node -> { orig, out }
const attrRec = new WeakMap(); // Element -> { [attr]: { orig, out } }
export const missing = new Set();

export const getLang = () => lang;
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

const lookupCore = (core, col) => {
  const hit = dictionary[core];
  if (hit && hit[col] != null) return hit[col];
  const nums = core.match(NUM_RE);
  if (nums) {
    const t = dictionary[core.replace(NUM_RE, "{n}")];
    if (t && t[col] != null) {
      let i = 0;
      return t[col].replace(/\{n\}/g, () => nums[Math.min(i++, nums.length - 1)]);
    }
  }
  return null;
};

export const translate = (text, to = lang) => {
  if (to === "th" || !text || !TH_RE.test(text)) return text;
  const lead = text.match(/^\s*/)[0];
  const trail = text.match(/\s*$/)[0];
  const core = text.trim();
  if (!core) return text;
  const col = IDX[to];
  let out = lookupCore(core, col);
  if (out !== null) return lead + out + trail;
  // "label :" / "label:" variants
  const m = core.match(/^(.*?)\s*([:：])$/);
  if (m) {
    out = lookupCore(m[1], col);
    if (out !== null) return lead + out + m[2] + trail;
  }
  if (missing.size < 5000) missing.add(core);
  return text;
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
  walk(document.body); // re-process everything (th restores originals)
  listeners.forEach((fn) => fn(next));
};

export const initI18n = () => {
  patchNative();
  let saved = "th";
  try { saved = localStorage.getItem(STORAGE_KEY) || "th"; } catch { /* ignore */ }
  lang = LANGS.some((l) => l.code === saved) ? saved : "th";
  document.documentElement.lang = lang;
  startObserver();
  if (lang !== "th") walk(document.body);
  if (typeof window !== "undefined") window.__i18nMissing = missing;
};
