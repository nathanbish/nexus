import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'
import { scanEmails } from '../../../lib/ai'

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const { emails } = req.body
    if (!emails || !emails.length) return res.json({ items: [], needsReply: [] })

    const result = await scanEmails(emails)
    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
}
