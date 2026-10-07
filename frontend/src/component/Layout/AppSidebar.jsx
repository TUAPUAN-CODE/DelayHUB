import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, ChevronsLeft, ChevronsRight, Menu, X } from "lucide-react";

/**
 * Left bar shared by every module (same look and motion as DocHUB):
 *  - blue bar, 256px open / 72px icon-only (remembered), drawer on phones
 *  - ONE white "pill" under the active item that slides (with its inverted corners) from the old item to the new one
 *  - sub menus open with a height animation, the label fades when the bar is collapsed
 *
 * props
 *   title / subtitle   brand block
 *   sections           [{ title?, items: [{ name, icon, href, exact?, submenu?: [{ name, href }], onClick? }] }]
 *   items              shortcut for a single section without a title
 * An item whose href is "/logout" (or `bottom: true`) is pinned to the bottom of the bar.
 */

const COLLAPSE_KEY = "sidebarCollapsed";
const SCROLL_KEY = "sidebarScrollPosition";

const read = (key, fallback = null) => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
const write = (key, value) => { try { localStorage.setItem(key, value); } catch { /* private mode: the bar still works */ } };
const norm = (p) => (String(p || "").replace(/\/+$/, "") || "/").toLowerCase();
const isRealHref = (h) => typeof h === "string" && h.startsWith("/");

/** Longest matching href wins. A menu entry that is the prefix of another entry (e.g. "/prep" vs "/prep/timestamp") only matches exactly. */
function findActiveKey(pathname, leaves) {
  const path = norm(pathname);
  const hrefs = leaves.map((l) => norm(l.href));
  let best = null;
  leaves.forEach((leaf, i) => {
    const href = hrefs[i];
    const prefixOfOther = hrefs.some((o, j) => j !== i && o.startsWith(`${href}/`));
    const exact = leaf.exact ?? prefixOfOther;
    const hit = exact ? path === href : path === href || path.startsWith(`${href}/`);
    if (hit && (!best || href.length > best.len)) best = { key: leaf.key, len: href.length };
  });
  return best?.key ?? null;
}

const NavLink = ({ leaf, active, collapsed, onNavigate, child = false }) => {
  const Icon = leaf.icon;
  const cls = `app-nav-link${active ? " is-active" : ""}${child ? " is-child" : ""}`;
  const inner = (
    <>
      {Icon && !child && <Icon size={20} className="shrink-0" />}
      <span className="app-nav-label">{leaf.name}</span>
    </>
  );
  if (leaf.onClick && !isRealHref(leaf.href)) {
    return <button type="button" className={cls} data-nav-key={leaf.key} onClick={() => { leaf.onClick(); onNavigate?.(); }} title={collapsed ? leaf.name : undefined}>{inner}</button>;
  }
  return (
    <Link to={leaf.href} className={cls} data-nav-key={leaf.key} aria-current={active ? "page" : undefined} onClick={() => { leaf.onClick?.(); onNavigate?.(); }} title={collapsed ? leaf.name : undefined}>
      {inner}
    </Link>
  );
};

