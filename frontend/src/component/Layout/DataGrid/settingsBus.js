import { useSyncExternalStore } from "react";

// The "Setting" button of the top bar opens the column settings of the table on the page. Every DataGrid registers its opener here while it is mounted.
let openers = [];
const subs = new Set();
const emit = () => subs.forEach((fn) => fn());
const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };

export const registerSettings = (open) => {
  openers = [...openers, open];
  emit();
  return () => { openers = openers.filter((o) => o !== open); emit(); };
};
export const openSettings = () => { const last = openers[openers.length - 1]; if (last) last(); };
/** true while a table with column settings is on the page */
export const useHasSettings = () => useSyncExternalStore(subscribe, () => openers.length > 0, () => false);
