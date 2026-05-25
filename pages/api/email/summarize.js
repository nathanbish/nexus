import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'
import { summarizeEmail, detectDeadlinesAndMeetings } from '../../../lib/ai'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  const { email, mode } = req.body

  try {
    if (mode === 'summarize') {
      const summary = await summarizeEmail(email)
      return res.json({ summary })
    }
    if (mode === 'detect') {
      const items = await detectDeadlinesAndMeetings([email])
      return res.json({ items })
    }
    res.status(400).json({ error: 'Unknown mode' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
}
