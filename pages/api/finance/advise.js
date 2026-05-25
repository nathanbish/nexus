import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'
import { financialAdvice } from '../../../lib/ai'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  const { question, financialContext } = req.body

  try {
    const advice = await financialAdvice(question, financialContext)
    res.json({ advice })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
}
