import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Clock, Soup, RotateCcw, ScanLine, Blend, Layers, ListChecks, LogOut, ChevronsLeft, ChevronsRight } from "lucide-react";

const PRIMARY = "#1552F0";
const PAGE_BG = "#f4f7fe";
const COLLAPSE_KEY = "prepSidebarCollapsed";
const SCROLL_KEY = "sidebarScrollPosition";

const readStorage = (key, fallback = null) => {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
};
const writeStorage = (key, value) => {
  try { localStorage.setItem(key, value); } catch { /* private mode: the sidebar still works */ }
};
const readRmTypeIds = () => {
  try { return JSON.parse(readStorage("rm_type_id", "[]")) || []; } catch { return []; }
};

/**
 * One menu entry. The active entry is a white pill that melts into the page (inverted corners above and below, the same look as DocHUB).
 */
const NavItem = ({ item, active, collapsed, onNavigate }) => {
  const Icon = item.icon;
  return (
    <li className="relative pl-3">
      <Link
        to={item.href}
        onClick={onNavigate}
        title={collapsed ? item.name : undefined}
        aria-current={active ? "page" : undefined}
        className="relative flex items-center gap-3 h-11 pl-3 pr-4 rounded-l-full text-sm transition-colors whitespace-nowrap"
        style={{
          background: active ? "#fff" : "transparent",
          color: active ? PRIMARY : "rgba(255,255,255,.92)",
          fontWeight: active ? 600 : 400,
        }}
      >
        {active && (
          <>
            <span className="absolute right-0 -top-4 w-4 h-4 pointer-events-none" style={{ background: `radial-gradient(circle at 0 0, transparent 16px, #fff 16.5px)` }} />
            <span className="absolute right-0 -bottom-4 w-4 h-4 pointer-events-none" style={{ background: `radial-gradient(circle at 0 100%, transparent 16px, #fff 16.5px)` }} />
          </>
        )}
        <Icon size={20} className="shrink-0" />
        {!collapsed && <span className="truncate">{item.name}</span>}
      </Link>
    </li>
  );
};

