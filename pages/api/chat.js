import Anthropic from '@anthropic-ai/sdk'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth/[...nextauth]'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const config = { api: { bodyParser: true } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  const { messages, financialContext } = req.body

  const systemPrompt = `You are Nexus, a highly capable personal AI assistant. You help with email management, task prioritization, calendar scheduling, financial advice, and any questions the user has. You are direct, intelligent, and practical.

Today's date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
User's email provider: ${session.provider === 'google' ? 'Gmail' : 'Outlook'}

${financialContext ? `User's financial context:\n${JSON.stringify(financialContext, null, 2)}\n` : ''}

When giving financial advice, note you're an AI providing information, not a licensed advisor.`

  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Transfer-Encoding', 'chunked')
  res.setHeader('Cache-Control', 'no-cache')

  try {
    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    })

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        res.write(chunk.delta.text)
      }
    }
    res.end()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
}
