import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MODEL = 'claude-sonnet-4-20250514'

export async function streamChat(messages, systemPrompt) {
  return client.messages.stream({
    model: MODEL,
    max_tokens: 2048,
    system: systemPrompt || SYSTEM_NEXUS,
    messages,
  })
}

export async function chat(messages, systemPrompt) {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: systemPrompt || SYSTEM_NEXUS,
    messages,
  })
  return res.content[0].text
}

export async function summarizeEmail(email) {
  return chat([{
    role: 'user',
    content: `Summarize this email and identify: (1) urgency level (urgent/normal/fyi), (2) any deadlines mentioned, (3) any meeting requests, (4) required action items. Be concise.\n\nFrom: ${email.from}\nSubject: ${email.subject}\nDate: ${email.date}\n\n${email.body}`,
  }], SYSTEM_EMAIL)
}

export async function prioritizeEmails(emails) {
  const list = emails.map((e, i) => `[${i}] From: ${e.from} | Subject: ${e.subject} | Preview: ${e.snippet}`).join('\n')
  const res = await chat([{
    role: 'user',
    content: `Prioritize these emails from most to least urgent. For each, give: index, priority (urgent/high/normal/low), reason (one sentence), and whether it contains a deadline or meeting request. Respond as JSON array.\n\n${list}`,
  }], SYSTEM_EMAIL)
  try {
    const clean = res.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return []
  }
}

export async function draftReply(email, userInstruction) {
  return chat([{
    role: 'user',
    content: `Draft a professional email reply.\n\nOriginal email:\nFrom: ${email.from}\nSubject: ${email.subject}\n${email.body}\n\nMy instructions: ${userInstruction || 'Write a professional, concise reply'}`,
  }], SYSTEM_EMAIL)
}

export async function scanEmails(emails) {
  const list = emails.map((e, i) =>
    `[${i}] From: ${e.from}\nSubject: ${e.subject}\nDate: ${e.date}\nSnippet: ${e.snippet || ''}\nBody: ${(e.body || '').slice(0, 400)}`
  ).join('\n---\n')

  const res = await chat([{
    role: 'user',
    content: `Analyze these inbox emails and return a JSON object with two arrays:

1. "items": deadlines and meeting requests with specific dates/times. Each object: { type: "deadline"|"meeting", title, date, time, from, emailSubject, description }. Only include items with specific dates or times mentioned.

2. "needsReply": emails where the sender is clearly expecting a response from Nathan — questions asked, requests made, invitations requiring RSVP, follow-ups awaiting answers. Each object: { index, from, subject, reason }. Exclude newsletters, receipts, notifications, automated emails, and anything where no human response is expected.

Return only valid JSON, no explanation.

Emails:
${list}`,
  }], SYSTEM_EMAIL)

  try {
    const clean = res.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    return {
      items: parsed.items || [],
      needsReply: parsed.needsReply || [],
    }
  } catch {
    return { items: [], needsReply: [] }
  }
}

export async function detectDeadlinesAndMeetings(emails) {
  const list = emails.map(e => `From: ${e.from}\nSubject: ${e.subject}\nDate: ${e.date}\nBody: ${e.body?.slice(0, 500)}`).join('\n---\n')
  const res = await chat([{
    role: 'user',
    content: `Scan these emails and extract all deadlines and meeting requests. Return JSON array with objects: { type: "deadline"|"meeting", title, date, time, from, emailSubject, description }. Only include items with specific dates/times mentioned.\n\n${list}`,
  }], SYSTEM_EMAIL)
  try {
    const clean = res.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return []
  }
}

export async function sortTasks(tasks) {
  const list = JSON.stringify(tasks)
  const res = await chat([{
    role: 'user',
    content: `Sort and prioritize these tasks. Consider due date, importance, and urgency. Return the same array sorted, with a "aiPriority" field (1=highest) and "aiReason" (one sentence why). Return JSON array only.\n\n${list}`,
  }], SYSTEM_TASKS)
  try {
    const clean = res.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return tasks
  }
}

export async function breakdownTask(taskName) {
  return chat([{
    role: 'user',
    content: `Break this task into 3-6 specific, actionable sub-tasks: "${taskName}". Return JSON array of strings only.`,
  }], SYSTEM_TASKS)
}

export async function financialAdvice(question, financialContext) {
  return chat([{
    role: 'user',
    content: `Financial context:\n${JSON.stringify(financialContext, null, 2)}\n\nQuestion: ${question}`,
  }], SYSTEM_FINANCE)
}

const SYSTEM_NEXUS = `You are Nexus, a highly capable personal AI assistant and command center. You help with email management, task prioritization, calendar scheduling, financial advice, and general questions. You are direct, intelligent, and practical. Today's date is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`

const SYSTEM_EMAIL = `You are an expert email manager. You read, summarize, prioritize, and draft emails with precision. Be concise and action-oriented. Today's date is ${new Date().toLocaleDateString()}.`

const SYSTEM_TASKS = `You are an expert productivity coach and task manager. You prioritize tasks based on urgency, importance, deadlines, and dependencies. Be decisive and practical.`

const SYSTEM_FINANCE = `You are a knowledgeable financial advisor assistant. You provide thoughtful analysis on budgeting, debt management, credit, investing, and financial decisions. Always clarify you are an AI providing information, not a licensed financial advisor, and recommend consulting a professional for major decisions. Base advice on sound financial principles and current market context.`
