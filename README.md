# Nexus Command Center — Setup Guide

## What this is
A personal AI dashboard: email (Gmail + Outlook), tasks, calendar, AI chat, and financial advisor.
Works on Mac (browser) and iPhone (add to home screen as PWA).

---

## Step 1 — Get your API keys (20–30 min total)

### A) Anthropic API key (5 min)
1. Go to https://console.anthropic.com
2. API Keys → Create Key
3. Copy it — you'll add it to `.env.local`

### B) Gmail / Google Calendar (10 min)
1. Go to https://console.cloud.google.com
2. Create a new project (e.g. "Nexus")
3. APIs & Services → Enable APIs:
   - Gmail API
   - Google Calendar API
4. APIs & Services → Credentials → Create OAuth 2.0 Client ID
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
   - For production add: `https://yourdomain.vercel.app/api/auth/callback/google`
5. Copy Client ID and Client Secret

### C) Outlook / Microsoft (10 min)
1. Go to https://portal.azure.com
2. Azure Active Directory → App registrations → New registration
   - Name: Nexus
   - Supported account types: Accounts in any organizational directory AND personal Microsoft accounts
   - Redirect URI: Web → `http://localhost:3000/api/auth/callback/azure-ad`
3. After creation, go to API Permissions → Add:
   - Microsoft Graph → Delegated: `Mail.Read`, `Mail.Send`, `Calendars.ReadWrite`, `offline_access`
4. Certificates & secrets → New client secret → Copy the VALUE (not the ID)
5. Overview → Copy Application (client) ID
6. For second Outlook account: same app, users just sign in separately

---

## Step 2 — Configure environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```
ANTHROPIC_API_KEY=sk-ant-...
NEXTAUTH_SECRET=<run: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_SECRET=your-secret-value
```

---

## Step 3 — Install and run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 — sign in with Gmail or Outlook.

---

## Step 4 — Deploy to Vercel (Mac + iPhone access)

1. Push this folder to a GitHub repo:
   ```bash
   git init
   git add .
   git commit -m "Nexus initial"
   gh repo create nexus --private --push --source=.
   ```

2. Go to https://vercel.com → New Project → Import your repo

3. Add all environment variables from `.env.local` in Vercel's dashboard
   - Change `NEXTAUTH_URL` to your Vercel URL: `https://nexus-xxx.vercel.app`

4. Update OAuth redirect URIs:
   - Google Console: add `https://nexus-xxx.vercel.app/api/auth/callback/google`
   - Azure Portal: add `https://nexus-xxx.vercel.app/api/auth/callback/azure-ad`

5. Redeploy on Vercel → Done!

---

## Step 5 — Install on iPhone as PWA

1. Open your Vercel URL in Safari on iPhone
2. Tap the Share button (box with arrow)
3. Tap "Add to Home Screen"
4. Tap "Add"

Nexus now appears on your home screen like a native app, full screen, no browser bar.

---

## Using Nexus

### Email
- Sign in with Gmail OR Outlook (you can sign in with one at a time)
- Click "Refresh inbox" to load emails
- Click any email → AI summary appears automatically
- Add reply instructions → "Draft reply with AI" → edit → Send
- "Scan for deadlines & meetings" → detects dates/times → add as tasks

### Tasks
- Type a task → Enter or click Add
- Click the circle to complete
- "AI sort" — Nexus re-orders by urgency, importance, due date

### Finance
- Enter your balances manually anytime (nothing is stored on a server — lives in your browser)
- Ask any financial question in the text box
- Quick-tap preset questions for common advice

### Ask Nexus (chat)
- Full AI chat with context about your financial data
- Ask anything: emails, advice, questions, help drafting

---

## File structure

```
nexus/
├── pages/
│   ├── index.js          ← Main dashboard UI
│   ├── _app.js           ← App wrapper
│   ├── _document.js      ← PWA meta tags
│   ├── auth/signin.js    ← Login page
│   └── api/
│       ├── auth/         ← NextAuth (Google + Microsoft)
│       ├── chat.js       ← Streaming AI chat
│       ├── email/
│       │   ├── list.js   ← Fetch inbox
│       │   ├── summarize.js  ← AI email summary
│       │   ├── reply.js  ← Draft & send replies
│       │   └── scan.js   ← Detect deadlines/meetings
│       ├── tasks/sort.js ← AI task prioritization
│       └── finance/advise.js ← Financial advice
├── lib/
│   ├── gmail.js          ← Gmail API helper
│   ├── outlook.js        ← Microsoft Graph helper
│   └── ai.js             ← Anthropic prompts & helpers
├── styles/globals.css
├── public/manifest.json  ← PWA manifest
└── .env.local.example    ← Copy → .env.local
```

---

## Second Outlook account
To use a second Outlook account: sign out, sign in with the second Microsoft account. The same Azure app handles both — no extra setup needed. For truly simultaneous dual-inbox, that requires additional session management (reach out for a custom build).

## Costs
- Vercel hosting: Free tier covers personal use
- Anthropic API: ~$0.003 per email summary, ~$0.01 per chat message (very low for personal use)
- Google/Microsoft APIs: Free for personal use volumes
