// Runtime settings of the web app. Loaded by index.html BEFORE the app, so `git pull` is enough: no `npm run build` is needed to change the API address.
// API_URL = address of the backend (Express + Socket.IO, port 3001). Edit the table below when a site is reached through another address.
(function () {
  var API_BY_HOST = {
    // address typed in the browser (hostname)  ->  backend address
    "pfcm.thaiunion.co.th": "http://172.48.0.115:3001",
  };
  var host = window.location.hostname;
  // not in the table: the backend of the same machine as the page (http://<host>:3001)
  window.__API_URL__ = API_BY_HOST[host] || (window.location.protocol + "//" + host + ":3001");
})();
