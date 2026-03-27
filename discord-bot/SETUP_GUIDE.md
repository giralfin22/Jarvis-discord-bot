# 🤖 Discord Business Assistant Bot — Setup Guide

## What This Bot Does
- `/priorities` — Shows your high & medium priority tasks for the day
- `/digest` — Full business snapshot (tasks, clients, standups)
- `/task add` — Add tasks with priority levels (High/Medium/Low)
- `/task list` — View all open tasks grouped by priority
- `/standup` — Post your daily standup (yesterday / today / blockers)
- `/client update` — Log updates for any client
- `/client list` — View all tracked clients
- `/sop list` — Browse all SOPs
- `/sop get <topic>` — View a specific SOP (e.g. `onboarding`, `daily-checklist`)
- `/sop create` — Request a new SOP
- ☀️ **Auto daily digest** at 8:00 AM in #general or #daily-digest

---

## Step 1 — Create Your Discord Bot (5 min)

1. Go to **https://discord.com/developers/applications**
2. Click **"New Application"** → name it (e.g. "Business Assistant")
3. Go to **"Bot"** tab → click **"Add Bot"** → confirm
4. Under **"Privileged Gateway Intents"**, enable:
   - ✅ Server Members Intent
   - ✅ Message Content Intent
5. Click **"Reset Token"** → copy the token (you'll need this)
6. Go to **"General Information"** → copy the **Application ID**

---

## Step 2 — Invite Bot to Your Server (2 min)

1. Go to **"OAuth2"** → **"URL Generator"**
2. Under **Scopes**, check: `bot` and `applications.commands`
3. Under **Bot Permissions**, check:
   - Send Messages
   - Embed Links
   - Read Message History
   - Use Slash Commands
4. Copy the generated URL → open in browser → select your server → Authorize

---

## Step 3 — Get Your Server ID (1 min)

1. In Discord, go to **User Settings** → **Advanced** → enable **Developer Mode**
2. Right-click your server name → **"Copy Server ID"**

---

## Step 4 — Configure Environment Variables (1 min)

1. Rename `.env.example` to `.env`
2. Fill in:
```
DISCORD_TOKEN=paste_your_bot_token
CLIENT_ID=paste_your_application_id
GUILD_ID=paste_your_server_id
```

---

## Step 5 — Run the Bot (2 min)

**Option A: Run locally (your computer)**
```bash
npm install
npm start
```

**Option B: Host on Railway (free, always online)**
1. Go to https://railway.app → sign up free
2. Click "New Project" → "Deploy from GitHub repo"
3. Push this folder to GitHub first, then connect it
4. Add your environment variables in Railway's dashboard
5. Done — bot runs 24/7!

**Option C: Host on Replit (free, browser-based)**
1. Go to https://replit.com → create a Node.js repl
2. Upload these files
3. Add your .env variables in Replit's "Secrets" tab
4. Click Run

---

## Step 6 — Verify It's Working

Once running, you should see in your terminal:
```
✅ Bot online as YourBotName#1234
✅ Slash commands registered!
⏰ Daily digest scheduled for 8:00:00 AM
```

Then in Discord, type `/` and your commands should appear!

---

## Customizing SOPs

Edit `state.sops` in `bot.js` to add your own SOPs:

```javascript
'my-sop-name': {
  title: 'My Custom SOP Title',
  steps: [
    '1. First step',
    '2. Second step',
    '3. Third step',
  ]
},
```

---

## Need Help?
The bot stores data in memory — it resets when restarted.
For permanent storage, connect a database like Supabase (free tier available).