const SidebarPrep = () => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => readStorage(COLLAPSE_KEY) === "1");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navRef = useRef(null);

  // "Scan SAP" is hidden for the rm types that do not use it (998, 999)
  const showScanSAP = !readRmTypeIds().some((id) => Number(id) === 998 || Number(id) === 999);

  const sections = useMemo(() => [
    {
      title: "Time Stamp",
      items: [
        { name: "Time Stamp วัตถุดิบ", icon: Clock, href: "/prep", exact: true },
        { name: "Time Stamp น้ำต้มไก่", icon: Soup, href: "/prep/timestamp" },
        { name: "วัตถุดิบรอแก้ไข / กลับมาเตรียม", icon: RotateCcw, href: "/prep/MatRework/MatReworkPage" },
        ...(showScanSAP ? [{ name: "Scan SAP", icon: ScanLine, href: "/prep/ScanSAP/ScanSAPPage" }] : []),
      ],
    },
    {
      title: "ผสมวัตถุดิบ",
      items: [
        { name: "ผสมวัตถุดิบ", icon: Blend, href: "/prep/Emulsions" },
        { name: "ผสม Batch", icon: Layers, href: "/prep/BatchMIX" },
        { name: "ผสมเตรียม", icon: Layers, href: "/prep/IncludeRawmat" },
        { name: "ผสมวัตถุดิบ loaf สุก", icon: Layers, href: "/prep/IncludeRawmatPageotherplant" },
        { name: "รายการผสมวัตถุดิบ", icon: ListChecks, href: "/prep/RM_EMU" },
      ],
    },
  ], [showScanSAP]);

  // Only the longest matching href is active ("/prep" must not light up on every "/prep/..." page)
  const activeHref = useMemo(() => {
    const path = location.pathname.replace(/\/+$/, "") || "/";
    const all = sections.flatMap((s) => s.items);
    const hits = all.filter((i) => (i.exact ? path === i.href : path === i.href || path.startsWith(`${i.href}/`)));
    return hits.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
  }, [location.pathname, sections]);

  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  useEffect(() => {
    const saved = parseInt(readStorage(SCROLL_KEY, "0"), 10);
    if (navRef.current && Number.isFinite(saved)) navRef.current.scrollTop = saved;
  }, []);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setDrawerOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => { writeStorage(COLLAPSE_KEY, prev ? "0" : "1"); return !prev; });
  };

  const panel = (isCollapsed, isDrawer) => (
    <div className="h-full flex flex-col text-white" style={{ background: PRIMARY, fontFamily: "Prompt, sans-serif" }}>
      <div className={`flex items-center h-16 px-4 shrink-0 ${isCollapsed ? "justify-center" : "justify-between"}`}>
        {!isCollapsed && (
          <div className="leading-tight">
            <div className="text-lg font-bold tracking-wide">DelayHUB</div>
            <div className="text-[11px] text-white/70">จุดเตรียมวัตถุดิบ</div>
          </div>
        )}
        {isDrawer ? (
          <button type="button" onClick={() => setDrawerOpen(false)} aria-label="ปิดเมนู" className="p-2 rounded-lg hover:bg-white/15"><X size={20} /></button>
        ) : (
          <button type="button" onClick={toggleCollapsed} aria-label={isCollapsed ? "ขยายเมนู" : "ย่อเมนู"} title={isCollapsed ? "ขยายเมนู" : "ย่อเมนู"} className="p-2 rounded-lg hover:bg-white/15">
            {isCollapsed ? <ChevronsRight size={20} /> : <ChevronsLeft size={20} />}
          </button>
        )}
      </div>

      <nav
        ref={isDrawer ? undefined : navRef}
        onScroll={isDrawer ? undefined : (e) => writeStorage(SCROLL_KEY, String(Math.round(e.currentTarget.scrollTop)))}
        className="flex-1 overflow-y-auto py-4 prep-sidebar-nav"
      >
        {sections.map((section) => (
          <div key={section.title} className="mb-5">
            {!isCollapsed && <div className="px-6 mb-2 text-[11px] uppercase tracking-wider text-white/60">{section.title}</div>}
            <ul className="space-y-2">
              {section.items.map((item) => (
                <NavItem key={item.href} item={item} active={activeHref === item.href} collapsed={isCollapsed} onNavigate={() => setDrawerOpen(false)} />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 py-3 border-t border-white/15">
        <ul>
          <NavItem item={{ name: "ออกจากระบบ", icon: LogOut, href: "/logout" }} active={false} collapsed={isCollapsed} onNavigate={() => setDrawerOpen(false)} />
        </ul>
      </div>
    </div>
  );

  return (
    <>
      <style>{`.prep-sidebar-nav::-webkit-scrollbar{display:none}.prep-sidebar-nav{-ms-overflow-style:none;scrollbar-width:none}`}</style>

      {/* phone / tablet: top button + drawer */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label="เปิดเมนู"
        className="lg:hidden fixed top-3 left-3 z-40 p-2 rounded-xl text-white shadow-lg"
        style={{ background: PRIMARY }}
      >
        <Menu size={22} />
      </button>
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="เมนู">
          <div className="w-64 max-w-[80vw] h-full shadow-2xl">{panel(false, true)}</div>
          <button type="button" aria-label="ปิดเมนู" className="flex-1 bg-black/40" onClick={() => setDrawerOpen(false)} />
        </div>
      )}

      {/* desktop: fixed side bar, 72px when collapsed / 256px when open */}
      <aside
        className="hidden lg:block relative z-10 shrink-0 h-screen"
        style={{ width: collapsed ? 72 : 256, transition: "width .2s ease-in-out", background: PRIMARY, boxShadow: `inset -1px 0 0 ${PAGE_BG}` }}
      >
        {panel(collapsed, false)}
      </aside>
    </>
  );
};

export default SidebarPrep;
