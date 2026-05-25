import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'
import { draftReply } from '../../../lib/ai'
import { sendEmail } from '../../../lib/gmail'
import { sendOutlookEmail } from '../../../lib/outlook'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  const { email, instruction, action, draftBody, provider } = req.body

  try {
    if (action === 'draft') {
      const draft = await draftReply(email, instruction)
      return res.json({ draft })
    }

    if (action === 'send') {
      const emailProvider = provider || session.provider
      if (emailProvider === 'google') {
        await sendEmail(session.accessToken, {
          to: email.from,
          subject: `Re: ${email.subject}`,
          body: draftBody,
          replyToMessageId: email.id,
          threadId: email.threadId,
        })
      } else {
        await sendOutlookEmail(session.accessToken, {
          to: email.from,
          subject: `Re: ${email.subject}`,
          body: draftBody,
          replyToId: email.id,
        })
      }
      return res.json({ sent: true })
    }

    res.status(400).json({ error: 'Unknown action' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
}
