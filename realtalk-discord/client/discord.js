import { DiscordSDK } from "@discord/embedded-app-sdk";

function makeWsRoom() {
  const me = Math.random().toString(36).slice(2, 10);
  return {
    join(name, fresh) {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket(`wss://${location.host}/.proxy/ws`);
        let peers = [], pl = [], mine = {};
        const hs = {}, last = {};
        const api = {
          emit: async (t, d) => { ws.send(JSON.stringify({ t: "emit", topic: t, data: d === undefined ? null : d })); },
          on: (t, h) => {
            (hs[t] = hs[t] || []).push(h);
            if (last[t]) h(last[t]);
            return () => { hs[t] = (hs[t] || []).filter(x => x !== h); };
          },
          presence: async p => { mine = { ...mine, ...p }; ws.send(JSON.stringify({ t: "presence", presence: mine })); },
          peers: () => peers,
          onPeers: h => { pl.push(h); return () => { pl = pl.filter(x => x !== h); }; },
          leave: async () => { ws.close(); },
        };
        ws.onerror = () => reject({ code: "ws" });
        ws.onopen = () => { ws.send(JSON.stringify({ t: "join", room: name, fresh: !!fresh, peer: me })); resolve(api); };
        ws.onmessage = ev => {
          const m = JSON.parse(ev.data);
          if (m.t === "topic") {
            const msg = { topic: m.topic, data: m.data, isMe: m.peer === me, peer: m.peer };
            last[m.topic] = msg;
            (hs[m.topic] || []).forEach(h => h(msg));
          } else if (m.t === "peers") {
            peers = m.peers.map(p => ({ peer: p.peer, isMe: p.peer === me, presence: p.presence }));
            pl.forEach(f => f({ peers }));
          }
        };
      });
    },
  };
}

if (new URLSearchParams(location.search).get("frame_id")) {
  window.discordReady = (async () => {
    const cfg = await (await fetch("/.proxy/api/config")).json();
    const sdk = new DiscordSDK(cfg.clientId);
    await sdk.ready();
    const { code } = await sdk.commands.authorize({
      client_id: cfg.clientId, response_type: "code", state: "", prompt: "none", scope: ["identify"],
    });
    const r = await fetch("/.proxy/api/token", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }),
    });
    const { access_token } = await r.json();
    const auth = await sdk.commands.authenticate({ access_token });
    const u = auth.user;
    window.DISCORD = {
      name: u.global_name || u.username,
      instance: "dc-" + sdk.instanceId,
      code: sdk.instanceId.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase().padEnd(4, "X"),
    };
    window.DISCORD_ROOM = makeWsRoom();
  })();
}
