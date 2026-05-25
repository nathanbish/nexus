import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'
import { listEmails } from '../../../lib/gmail'
import { listOutlookEmails } from '../../../lib/outlook'
import { detectDeadlinesAndMeetings } from '../../../lib/ai'

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  try {
    let emails = []
    if (session.provider === 'google') {
      emails = await listEmails(session.accessToken, { maxResults: 30, query: 'in:inbox newer_than:7d' })
    } else {
      emails = await listOutlookEmails(session.accessToken, { top: 30 })
    }

    const items = await detectDeadlinesAndMeetings(emails)
    res.json({ items })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
}
