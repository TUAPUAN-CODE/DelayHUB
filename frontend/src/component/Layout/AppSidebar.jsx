import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, MenuItem } from "@mui/material";
import { ArrowLeftRight, ChevronDown, Settings, UserRound } from "lucide-react";
import { openSettings, useHasSettings } from "./DataGrid/settingsBus";
import axios from "axios";
import { WORKPLACE_ROUTES, readRoles } from "../../services/roleRoutes";
import LanguageSwitcher from "./LanguageSwitcher";

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

/** Longest matching href wins. A menu entry that is the prefix of another entry (e.g. "/prep" vs "/prep/timestamp") only matches exactly.
 *  An entry with a query string ("/prep/Sheet?view=done") matches only that exact page + query and wins over the same page without a query. */
function findActiveKey(pathname, search, leaves) {
  const full = `${norm(pathname)}${String(search || "").toLowerCase()}`;
  const path = norm(pathname);
  const hrefs = leaves.map((l) => norm(l.href));
  let best = null;
  leaves.forEach((leaf, i) => {
    const href = hrefs[i];
    let hit; let len = href.length;
    if (href.includes("?")) { hit = full === href; len += 10000; } else {
      const prefixOfOther = hrefs.some((o, j) => j !== i && o.startsWith(`${href}/`));
      const exact = leaf.exact ?? prefixOfOther;
      hit = exact ? path === href : path === href || path.startsWith(`${href}/`);
    }
    if (hit && (!best || len > best.len)) best = { key: leaf.key, len };
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

const API_URL = import.meta.env.VITE_API_URL;

/** Role switch: an account can have several Roles (set by the supervisor in the staff table). Shown after the brand only when the account has more than one. */
const RoleSwitcher = () => {
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState(null);
  const [roles, setRoles] = useState(readRoles);
  const current = String(localStorage.getItem("wp_id") || "");

  useEffect(() => {
    // the list may have been changed after login: read it again (a failure keeps the list saved at login)
    const userId = parseInt(localStorage.getItem("user_id"), 10);
    if (Number.isNaN(userId) || !API_URL) return;
    axios.get(`${API_URL}/api/user/roles`, { params: { user_id: userId } })
      .then((res) => { const list = res.data?.data; if (Array.isArray(list)) { localStorage.setItem("roles", JSON.stringify(list)); setRoles(list); } })
      .catch((err) => console.error("Role list error:", err.message));
  }, []);

  if (roles.length < 2) return null;
  const now = roles.find((r) => String(r.wp_id) === current);

  const pick = (role) => {
    setAnchor(null);
    if (String(role.wp_id) === current) return;
    const target = WORKPLACE_ROUTES[role.wp_id];
    if (!target) return;
    localStorage.setItem("wp_id", String(role.wp_id));
    navigate(target, { replace: true });
  };

  return (
    <>
      <button type="button" className="app-top-link" title="สลับ Role" aria-haspopup="true" onClick={(e) => setAnchor(e.currentTarget)}>
        <ArrowLeftRight size={16} className="shrink-0" /><span>{now ? now.wp_name : "สลับ Role"}</span><ChevronDown size={14} className="shrink-0" />
      </button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {roles.map((r) => (
          <MenuItem key={r.wp_id} selected={String(r.wp_id) === current} onClick={() => pick(r)} sx={{ fontSize: 14 }}>{r.wp_name}{r.primary ? " (หลัก)" : ""}</MenuItem>
        ))}
      </Menu>
    </>
  );
};

const AppSidebar = ({ title = "PFCM", subtitle, sections, items }) => {
  const { pathname, search } = useLocation();
  const hasSettings = useHasSettings();
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

  const activeKey = useMemo(() => findActiveKey(pathname, search, leaves), [pathname, search, leaves]);

  const userName = [localStorage.getItem("first_name"), localStorage.getItem("last_name")].filter((v) => v && v !== "null").join(" ");

  return (
    <header className="app-topbar">
      <div className="app-top-brand">
        <div className="app-top-title">{title}</div>
        {subtitle && <div className="app-top-sub">{subtitle}</div>}
      </div>
      <RoleSwitcher />
      <nav aria-label="เมนูหลัก" className="app-top-nav">
        {main.map((it) => (it.submenu ? <GroupLink key={it.key} item={it} activeKey={activeKey} /> : <NavLink key={it.key} leaf={it} active={activeKey === it.key} />))}
      </nav>
      <div className="app-top-user">
        {hasSettings && <button type="button" className="app-top-link" onClick={openSettings}><Settings size={16} className="shrink-0" /><span>Setting</span></button>}
        {userName && <span className="app-top-name" title={userName}><UserRound size={16} className="shrink-0" /><span>{userName}</span></span>}
        <LanguageSwitcher sx={{ color: "#fff", background: "rgb(255 255 255 / .14)", height: 32, "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgb(255 255 255 / .45)" }, "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#fff" }, "& .MuiSvgIcon-root": { color: "#fff" }, "& svg": { color: "#fff" } }} />
      </div>
      {bottom.length > 0 && <div className="app-top-end">{bottom.map((it) => <NavLink key={it.key} leaf={it} active={false} />)}</div>}
    </header>
  );
};

export default AppSidebar;
