// Printing a slip from any device.
//  - "browser": window.print() (Windows PC with the slip printer installed — the way it has always worked)
//  - "agent":   the slip on screen is sent as HTML to the Print Agent (print-agent/server.js, POST /print-html),
//               which prints it on the default printer of its machine, or RAW over the network to printerHost/printerShare.
//               For Android tablets / phones: Chrome on Android has no thermal printer driver, so window.print() cannot print a slip there.
// The choice is kept per device (localStorage), like the RFID slip switch. Android defaults to "agent".
import { SLIP_PRINT_KEY } from "./localStorageUtil";

const API_URL = import.meta.env.VITE_API_URL;
const AGENT_PORT = 9100;

export const isAndroid = () => /Android/i.test(navigator.userAgent || "");

/** the Print Agent runs on the API server machine (same as the RFID slip service) */
export const defaultAgentUrl = () => {
  try { const u = new URL(API_URL); return `${u.protocol}//${u.hostname}:${AGENT_PORT}`; } catch { return `http://localhost:${AGENT_PORT}`; }
};

/** { mode: "browser" | "agent", agentUrl, printerHost, printerShare } */
export const readSlipPrintConfig = () => {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(SLIP_PRINT_KEY)) || {}; } catch { saved = {}; }
  return {
    mode: saved.mode === "agent" || saved.mode === "browser" ? saved.mode : (isAndroid() ? "agent" : "browser"),
    agentUrl: saved.agentUrl || defaultAgentUrl(),
    printerHost: saved.printerHost || "",
    printerShare: saved.printerShare || "",
  };
};
export const saveSlipPrintConfig = (cfg) => {
  try { localStorage.setItem(SLIP_PRINT_KEY, JSON.stringify(cfg)); } catch (err) { console.error("[slipPrint] save config error:", err); }
};

// the styles of the page (MUI/emotion <style> tags and the built CSS <link>s), so the slip looks the same on the agent
const pageStyles = () => [...document.querySelectorAll('style, link[rel="stylesheet"]')].map((n) => n.outerHTML).join("\n");

/** HTML of one slip element: buttons / inputs / .no-print parts are left out */
export const slipHtml = (el) => {
  const copy = el.cloneNode(true);
  // a cloned <canvas> is empty (the QR code would print as a blank): turn every canvas into an <img> of what it shows
  const live = el.querySelectorAll("canvas");
  copy.querySelectorAll("canvas").forEach((cv, i) => {
    try {
      const img = document.createElement("img");
      img.src = live[i].toDataURL("image/png");
      img.setAttribute("style", cv.getAttribute("style") || "");
      img.width = live[i].clientWidth || live[i].width; img.height = live[i].clientHeight || live[i].height;
      cv.replaceWith(img);
    } catch (err) { console.error("[slipPrint] canvas to image error:", err); }
  });
  copy.querySelectorAll(".no-print, button, .MuiDialogActions-root, input, textarea, select").forEach((n) => n.remove());
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><base href="${window.location.origin}/">${pageStyles()}
<style>@page { size: 80mm auto; margin: 0; } html, body { margin: 0; padding: 0; background: #fff; width: 80mm; }
.container { width: 80mm; padding: 0; box-sizing: border-box; } .container .MuiDialog-paper, .container .MuiPaper-root { box-shadow: none !important; margin: 0 !important; max-width: 80mm !important; width: 80mm !important; }</style>
</head><body><div class="container">${copy.outerHTML}</div></body></html>`;
};

/**
 * Sends the HTML of a slip to a Print Agent (POST /print-html). Returns "" or an error text.
 * opts: { agentUrl, printerHost, printerShare, printerDotWidth } (the RFID auto print takes them from the reader config, the screen from the device config)
 */
export const sendSlipHtml = async (html, identifier, opts = {}) => {
  const agentUrl = (opts.agentUrl || defaultAgentUrl()).replace(/\/$/, "");
  try {
    const res = await fetch(`${agentUrl}/print-html`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html, identifier: identifier ? String(identifier) : undefined, printerHost: opts.printerHost || undefined, printerShare: opts.printerShare || undefined, printerDotWidth: opts.printerDotWidth || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) return data.error || `Print Agent ตอบกลับ ${res.status}`;
    return "";
  } catch (err) {
    console.error("[slipPrint] print agent error:", err);
    return `เชื่อมต่อ Print Agent (${agentUrl}) ไม่ได้`;
  }
};

/**
 * Prints the slip: el = the element that holds it (e.g. the dialog paper). Returns "" or an error text to show.
 * identifier: anything that names the slip (used by the agent to skip an accidental double press).
 */
export const printSlip = async (el, identifier) => {
  const cfg = readSlipPrintConfig();
  if (cfg.mode !== "agent" || !el) { window.print(); return ""; }
  return sendSlipHtml(slipHtml(el), identifier, cfg);
};
