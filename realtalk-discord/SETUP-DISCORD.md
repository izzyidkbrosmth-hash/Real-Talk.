# Real Talk as a Discord Activity (desktop)

Needs: a free Discord account, a free GitHub account, a free Render account. Node.js is only needed if you want to test on your own computer first.

## 1. Create the Discord app
1. Go to https://discord.com/developers/applications > **New Application** > name it "Real Talk".
2. **General Information**: copy the **Application ID**.
3. **OAuth2**: copy the **Client Secret** (Reset Secret if needed). Under **Redirects** add `https://127.0.0.1` and save.
4. **Activities > Settings**: turn **Enable Activities** on.
5. **Installation**: keep the default install link and add the app to your own server with it.

## 2. Put the code online (Render, free)
1. Upload this folder to a new GitHub repository (the `.env` file is not included on purpose).
2. On https://render.com: **New > Web Service** > pick the repo.
   - Build command: `npm install && npm run build`
   - Start command: `npm start`
   - Environment variables: `DISCORD_CLIENT_ID` = Application ID, `DISCORD_CLIENT_SECRET` = Client Secret
3. When it's live you get an address like `real-talk.onrender.com`.
   The free tier sleeps when idle, so the first launch after a quiet spell can take about a minute.

## 3. Tell Discord where it lives
Back in the Developer Portal > **Activities > URL Mappings**:
- Prefix: `/`  Target: `real-talk.onrender.com` (your address, no https://)

## 4. Launch it
Desktop Discord > join a voice channel in the server where you added the app > click the rocket/Activities button > **Real Talk**. Everyone in the channel can join the same activity. One person taps **Host a group**, the others tap **Join a group**. Names come from Discord, no codes needed.

## Testing on your own computer (optional)
`npm install`, then copy `.env.example` to `.env`, fill it in, and run `npm run build && node --env-file=.env server.js`. To try it inside Discord you need a tunnel (e.g. `cloudflared tunnel --url http://localhost:3001`) and then use that address in step 3.

## If something goes wrong
- Blank screen / stuck loading: the URL mapping or the Render env vars are wrong, or Render is waking up.
- "Couldn't connect": the WebSocket is blocked; check the mapping target has no https:// and no trailing slash.
- Open Discord's dev tools (Ctrl+Shift+I, desktop app) to see console errors, and send me what it says.
- While the app is unverified, Discord limits who can launch it; use a small server you own and check Discord's current limits.
