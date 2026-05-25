import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'
import { listEmails } from '../../../lib/gmail'
import { listOutlookEmails } from '../../../lib/outlook'

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  try {
    let emails = []
    if (session.provider === 'google') {
      emails = await listEmails(session.accessToken, { maxResults: 100, query: 'in:inbox' })
    } else if (session.provider === 'azure-ad') {
      emails = await listOutlookEmails(session.accessToken, { top: 100 })
    }
    res.json({ emails })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
}
