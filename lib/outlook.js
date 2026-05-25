const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

async function graphFetch(accessToken, path, options = {}) {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Graph API error ${res.status}: ${err}`)
  }
  return res.json()
}

export async function listOutlookEmails(accessToken, { top = 20, filter = '' } = {}) {
  const params = new URLSearchParams({
    $top: top,
    $orderby: 'receivedDateTime desc',
    $select: 'id,subject,from,toRecipients,receivedDateTime,bodyPreview,body,isRead,conversationId',
  })
  if (filter) params.set('$filter', filter)
  const data = await graphFetch(accessToken, `/me/mailFolders/inbox/messages?${params}`)
  return (data.value || []).map(parseOutlookMessage)
}

export async function sendOutlookEmail(accessToken, { to, subject, body, replyToId }) {
  if (replyToId) {
    await graphFetch(accessToken, `/me/messages/${replyToId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ message: { body: { contentType: 'Text', content: body } } }),
    })
  } else {
    await graphFetch(accessToken, '/me/sendMail', {
      method: 'POST',
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: 'Text', content: body },
          toRecipients: [{ emailAddress: { address: to } }],
        },
      }),
    })
  }
}

export async function listOutlookCalendarEvents(accessToken, { days = 7 } = {}) {
  const now = new Date().toISOString()
  const end = new Date(Date.now() + days * 86400000).toISOString()
  const params = new URLSearchParams({
    startDateTime: now,
    endDateTime: end,
    $select: 'id,subject,start,end,location,organizer,attendees,bodyPreview',
    $orderby: 'start/dateTime',
    $top: 50,
  })
  const data = await graphFetch(accessToken, `/me/calendarView?${params}`)
  return data.value || []
}

export async function createOutlookCalendarEvent(accessToken, { subject, start, end, location, attendees = [], body = '' }) {
  return graphFetch(accessToken, '/me/events', {
    method: 'POST',
    body: JSON.stringify({
      subject,
      body: { contentType: 'Text', content: body },
      start: { dateTime: start, timeZone: 'UTC' },
      end: { dateTime: end, timeZone: 'UTC' },
      location: { displayName: location || '' },
      attendees: attendees.map(a => ({ emailAddress: { address: a }, type: 'required' })),
    }),
  })
}

function parseOutlookMessage(msg) {
  return {
    id: msg.id,
    threadId: msg.conversationId,
    from: msg.from?.emailAddress?.address || '',
    fromName: msg.from?.emailAddress?.name || '',
    subject: msg.subject || '(no subject)',
    date: msg.receivedDateTime,
    snippet: msg.bodyPreview || '',
    body: msg.body?.content || '',
    isUnread: !msg.isRead,
    provider: 'outlook',
  }
}