const Panel = ({ title, subtitle, sections, collapsed, drawer, onToggle, onClose }) => {
  const { pathname } = useLocation();
  const listRef = useRef(null);
  const navRef = useRef(null);
  const [pill, setPill] = useState({ top: 0, height: 0, visible: false });
  const [animate, setAnimate] = useState(false);   // no sliding on the very first paint
  const [openName, setOpenName] = useState(null);

  const { main, bottom, leaves } = useMemo(() => {
    const keyed = sections.map((s) => ({
      ...s,
      items: s.items.map((it) => ({
        ...it,
        key: it.submenu ? `group:${it.name}` : it.href || it.name,
        submenu: it.submenu?.map((c) => ({ ...c, key: c.href })),
      })),
    }));
    const isBottom = (it) => it.bottom || it.href === "/logout";
    const all = keyed.flatMap((s) => s.items);
    const lv = all.flatMap((it) => (it.submenu ? it.submenu.map((c) => ({ ...c, parent: it.name })) : isBottom(it) || !isRealHref(it.href) ? [] : [it]));
    return {
      main: keyed.map((s) => ({ ...s, items: s.items.filter((it) => !isBottom(it)) })).filter((s) => s.items.length),
      bottom: all.filter(isBottom),
      leaves: lv,
    };
  }, [sections]);

  const activeKey = useMemo(() => findActiveKey(pathname, leaves), [pathname, leaves]);
  const activeParent = leaves.find((l) => l.key === activeKey)?.parent ?? null;

  // the group that holds the open page is open; others keep what the user toggled
  useEffect(() => { if (activeParent) setOpenName(activeParent); }, [activeParent]);

  const measure = useCallback(() => {
    const list = listRef.current;
    if (!list || !activeKey) { setPill((p) => (p.visible ? { ...p, visible: false } : p)); return; }
    const el = list.querySelector(`[data-nav-key="${CSS.escape(activeKey)}"]`);
    if (!el || el.offsetParent === null) { setPill((p) => (p.visible ? { ...p, visible: false } : p)); return; }
    const a = el.getBoundingClientRect(); const b = list.getBoundingClientRect();
    const next = { top: Math.round(a.top - b.top), height: Math.round(a.height), visible: true };
    setPill((p) => (p.top === next.top && p.height === next.height && p.visible ? p : next));
  }, [activeKey]);

  useLayoutEffect(() => { measure(); }, [measure, collapsed, openName, main]);
  useEffect(() => { const t = requestAnimationFrame(() => setAnimate(true)); return () => cancelAnimationFrame(t); }, []);
  // sub menus change the position of everything below them while they animate: follow the list size
  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => measure());
    ro.observe(list);
    return () => ro.disconnect();
  }, [measure]);

  useEffect(() => {
    if (drawer) return;
    const saved = parseInt(read(SCROLL_KEY, "0"), 10);
    if (navRef.current && Number.isFinite(saved)) navRef.current.scrollTop = saved;
  }, [drawer]);

  const toggleGroup = (name) => {
    if (collapsed && !drawer) onToggle?.();   // an icon-only bar first opens, then shows the group
    setOpenName((cur) => (cur === name ? null : name));
  };

  const renderItem = (it) => {
    if (it.submenu) {
      const open = openName === it.name && !(collapsed && !drawer);
      const hasActive = activeParent === it.name;
      const Icon = it.icon;
      return (
        <li key={it.key} className="app-nav-item">
          <button type="button" className={`app-nav-link app-nav-group${hasActive ? " has-active" : ""}`} aria-expanded={open} onClick={() => toggleGroup(it.name)} title={collapsed ? it.name : undefined}>
            {Icon && <Icon size={20} className="shrink-0" />}
            <span className="app-nav-label">{it.name}</span>
            <ChevronDown size={16} className="app-nav-chevron shrink-0" style={{ transform: open ? "rotate(180deg)" : "none" }} />
          </button>
          <div className={`app-nav-sub${open ? " is-open" : ""}`}>
            <ul>
              {it.submenu.map((c) => (
                <li key={c.key} className="app-nav-item"><NavLink leaf={c} child active={activeKey === c.key} collapsed={collapsed} onNavigate={onClose} /></li>
              ))}
            </ul>
          </div>
        </li>
      );
    }
    return <li key={it.key} className="app-nav-item"><NavLink leaf={it} active={activeKey === it.key} collapsed={collapsed && !drawer} onNavigate={onClose} /></li>;
  };

  const isCollapsed = collapsed && !drawer;
  return (
    <div className={`app-sidebar${isCollapsed ? " is-collapsed" : ""}`}>
      <div className="app-sidebar-head">
        <div className="app-sidebar-brand">
          <div className="app-sidebar-title">{title}</div>
          {subtitle && <div className="app-sidebar-sub">{subtitle}</div>}
        </div>
        {drawer ? (
          <button type="button" onClick={onClose} aria-label="ปิดเมนู" className="app-sidebar-iconbtn"><X size={20} /></button>
        ) : (
          <button type="button" onClick={onToggle} aria-label={collapsed ? "ขยายเมนู" : "ย่อเมนู"} title={collapsed ? "ขยายเมนู" : "ย่อเมนู"} className="app-sidebar-iconbtn">
            {collapsed ? <ChevronsRight size={20} /> : <ChevronsLeft size={20} />}
          </button>
        )}
      </div>

      <nav ref={navRef} aria-label="เมนูหลัก" className="app-sidebar-nav" onScroll={drawer ? undefined : (e) => write(SCROLL_KEY, String(Math.round(e.currentTarget.scrollTop)))}>
        <div ref={listRef} className="app-nav-list">
          <span
            aria-hidden="true"
            className="app-nav-pill"
            style={{ transform: `translateY(${pill.top}px)`, height: pill.height, opacity: pill.visible ? 1 : 0, transition: animate ? undefined : "none" }}
          />
          {main.map((section, i) => (
            <div key={section.title || i} className="app-nav-section">
              {section.title && <div className="app-nav-section-title">{section.title}</div>}
              <ul>{section.items.map(renderItem)}</ul>
            </div>
          ))}
        </div>
      </nav>

      {bottom.length > 0 && (
        <div className="app-sidebar-foot">
          <ul>{bottom.map((it) => <li key={it.key} className="app-nav-item"><NavLink leaf={{ ...it, key: it.key }} active={false} collapsed={isCollapsed} onNavigate={onClose} /></li>)}</ul>
        </div>
      )}
    </div>
  );
};

const AppSidebar = ({ title = "PFCM", subtitle, sections, items }) => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => read(COLLAPSE_KEY) === "1");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const normalized = useMemo(() => sections || [{ items: items || [] }], [sections, items]);

  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setDrawerOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const toggle = useCallback(() => setCollapsed((c) => { write(COLLAPSE_KEY, c ? "0" : "1"); return !c; }), []);

  return (
    <>
      <button type="button" onClick={() => setDrawerOpen(true)} aria-label="เปิดเมนู" className="app-sidebar-burger">
        <Menu size={22} />
      </button>
      {drawerOpen && (
        <div className="app-sidebar-drawer" role="dialog" aria-modal="true" aria-label="เมนู">
          <div className="app-sidebar-drawer-panel"><Panel title={title} subtitle={subtitle} sections={normalized} collapsed={false} drawer onClose={() => setDrawerOpen(false)} /></div>
          <button type="button" aria-label="ปิดเมนู" className="app-sidebar-drawer-back" onClick={() => setDrawerOpen(false)} />
        </div>
      )}
      <aside className="app-sidebar-desktop" style={{ width: collapsed ? 72 : 256 }}>
        <Panel title={title} subtitle={subtitle} sections={normalized} collapsed={collapsed} onToggle={toggle} />
      </aside>
    </>
  );
};

export default AppSidebar;
