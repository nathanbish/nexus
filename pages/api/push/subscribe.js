import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import fs from "fs";

const SUBS_FILE = "/tmp/push-subscriptions.json";

function loadSubs() {
  try { return JSON.parse(fs.readFileSync(SUBS_FILE, "utf8")); } catch { return []; }
}
function saveSubs(subs) {
  fs.writeFileSync(SUBS_FILE, JSON.stringify(subs));
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (req.method === "POST") {
    const { subscription } = req.body;
    const subs = loadSubs();
    const exists = subs.find(s => s.endpoint === subscription.endpoint);
    if (!exists) {
      subs.push({ subscription, email: session.user.email, provider: session.provider, accessToken: session.accessToken });
      saveSubs(subs);
    }
    return res.json({ ok: true });
  }
  res.status(405).end();
}
