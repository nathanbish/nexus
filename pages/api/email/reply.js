import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'
import { draftReply } from '../../../lib/ai'
import { getGmailClient } from '../../../lib/gmail'
import { sendOutlookEmail } from '../../../lib/outlook'

function makeHtmlEmail(body) {
  const lines = body.split('\n').map(l => `<p style="margin:0 0 8px 0">${l || '&nbsp;'}</p>`).join('');
  return `<div style="font-family:'Times New Roman',Times,serif;font-size:12pt;color:#000000;">${lines}</div>`;
}

function makeRaw({ to, subject, body, replyToMessageId, threadId }) {
  const htmlBody = makeHtmlEmail(body);
  const boundary = 'nexus_boundary_' + Date.now();
  const lines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    replyToMessageId ? `In-Reply-To: ${replyToMessageId}` : '',
    replyToMessageId ? `References: ${replyToMessageId}` : '',
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    htmlBody,
    '',
    `--${boundary}--`,
  ].filter(l => l !== undefined);
  return Buffer.from(lines.join('\r\n')).toString('base64url');
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  const { email, instructions, send, draftBody } = req.body

  const cleanDraft = (text) => {
    return text
      .replace(/\*\*/g, '')
      .replace(/^Subject:.*\n?/gim, '')
      .replace(/^\s*\n/, '')
      .trim()
  }

  try {
          const rawDraft = draftBody !== undefined ? draftBody : await draftReply(email, instructions)
    const draft = draftBody !== undefined ? rawDraft : cleanDraft(rawDraft)

    if (send) {
      const to = email.from.match(/<(.+)>/)?.[1] || email.from
      if (session.provider === 'google') {
        const gmail = getGmailClient(session.accessToken)
        const raw = makeRaw({
          to,
          subject: `Re: ${email.subject}`,
          body: draft,
          replyToMessageId: email.id,
          threadId: email.threadId
        })
        await gmail.users.messages.send({
          userId: 'me',
          requestBody: { raw, threadId: email.threadId }
        })
      } else {
        await sendOutlookEmail(session.accessToken, to, `Re: ${email.subject}`, draft)
      }
      return res.json({ sent: true, draft })
    }

    res.json({ draft })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
}
