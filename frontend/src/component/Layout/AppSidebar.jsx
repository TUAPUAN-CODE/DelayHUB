import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, MenuItem } from "@mui/material";
import { ChevronDown } from "lucide-react";

/**
 * Top bar shared by every module (it replaced the left bar; the file keeps its name so the 8 Sidebar*.jsx files did not have to change).
 * Sits ABOVE the page header, one row: brand · menu items (scrolls sideways when there are many) · logout on the right.
 *
 * props
 *   title / subtitle   brand block
 *   sections           [{ title?, items: [{ name, icon, href, exact?, submenu?: [{ name, href }], onClick? }] }]   (section titles are not shown)
 *   items              shortcut for a single section without a title
 * An item whose href is "/logout" (or `bottom: true`) is pinned to the right end of the bar.
 * An item with `submenu` opens a drop-down menu.
 */

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

const NavLink = ({ leaf, active }) => {
  const Icon = leaf.icon;
  const cls = `app-top-link${active ? " is-active" : ""}`;
  const inner = (<>{Icon && <Icon size={17} className="shrink-0" />}<span>{leaf.name}</span></>);
  if (leaf.onClick && !isRealHref(leaf.href)) return <button type="button" className={cls} onClick={leaf.onClick}>{inner}</button>;
  return <Link to={leaf.href} className={cls} aria-current={active ? "page" : undefined} onClick={() => leaf.onClick?.()}>{inner}</Link>;
};

const GroupLink = ({ item, activeKey }) => {
  const [anchor, setAnchor] = useState(null);
  const Icon = item.icon;
  const hasActive = item.submenu.some((c) => c.key === activeKey);
  return (
    <>
      <button type="button" className={`app-top-link${hasActive ? " is-active" : ""}`} aria-haspopup="true" aria-expanded={!!anchor} onClick={(e) => setAnchor(e.currentTarget)}>
        {Icon && <Icon size={17} className="shrink-0" />}<span>{item.name}</span><ChevronDown size={14} className="shrink-0" />
      </button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {item.submenu.map((c) => (
          <MenuItem key={c.key} component={Link} to={c.href} selected={c.key === activeKey} onClick={() => setAnchor(null)} sx={{ fontSize: 14 }}>{c.name}</MenuItem>
        ))}
      </Menu>
    </>
  );
};

const AppSidebar = ({ title = "PFCM", subtitle, sections, items }) => {
  const { pathname } = useLocation();
  const normalized = useMemo(() => sections || [{ items: items || [] }], [sections, items]);

  const { main, bottom, leaves } = useMemo(() => {
    const all = normalized.flatMap((s) => s.items).map((it) => ({
      ...it,
      key: it.submenu ? `group:${it.name}` : it.href || it.name,
      submenu: it.submenu?.map((c) => ({ ...c, key: c.href })),
    }));
    const isBottom = (it) => it.bottom || it.href === "/logout";
    const lv = all.flatMap((it) => (it.submenu ? it.submenu : isBottom(it) || !isRealHref(it.href) ? [] : [it]));
    return { main: all.filter((it) => !isBottom(it)), bottom: all.filter(isBottom), leaves: lv };
  }, [normalized]);

  const activeKey = useMemo(() => findActiveKey(pathname, leaves), [pathname, leaves]);

  return (
    <header className="app-topbar">
      <div className="app-top-brand">
        <div className="app-top-title">{title}</div>
        {subtitle && <div className="app-top-sub">{subtitle}</div>}
      </div>
      <nav aria-label="เมนูหลัก" className="app-top-nav">
        {main.map((it) => (it.submenu ? <GroupLink key={it.key} item={it} activeKey={activeKey} /> : <NavLink key={it.key} leaf={it} active={activeKey === it.key} />))}
      </nav>
      {bottom.length > 0 && <div className="app-top-end">{bottom.map((it) => <NavLink key={it.key} leaf={it} active={false} />)}</div>}
    </header>
  );
};

export default AppSidebar;
