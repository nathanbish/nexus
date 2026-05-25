import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'
import { listEmails } from '../../../lib/gmail'
import { listOutlookEmails } from '../../../lib/outlook'
import { prioritizeEmails } from '../../../lib/ai'

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  try {
    let emails = []

    if (session.provider === 'google') {
      emails = await listEmails(session.accessToken, { maxResults: 25 })
    } else if (session.provider === 'azure-ad') {
      emails = await listOutlookEmails(session.accessToken, { top: 25 })
    }

    const prioritized = req.query.prioritize === 'true'
      ? await prioritizeEmails(emails)
      : null

    res.json({ emails, prioritized })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
}
