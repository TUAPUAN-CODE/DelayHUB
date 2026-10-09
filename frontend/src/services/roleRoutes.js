// The page each Role (Users.wp_id / UserRoles.wp_id) opens. Shared by the login page and the Role switch button of the top bar.
export const WORKPLACE_ROUTES = {
  1: "/oven",
  2: "/prep",
  3: "/qualitycontrol",
  4: "/line/selectwp",
  5: "/coldStorage",
  6: "/sup",
  7: "/coldStorages",
  8: "/master/report",
};

/** roles of the logged-in account, saved at login: [{ wp_id, wp_name, primary }] */
export const readRoles = () => {
  try {
    const list = JSON.parse(localStorage.getItem("roles"));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};
