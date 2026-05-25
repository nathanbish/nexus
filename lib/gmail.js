import { google } from 'googleapis'

export function getGmailClient(accessToken) {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  return google.gmail({ version: 'v1', auth })
}

export async function listEmails(accessToken, { maxResults = 100, query = '' } = {}) {
  const gmail = getGmailClient(accessToken)
  const q = query || '(is:unread OR newer_than:3m) -label:nexus-dismissed in:inbox'
  const res = await gmail.users.messages.list({ userId: 'me', maxResults, q })
  const messages = res.data.messages || []
  const full = await Promise.all(
    messages.map(m =>
      gmail.users.messages.get({ userId: 'me', id: m.id, format: 'full' })
    )
  )
  return full.map(r => parseMessage(r.data))
}

export async function dismissEmail(accessToken, messageId) {
  const gmail = getGmailClient(accessToken)
  // Ensure label exists
  let labelId
  try {
    const labels = await gmail.users.labels.list({ userId: 'me' })
    const existing = (labels.data.labels || []).find(l => l.name === 'nexus-dismissed')
    if (existing) {
      labelId = existing.id
    } else {
      const created = await gmail.users.labels.create({
        userId: 'me',
        requestBody: { name: 'nexus-dismissed', labelListVisibility: 'labelHide', messageListVisibility: 'hide' }
      })
      labelId = created.data.id
    }
  } catch (e) {
    console.error('Label error:', e)
    return
  }
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: { addLabelIds: [labelId] }
  })
}

export async function sendEmail(accessToken, { to, subject, body, replyToMessageId, threadId }) {
  const gmail = getGmailClient(accessToken)
  const raw = makeRaw({ to, subject, body, replyToMessageId })
  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw, threadId },
  })
}

function makeRaw({ to, subject, body, replyToMessageId }) {
  const lines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    replyToMessageId ? `In-Reply-To: ${replyToMessageId}` : '',
    '',
    body,
  ].filter(l => l !== undefined)
  return Buffer.from(lines.join('\r\n')).toString('base64url')
}

function parseMessage(msg) {
  const headers = msg.payload?.headers || []
  const get = name => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ''
  const body = extractBody(msg.payload)
  return {
    id: msg.id,
    threadId: msg.threadId,
    from: get('From'),
    to: get('To'),
    subject: get('Subject'),
    date: get('Date'),
    snippet: msg.snippet,
    body,
    labels: msg.labelIds || [],
    isUnread: (msg.labelIds || []).includes('UNREAD'),
  }
}

function extractBody(payload) {
  if (!payload) return ''
  if (payload.body?.data) return Buffer.from(payload.body.data, 'base64url').toString('utf-8')
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64url').toString('utf-8')
      }
    }
    for (const part of payload.parts) {
      const nested = extractBody(part)
      if (nested) return nested
    }
  }
  return ''
}
