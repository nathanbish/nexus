import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useEffect, useState, useRef, useCallback } from 'react'

const PRIORITY_COLORS = { high: '#ef4444', med: '#f59e0b', low: '#22c55e' }
const TAG_STYLES = {
  urgent: { bg: '#fef2f2', color: '#dc2626' },
  high:   { bg: '#fef2f2', color: '#dc2626' },
  meeting:{ bg: '#fffbeb', color: '#d97706' },
  deadline:{ bg: '#eff6ff', color: '#2563eb' },
  normal: { bg: '#f3f4f6', color: '#6b7280' },
  low:    { bg: '#f0fdf4', color: '#16a34a' },
  fyi:    { bg: '#f3f4f6', color: '#6b7280' },
  alert:  { bg: '#fffbeb', color: '#d97706' },
}

function Tag({ type, children }) {
  const s = TAG_STYLES[type] || TAG_STYLES.normal
  return <span style={{ background: s.bg, color: s.color, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500 }}>{children}</span>
}

function Card({ children, style = {} }) {
  return <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: 16, ...style }}>{children}</div>
}

function Btn({ children, onClick, primary, style = {}, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 12.5, borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer', border: primary ? 'none' : '0.5px solid #d1d5db', background: primary ? '#1c1c1e' : '#fff', color: primary ? '#fff' : '#6b7280', opacity: disabled ? 0.5 : 1, transition: 'background 0.1s', fontFamily: 'inherit', fontWeight: 500, ...style }}>
      {children}
    </button>
  )
}

const DEFAULT_TASKS = [
  { id: 1, name: 'Review Q3 board deck', dueDate: new Date().toISOString().slice(0,10), priority: 'high', category: 'Work', done: false },
  { id: 2, name: 'Respond to contract renewal email', dueDate: '', priority: 'high', category: 'Legal', done: false },
  { id: 3, name: 'Schedule strategy sync meeting', dueDate: '', priority: 'med', category: 'Admin', done: false },
  { id: 4, name: 'Review monthly budget', dueDate: '', priority: 'low', category: 'Finance', done: false },
]

