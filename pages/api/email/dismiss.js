import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'
import { dismissEmail } from '../../../lib/gmail'

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  if (req.method !== 'POST') return res.status(405).end()

  const { messageId } = req.body
  if (!messageId) return res.status(400).json({ error: 'messageId required' })

  try {
    if (session.provider === 'google') {
      await dismissEmail(session.accessToken, messageId)
    }
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
}
