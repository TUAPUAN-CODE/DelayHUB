// Real time for the Master Sheet of every Role: after ANY successful write of the API (POST / PUT / PATCH / DELETE) every open Sheet is told to reload,
// so what one device saves (e.g. /prep) shows up on the others (e.g. /qualitycontrol) without a refresh.
// Pages join the room "sheetRoom"; the Redis adapter carries the event across the PM2 cluster workers. Many writes in a short time become ONE event.
const WRITE = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const IGNORE = [/^\/api\/sheet\/prefs/, /^\/api\/login/, /^\/api\/user\/roles/];
const DEBOUNCE_MS = 400;

module.exports = (app, io) => {
  let timer = null;
  const notify = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      try {
        io.to("sheetRoom").emit("sheetChanged", { at: Date.now() });
      } catch (err) {
        console.error("❌ [sheetRealtime] emit error:", err.message);
      }
    }, DEBOUNCE_MS);
  };

  app.use((req, res, next) => {
    if (WRITE.has(req.method) && req.originalUrl.startsWith("/api/") && !IGNORE.some((re) => re.test(req.originalUrl))) {
      res.on("finish", () => { if (res.statusCode < 400) notify(); });
    }
    next();
  });
};
