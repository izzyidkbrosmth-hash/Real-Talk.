import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";

const pub = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".css": "text/css" };
const send = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/api/config") return send(res, 200, { clientId: process.env.DISCORD_CLIENT_ID || "" });
  if (url.pathname === "/api/token" && req.method === "POST") {
    let body = ""; for await (const c of req) body += c;
    try {
      const { code } = JSON.parse(body);
      const r = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: process.env.DISCORD_CLIENT_ID, client_secret: process.env.DISCORD_CLIENT_SECRET, grant_type: "authorization_code", code }),
      });
      const j = await r.json();
      return send(res, r.ok ? 200 : 400, { access_token: j.access_token });
    } catch (e) { return send(res, 500, { error: "token" }); }
  }
  let p = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[\/\\])+/, "");
  if (p === "/" || p === "\\") p = "/index.html";
  const f = path.join(pub, p);
  if (!f.startsWith(pub) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end("Not found"); }
  res.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});

// ---- rooms: topics hold the latest value, presence is per connection ----
const rooms = new Map();
const wss = new WebSocketServer({ server, path: "/ws" });
const peersOf = r => [...r.clients].filter(c => c.pres).map(c => ({ peer: c.peer, presence: c.pres }));
const bcast = (r, m) => { const s = JSON.stringify(m); r.clients.forEach(c => c.readyState === 1 && c.send(s)); };

wss.on("connection", ws => {
  let room = null;
  ws.on("message", raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === "join" && !room && typeof m.room === "string") {
      ws.peer = String(m.peer || "").slice(0, 16);
      room = rooms.get(m.room) || { clients: new Set(), topics: {} };
      if (m.fresh) room.topics = {};
      rooms.set(m.room, room); room.clients.add(ws); ws.roomId = m.room;
      for (const [t, v] of Object.entries(room.topics)) ws.send(JSON.stringify({ t: "topic", topic: t, data: v.data, peer: v.peer }));
      ws.send(JSON.stringify({ t: "peers", peers: peersOf(room) }));
    } else if (!room) return;
    else if (m.t === "emit" && typeof m.topic === "string") {
      room.topics[m.topic] = { data: m.data, peer: ws.peer };
      bcast(room, { t: "topic", topic: m.topic, data: m.data, peer: ws.peer });
    } else if (m.t === "presence") {
      ws.pres = m.presence; bcast(room, { t: "peers", peers: peersOf(room) });
    }
  });
  ws.on("close", () => {
    if (!room) return;
    room.clients.delete(ws);
    if (!room.clients.size) rooms.delete(ws.roomId); else bcast(room, { t: "peers", peers: peersOf(room) });
  });
});

server.listen(process.env.PORT || 3001, () => console.log("Real Talk running on", process.env.PORT || 3001));
