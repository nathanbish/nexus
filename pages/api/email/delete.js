import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'
import { getGmailClient, sendEmail } from '../../../lib/gmail'

const CU_EMAILS = ["nathan.bish@colorado.edu", "nabi2561@colorado.edu"];
const MOVEMENT_EMAIL = "nathan.bish@movementgyms.com";

const getOutlookAddresses = (email) => {
  const from = (email.from || "").toLowerCase();
  const addrs = [];
  if (from.includes("colorado.edu")) addrs.push(...CU_EMAILS);
  if (from.includes("movementgyms.com")) addrs.push(MOVEMENT_EMAIL);
  return addrs;
};

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  
  const { emailIds, emails } = req.body
  
  try {
    const gmail = getGmailClient(session.accessToken)
    
    // Trash in Gmail
    await Promise.all(emailIds.map(id =>
      gmail.users.messages.trash({ userId: 'me', id })
    ))

    // Send [Marked for Deletion] notifications to Outlook inboxes
    if (emails && emails.length > 0) {
      for (const email of emails) {
        const outlookAddrs = getOutlookAddresses(email);
        for (const addr of outlookAddrs) {
          await sendEmail(session.accessToken, {
            to: addr,
            subject: `[Marked for Deletion]: ${email.subject || "(no subject)"}`,
            body: `This email thread has been marked for deletion in Nexus.\n\nOriginal sender: ${email.from}\nOriginal subject: ${email.subject}\n\nYou can safely delete this thread from your Outlook inbox.`
          });
        }
      }
    }

    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
}