const DEFAULT_FINANCE = {
  accounts: [
    { name: 'Chase Checking', balance: '', type: 'checking' },
    { name: 'Amex Platinum', balance: '', type: 'credit', limit: '' },
    { name: 'Wells Fargo Savings', balance: '', type: 'savings' },
    { name: 'Chase Sapphire', balance: '', type: 'credit', limit: '' },
  ],
  creditScore: '',
  monthlyIncome: '',
  notes: '',
}

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [panel, setPanel] = useState('overview')
  const [emails, setEmails] = useState([])
  const [emailsLoading, setEmailsLoading] = useState(false)
  const [selectedEmail, setSelectedEmail] = useState(null)
  const [emailSummary, setEmailSummary] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [draftReply, setDraftReply] = useState('')
  const [draftLoading, setDraftLoading] = useState(false)
  const [replyInstruction, setReplyInstruction] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  const [tasks, setTasks] = useState(DEFAULT_TASKS)
  const [newTask, setNewTask] = useState({ name: '', dueDate: '', priority: 'med', category: 'Work' })
  const [sortingTasks, setSortingTasks] = useState(false)
  const [chatMessages, setChatMessages] = useState([{ role: 'assistant', content: "Hi! I'm Nexus. I can read your emails, manage your tasks, give financial advice, and answer anything. What would you like to do?" }])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [finance, setFinance] = useState(DEFAULT_FINANCE)
  const [financeQuestion, setFinanceQuestion] = useState('')
  const [financeAnswer, setFinanceAnswer] = useState('')
  const [financeLoading, setFinanceLoading] = useState(false)
  const [scannedItems, setScannedItems] = useState([])
  const [scanLoading, setScanLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const chatEndRef = useRef(null)

  useEffect(() => { if (status === 'unauthenticated') router.push('/auth/signin') }, [status])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])

  const fetchEmails = useCallback(async () => {
    setEmailsLoading(true)
    try {
      const res = await fetch('/api/email/list')
      const data = await res.json()
      setEmails(data.emails || [])
    } catch (e) { console.error(e) }
    setEmailsLoading(false)
  }, [])

  useEffect(() => { if (session && panel === 'email') fetchEmails() }, [panel, session])

  const summarize = async (email) => {
    setSelectedEmail(email)
    setEmailSummary('')
    setDraftReply('')
    setSummaryLoading(true)
    try {
      const res = await fetch('/api/email/summarize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, mode: 'summarize' }) })
      const data = await res.json()
      setEmailSummary(data.summary || '')
    } catch (e) { setEmailSummary('Error summarizing email.') }
    setSummaryLoading(false)
  }

  const getDraft = async () => {
    setDraftLoading(true)
    setDraftReply('')
    try {
      const res = await fetch('/api/email/reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: selectedEmail, instruction: replyInstruction, action: 'draft' }) })
      const data = await res.json()
      setDraftReply(data.draft || '')
    } catch (e) { setDraftReply('Error drafting reply.') }
    setDraftLoading(false)
  }

  const sendReply = async () => {
    setSendingEmail(true)
    try {
      await fetch('/api/email/reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: selectedEmail, action: 'send', draftBody: draftReply }) })
      alert('Reply sent!')
      setDraftReply('')
      setSelectedEmail(null)
    } catch (e) { alert('Error sending email') }
    setSendingEmail(false)
  }

  const scanInbox = async () => {
    setScanLoading(true)
    try {
      const res = await fetch('/api/email/scan')
      const data = await res.json()
      setScannedItems(data.items || [])
    } catch (e) { console.error(e) }
    setScanLoading(false)
  }

  const addTaskFromScan = (item) => {
    const t = { id: Date.now(), name: item.title || item.description, dueDate: item.date || '', priority: 'high', category: item.type === 'meeting' ? 'Meetings' : 'Work', done: false }
    setTasks(prev => [t, ...prev])
  }

  const addTask = () => {
    if (!newTask.name.trim()) return
    setTasks(prev => [{ ...newTask, id: Date.now(), done: false }, ...prev])
    setNewTask({ name: '', dueDate: '', priority: 'med', category: 'Work' })
  }

  const toggleTask = (id) => setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t))

  const aiSortTasks = async () => {
    setSortingTasks(true)
    try {
      const res = await fetch('/api/tasks/sort', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tasks: tasks.filter(t => !t.done), action: 'sort' }) })
      const data = await res.json()
      if (data.tasks) setTasks(prev => [...data.tasks, ...prev.filter(t => t.done)])
    } catch (e) { console.error(e) }
    setSortingTasks(false)
  }

  const sendChat = async () => {
    const text = chatInput.trim()
    if (!text || chatLoading) return
    setChatInput('')
    const newMessages = [...chatMessages, { role: 'user', content: text }]
    setChatMessages(newMessages)
    setChatLoading(true)

    try {
      const apiMessages = newMessages.filter(m => m.role !== 'assistant' || newMessages.indexOf(m) > 0).map(m => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: apiMessages, financialContext: finance }) })
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      setChatMessages(prev => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullText += decoder.decode(value)
        setChatMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: fullText }])
      }
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }])
    }
    setChatLoading(false)
  }

  const askFinance = async () => {
    if (!financeQuestion.trim()) return
    setFinanceLoading(true)
    setFinanceAnswer('')
    try {
      const res = await fetch('/api/finance/advise', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: financeQuestion, financialContext: finance }) })
      const data = await res.json()
      setFinanceAnswer(data.advice || '')
    } catch (e) { setFinanceAnswer('Error getting advice.') }
    setFinanceLoading(false)
  }

  if (status === 'loading') return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 14, color: '#6b7280' }}>Loading...</div>
  if (!session) return null

  const navItems = [
    { id: 'overview', label: 'Overview', icon: '⊞' },
    { id: 'email', label: 'Inbox', icon: '✉' },
    { id: 'tasks', label: 'Tasks', icon: '✓' },
    { id: 'calendar', label: 'Calendar', icon: '📅' },
    { id: 'chat', label: 'Ask Nexus', icon: '✦' },
    { id: 'finance', label: 'Finance', icon: '$' },
  ]

  const todayTasks = tasks.filter(t => !t.done && t.dueDate === new Date().toISOString().slice(0,10))
  const undoneTasks = tasks.filter(t => !t.done)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`} style={{ width: 220, background: '#fff', borderRight: '0.5px solid #e5e7eb', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '20px 18px 16px', borderBottom: '0.5px solid #e5e7eb' }}>
          <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: -0.3 }}>Nexus</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{session.user?.email}</div>
        </div>
        <div style={{ flex: 1, paddingTop: 8, overflowY: 'auto' }}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => { setPanel(item.id); setSidebarOpen(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px', margin: '1px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 13.5, color: panel === item.id ? '#1c1c1e' : '#6b7280', background: panel === item.id ? '#f3f4f6' : 'none', border: 'none', width: 'calc(100% - 16px)', textAlign: 'left', fontFamily: 'inherit', fontWeight: panel === item.id ? 500 : 400, transition: 'background 0.1s' }}>
              <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>{item.icon}</span>
              {item.label}
              {item.id === 'email' && emails.filter(e => e.isUnread).length > 0 && <span style={{ marginLeft: 'auto', fontSize: 10, background: '#fef2f2', color: '#dc2626', padding: '1px 6px', borderRadius: 20, fontWeight: 500 }}>{emails.filter(e => e.isUnread).length}</span>}
              {item.id === 'tasks' && undoneTasks.length > 0 && <span style={{ marginLeft: 'auto', fontSize: 10, background: '#f3f4f6', color: '#6b7280', padding: '1px 6px', borderRadius: 20, fontWeight: 500 }}>{undoneTasks.length}</span>}
            </button>
          ))}
        </div>
        <div style={{ padding: '12px 10px', borderTop: '0.5px solid #e5e7eb' }}>
          <button onClick={() => signOut({ callbackUrl: '/auth/signin' })} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#9ca3af', background: 'none', border: 'none', width: '100%', textAlign: 'left', fontFamily: 'inherit' }}>
            ⎋ Sign out
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Topbar */}
        <div style={{ height: 56, background: '#fff', borderBottom: '0.5px solid #e5e7eb', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12, flexShrink: 0 }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ display: 'none', border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', padding: 4 }} className="mobile-menu">☰</button>
          <span style={{ fontSize: 15, fontWeight: 500, flex: 1, color: '#1c1c1e' }}>{navItems.find(n => n.id === panel)?.label}</span>
          <Btn onClick={() => { setPanel('tasks'); setTimeout(() => document.getElementById('new-task-input')?.focus(), 100) }}>+ New task</Btn>
          <Btn primary onClick={() => setPanel('chat')}>✦ Ask Nexus</Btn>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

          {/* OVERVIEW */}
          {panel === 'overview' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
                {[
                  { label: 'Unread emails', value: emails.filter(e => e.isUnread).length || '—', sub: 'Load inbox to sync' },
                  { label: 'Tasks due today', value: todayTasks.length, sub: `${undoneTasks.length} total open` },
                  { label: 'Open tasks', value: undoneTasks.length, sub: 'Across all categories' },
                  { label: 'Credit score', value: finance.creditScore || '—', sub: finance.creditScore ? 'Updated manually' : 'Enter in Finance tab' },
                ].map((m, i) => (
                  <div key={i} style={{ background: '#f9fafb', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.4 }}>{m.label}</div>
                    <div style={{ fontSize: 26, fontWeight: 600, color: '#1c1c1e', lineHeight: 1 }}>{m.value}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{m.sub}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Card>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4 }}>Today's tasks</span>
                    <Btn onClick={() => setPanel('tasks')}>View all</Btn>
                  </div>
                  {undoneTasks.slice(0, 4).map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '0.5px solid #f3f4f6' }}>
                      <div onClick={() => toggleTask(t.id)} style={{ width: 16, height: 16, borderRadius: '50%', border: `1.5px solid ${PRIORITY_COLORS[t.priority]}`, marginTop: 1, flexShrink: 0, cursor: 'pointer' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: '#1c1c1e' }}>{t.name}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{t.category}{t.dueDate ? ` · Due ${t.dueDate}` : ''}</div>
                      </div>
                    </div>
                  ))}
                </Card>
                <Card>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4 }}>Quick actions</span>
                  </div>
                  {[
                    { label: '✉ Load & prioritize my inbox', action: () => { setPanel('email'); fetchEmails() } },
                    { label: '🔍 Scan for deadlines & meetings', action: () => { setPanel('email'); scanInbox() } },
                    { label: '✦ Ask Nexus anything', action: () => setPanel('chat') },
                    { label: '$ Update my financial data', action: () => setPanel('finance') },
                  ].map((q, i) => (
                    <button key={i} onClick={q.action} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', marginBottom: 6, borderRadius: 8, border: '0.5px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151', fontFamily: 'inherit', transition: 'background 0.1s' }}
                      onMouseOver={e => e.currentTarget.style.background = '#f9fafb'} onMouseOut={e => e.currentTarget.style.background = '#fff'}>
                      {q.label}
                    </button>
                  ))}
                </Card>
              </div>
            </div>
          )}

          {/* EMAIL */}
          {panel === 'email' && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <Btn onClick={fetchEmails} disabled={emailsLoading}>{emailsLoading ? 'Loading...' : '↻ Refresh inbox'}</Btn>
                <Btn onClick={scanInbox} disabled={scanLoading}>{scanLoading ? 'Scanning...' : '🔍 Scan for deadlines & meetings'}</Btn>
              </div>

              {scannedItems.length > 0 && (
                <Card style={{ marginBottom: 14, background: '#fffbeb', border: '0.5px solid #fde68a' }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#92400e', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 }}>Detected from inbox</div>
                  {scannedItems.map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < scannedItems.length - 1 ? '0.5px solid #fde68a' : 'none' }}>
                      <Tag type={item.type === 'meeting' ? 'meeting' : 'deadline'}>{item.type}</Tag>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#1c1c1e' }}>{item.title}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{item.date} {item.time} · from {item.from}</div>
                      </div>
                      <Btn onClick={() => addTaskFromScan(item)} style={{ fontSize: 11 }}>+ Add task</Btn>
                    </div>
                  ))}
                </Card>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: selectedEmail ? '1fr 1fr' : '1fr', gap: 14 }}>
                <Card style={{ maxHeight: 600, overflowY: 'auto' }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 12 }}>
                    Inbox · {emails.length} emails{emails.filter(e => e.isUnread).length > 0 ? ` · ${emails.filter(e => e.isUnread).length} unread` : ''}
                  </div>
                  {emailsLoading && <div style={{ fontSize: 13, color: '#9ca3af', padding: '20px 0', textAlign: 'center' }}>Loading emails...</div>}
                  {!emailsLoading && emails.length === 0 && <div style={{ fontSize: 13, color: '#9ca3af', padding: '20px 0', textAlign: 'center' }}>Click "Refresh inbox" to load your emails.</div>}
                  {emails.map((email, i) => (
                    <div key={email.id || i} onClick={() => summarize(email)}
                      style={{ padding: '11px 0', borderBottom: i < emails.length - 1 ? '0.5px solid #f3f4f6' : 'none', cursor: 'pointer', opacity: email.isUnread ? 1 : 0.7 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
                          {(email.fromName || email.from || '?').slice(0, 2).toUpperCase()}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: email.isUnread ? 600 : 400, color: '#1c1c1e', flex: 1 }}>{email.fromName || email.from}</span>
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(email.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div style={{ fontSize: 13, color: '#374151', marginLeft: 36, marginBottom: 2, fontWeight: email.isUnread ? 500 : 400 }}>{email.subject}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af', marginLeft: 36 }}>{email.snippet?.slice(0, 80)}...</div>
                    </div>
                  ))}
                </Card>

                {selectedEmail && (
                  <Card style={{ maxHeight: 600, overflowY: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1c1c1e', flex: 1, lineHeight: 1.3 }}>{selectedEmail.subject}</div>
                      <button onClick={() => setSelectedEmail(null)} style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: '#9ca3af', padding: '0 0 0 8px' }}>×</button>
                    </div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>From: {selectedEmail.from} · {new Date(selectedEmail.date).toLocaleString()}</div>

                    {summaryLoading && <div style={{ fontSize: 13, color: '#6b7280', background: '#f9fafb', borderRadius: 8, padding: 12, marginBottom: 12 }}>Summarizing...</div>}
                    {emailSummary && (
                      <div style={{ fontSize: 13, color: '#374151', background: '#f0fdf4', border: '0.5px solid #bbf7d0', borderRadius: 8, padding: 12, marginBottom: 12, lineHeight: 1.6 }}>
                        <div style={{ fontSize: 11, fontWeight: 500, color: '#16a34a', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>AI Summary</div>
                        {emailSummary}
                      </div>
                    )}

                    <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.65, whiteSpace: 'pre-wrap', marginBottom: 14, maxHeight: 180, overflowY: 'auto', borderRadius: 8, padding: '10px 12px', background: '#f9fafb', border: '0.5px solid #e5e7eb' }}>
                      {selectedEmail.body || selectedEmail.snippet}
                    </div>

                    <div style={{ borderTop: '0.5px solid #e5e7eb', paddingTop: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 8 }}>Draft a reply</div>
                      <input value={replyInstruction} onChange={e => setReplyInstruction(e.target.value)} placeholder="Instructions (e.g. 'Confirm Thursday 2pm works')" style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #d1d5db', borderRadius: 8, fontSize: 13, marginBottom: 8, fontFamily: 'inherit', color: '#1c1c1e', background: '#fff', boxSizing: 'border-box' }} />
                      <Btn onClick={getDraft} disabled={draftLoading}>{draftLoading ? 'Drafting...' : '✦ Draft reply with AI'}</Btn>
                      {draftReply && (
                        <div style={{ marginTop: 10 }}>
                          <textarea value={draftReply} onChange={e => setDraftReply(e.target.value)} rows={6} style={{ width: '100%', padding: '10px 12px', border: '0.5px solid #d1d5db', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', color: '#1c1c1e', background: '#fff', boxSizing: 'border-box' }} />
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <Btn onClick={getDraft}>Regenerate</Btn>
                            <Btn primary onClick={sendReply} disabled={sendingEmail}>{sendingEmail ? 'Sending...' : '↑ Send reply'}</Btn>
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* TASKS */}
          {panel === 'tasks' && (
            <div>
              <Card style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#9ca3af', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.4 }}>Add new task</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <input id="new-task-input" value={newTask.name} onChange={e => setNewTask(p => ({ ...p, name: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addTask()} placeholder="Task name..." style={{ flex: '1 1 200px', padding: '8px 12px', border: '0.5px solid #d1d5db', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', color: '#1c1c1e', background: '#fff' }} />
                  <input type="date" value={newTask.dueDate} onChange={e => setNewTask(p => ({ ...p, dueDate: e.target.value }))} style={{ padding: '8px 10px', border: '0.5px solid #d1d5db', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', color: '#1c1c1e', background: '#fff' }} />
                  <select value={newTask.priority} onChange={e => setNewTask(p => ({ ...p, priority: e.target.value }))} style={{ padding: '8px 10px', border: '0.5px solid #d1d5db', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', color: '#1c1c1e', background: '#fff' }}>
                    <option value="high">🔴 High</option>
                    <option value="med">🟡 Medium</option>
                    <option value="low">🟢 Low</option>
                  </select>
                  <select value={newTask.category} onChange={e => setNewTask(p => ({ ...p, category: e.target.value }))} style={{ padding: '8px 10px', border: '0.5px solid #d1d5db', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', color: '#1c1c1e', background: '#fff' }}>
                    {['Work','Personal','Finance','Admin','Legal','Meetings'].map(c => <option key={c}>{c}</option>)}
                  </select>
                  <Btn primary onClick={addTask}>+ Add</Btn>
                  <Btn onClick={aiSortTasks} disabled={sortingTasks}>{sortingTasks ? 'Sorting...' : '✦ AI sort'}</Btn>
                </div>
              </Card>

              <Card>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#9ca3af', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  {undoneTasks.length} open tasks
                </div>
                {tasks.map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '0.5px solid #f3f4f6', opacity: t.done ? 0.4 : 1 }}>
                    <div onClick={() => toggleTask(t.id)} style={{ width: 17, height: 17, borderRadius: '50%', border: `1.5px solid ${t.done ? '#22c55e' : PRIORITY_COLORS[t.priority] || '#d1d5db'}`, marginTop: 1, flexShrink: 0, cursor: 'pointer', background: t.done ? '#22c55e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {t.done && <span style={{ color: '#fff', fontSize: 10, lineHeight: 1 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, color: '#1c1c1e', textDecoration: t.done ? 'line-through' : 'none' }}>{t.name}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                        {t.dueDate && <Tag type={t.dueDate === new Date().toISOString().slice(0,10) ? 'urgent' : 'normal'}>Due {t.dueDate}</Tag>}
                        <Tag type="normal">{t.category}</Tag>
                        {t.aiReason && <span style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>AI: {t.aiReason}</span>}
                      </div>
                    </div>
                    <button onClick={() => setTasks(prev => prev.filter(x => x.id !== t.id))} style={{ border: 'none', background: 'none', color: '#d1d5db', cursor: 'pointer', fontSize: 16, padding: '0 4px', lineHeight: 1 }}>×</button>
                  </div>
                ))}
                {tasks.filter(t => t.done).length > 0 && (
                  <button onClick={() => setTasks(prev => prev.filter(t => !t.done))} style={{ marginTop: 10, fontSize: 12, color: '#9ca3af', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Clear {tasks.filter(t => t.done).length} completed tasks
                  </button>
                )}
              </Card>
            </div>
          )}

          {/* CALENDAR */}
          {panel === 'calendar' && (
            <div>
              <Card style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#9ca3af', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.4 }}>Upcoming events</div>
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
                  Scan your inbox to automatically detect meeting requests and deadlines, then add them as tasks or calendar events.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn onClick={scanInbox} disabled={scanLoading}>{scanLoading ? 'Scanning...' : '🔍 Scan inbox for events'}</Btn>
                  <Btn onClick={() => setPanel('email')}>✉ Go to inbox</Btn>
                </div>
              </Card>
              {scannedItems.length > 0 && (
                <Card>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#9ca3af', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.4 }}>Detected events</div>
                  {scannedItems.map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < scannedItems.length - 1 ? '0.5px solid #f3f4f6' : 'none' }}>
                      <div style={{ textAlign: 'center', minWidth: 44, background: '#f3f4f6', borderRadius: 8, padding: '6px 4px' }}>
                        <div style={{ fontSize: 16, fontWeight: 600, color: '#1c1c1e' }}>{item.date ? new Date(item.date).getDate() : '?'}</div>
                        <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase' }}>{item.date ? new Date(item.date).toLocaleString('en', { month: 'short' }) : '—'}</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 500, color: '#1c1c1e' }}>{item.title}</div>
                        <div style={{ fontSize: 12, color: '#9ca3af' }}>{item.time || ''} · from {item.from}</div>
                      </div>
                      <Tag type={item.type === 'meeting' ? 'meeting' : 'deadline'}>{item.type}</Tag>
                      <Btn onClick={() => addTaskFromScan(item)} style={{ fontSize: 11 }}>+ Task</Btn>
                    </div>
                  ))}
                </Card>
              )}
            </div>
          )}

          {/* CHAT */}
          {panel === 'chat' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px - 40px)' }}>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 12 }}>
                {chatMessages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, maxWidth: '85%', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                    {msg.role === 'assistant' && (
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1c1c1e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>N</div>
                    )}
                    <div style={{ padding: '10px 14px', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, background: msg.role === 'user' ? '#1c1c1e' : '#f3f4f6', color: msg.role === 'user' ? '#fff' : '#1c1c1e', border: msg.role === 'user' ? 'none' : '0.5px solid #e5e7eb', whiteSpace: 'pre-wrap' }}>
                      {msg.content || (chatLoading && i === chatMessages.length - 1 ? '...' : '')}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div style={{ borderTop: '0.5px solid #e5e7eb', paddingTop: 14, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <textarea value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } }} placeholder="Ask anything — emails, tasks, finance, advice..." rows={2} style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '0.5px solid #d1d5db', fontSize: 13.5, fontFamily: 'inherit', resize: 'none', color: '#1c1c1e', background: '#fff', outline: 'none' }} />
                <Btn primary onClick={sendChat} disabled={chatLoading || !chatInput.trim()} style={{ height: 44, padding: '0 16px' }}>↑</Btn>
              </div>
            </div>
          )}

          {/* FINANCE */}
          {panel === 'finance' && (
            <div>
              <Card style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#9ca3af', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.4 }}>My accounts — update anytime</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 14 }}>
                  {finance.accounts.map((acc, i) => (
                    <div key={i} style={{ background: '#f9fafb', borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6, fontWeight: 500 }}>{acc.name}</div>
                      <input value={acc.balance} onChange={e => setFinance(p => ({ ...p, accounts: p.accounts.map((a, j) => j === i ? { ...a, balance: e.target.value } : a) }))} placeholder="$0.00" style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #d1d5db', borderRadius: 6, fontSize: 14, fontWeight: 500, fontFamily: 'inherit', color: '#1c1c1e', background: '#fff', boxSizing: 'border-box' }} />
                      {acc.type === 'credit' && (
                        <input value={acc.limit || ''} onChange={e => setFinance(p => ({ ...p, accounts: p.accounts.map((a, j) => j === i ? { ...a, limit: e.target.value } : a) }))} placeholder="Credit limit" style={{ width: '100%', padding: '6px 10px', border: '0.5px solid #e5e7eb', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', color: '#6b7280', background: '#fff', marginTop: 6, boxSizing: 'border-box' }} />
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 140px' }}>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, fontWeight: 500 }}>Credit score</div>
                    <input value={finance.creditScore} onChange={e => setFinance(p => ({ ...p, creditScore: e.target.value }))} placeholder="e.g. 740" style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #d1d5db', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', color: '#1c1c1e', background: '#fff', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: '1 1 140px' }}>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, fontWeight: 500 }}>Monthly income (after tax)</div>
                    <input value={finance.monthlyIncome} onChange={e => setFinance(p => ({ ...p, monthlyIncome: e.target.value }))} placeholder="$0.00" style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #d1d5db', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', color: '#1c1c1e', background: '#fff', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: '2 1 240px' }}>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, fontWeight: 500 }}>Additional notes (loans, mortgage, goals, etc.)</div>
                    <input value={finance.notes} onChange={e => setFinance(p => ({ ...p, notes: e.target.value }))} placeholder="e.g. $450k mortgage, $12k car loan, goal: save $50k" style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #d1d5db', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', color: '#1c1c1e', background: '#fff', boxSizing: 'border-box' }} />
                  </div>
                </div>
              </Card>

              <Card>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#9ca3af', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.4 }}>AI financial advisor</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                  {['Should I open a new line of credit?', 'Best way to pay down my debt?', 'Recommend stocks for my risk level', 'How to improve my credit score?', 'Debt vs invest — what should I do?'].map(q => (
                    <button key={q} onClick={() => setFinanceQuestion(q)} style={{ padding: '5px 12px', borderRadius: 20, border: '0.5px solid #e5e7eb', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#374151', fontFamily: 'inherit', transition: 'background 0.1s' }}
                      onMouseOver={e => e.currentTarget.style.background = '#f9fafb'} onMouseOut={e => e.currentTarget.style.background = '#fff'}>
                      {q}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <input value={financeQuestion} onChange={e => setFinanceQuestion(e.target.value)} onKeyDown={e => e.key === 'Enter' && askFinance()} placeholder="Ask any financial question..." style={{ flex: 1, padding: '9px 12px', border: '0.5px solid #d1d5db', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', color: '#1c1c1e', background: '#fff' }} />
                  <Btn primary onClick={askFinance} disabled={financeLoading || !financeQuestion.trim()}>{financeLoading ? 'Thinking...' : 'Ask'}</Btn>
                </div>
                {financeAnswer && (
                  <div style={{ background: '#f0fdf4', border: '0.5px solid #bbf7d0', borderRadius: 10, padding: '14px 16px', fontSize: 13.5, lineHeight: 1.7, color: '#1c1c1e', whiteSpace: 'pre-wrap' }}>
                    {financeAnswer}
                  </div>
                )}
                <div style={{ marginTop: 12, fontSize: 11, color: '#9ca3af' }}>
                  ⚠ Nexus provides information, not licensed financial advice. Consult a professional for major decisions.
                </div>
              </Card>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
