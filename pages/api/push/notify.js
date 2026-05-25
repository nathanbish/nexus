import webpush from "web-push";
import fs from "fs";
import { listEmails } from "../../../lib/gmail";
import { listOutlookEmails } from "../../../lib/outlook";

const SUBS_FILE = "/tmp/push-subscriptions.json";
const SEEN_FILE = "/tmp/seen-emails.json";

webpush.setVapidDetails(
  "mailto:nexus@nexus.app",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

function loadSubs() {
  try { return JSON.parse(fs.readFileSync(SUBS_FILE, "utf8")); } catch { return []; }
}
function loadSeen() {
  try { return JSON.parse(fs.readFileSync(SEEN_FILE, "utf8")); } catch { return []; }
}
function saveSeen(seen) {
  fs.writeFileSync(SEEN_FILE, JSON.stringify(seen));
}

export default async function handler(req, res) {
  if (req.headers["x-cron-secret"] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const subs = loadSubs();
  const seen = loadSeen();
  const results = [];
  for (const sub of subs) {
    try {
      const emails = sub.provider === "google"
        ? await listEmails(sub.accessToken, 10)
        : await listOutlookEmails(sub.accessToken, 10);
      const newEmails = emails.filter(e => !seen.includes(e.id));
      if (newEmails.length > 0) {
        const payload = JSON.stringify({
          title: `${newEmails.length} new email${newEmails.length > 1 ? "s" : ""}`,
          body: newEmails[0].subject || "(no subject)",
          url: "/"
        });
        await webpush.sendNotification(sub.subscription, payload);
        newEmails.forEach(e => seen.push(e.id));
        saveSeen(seen.slice(-500));
        results.push({ email: sub.email, sent: newEmails.length });
      }
    } catch (e) {
      results.push({ email: sub.email, error: e.message });
    }
  }
  res.json({ ok: true, results });
}
