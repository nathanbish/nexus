import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect, useRef } from "react";

const TABS = ["Overview", "Email", "Tasks", "Finance", "Chat"];
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export default function Home() {
  const { data: session, status } = useSession();
  const [tab, setTab] = useState("Overview");
  const [emails, setEmails] = useState([]);
  const [emailLoading, setEmailLoading] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [replyInstructions, setReplyInstructions] = useState("");
  const [draft, setDraft] = useState("");
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState("");
  const [taskLoading, setTaskLoading] = useState(false);
  const [finance, setFinance] = useState({ checking: "", savings: "", creditCard: "", investments: "", creditScore: "" });
  const [financeQuestion, setFinanceQuestion] = useState("");
  const [financeAnswer, setFinanceAnswer] = useState("");
  const [financeLoading, setFinanceLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  useEffect(() => {
    if (!session) return;
    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.register("/sw.js").then(async (reg) => {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;
        const existing = await reg.pushManager.getSubscription();
        const sub = existing || await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: VAPID_PUBLIC_KEY,
        });
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: sub }),
        });
      }).catch(console.error);
    }
  }, [session]);

  if (status === "loading") return <Screen><p style={{ color: "#888", textAlign: "center", marginTop: 80 }}>Loading...</p></Screen>;
  if (!session) return (
    <Screen>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 24 }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>⚡</div>
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8, color: "#fff" }}>Nexus</h1>
        <p style={{ color: "#888", marginBottom: 48, textAlign: "center" }}>UPDATED VERSION 2.0</p>
        <Btn onClick={() => signIn("google")} style={{ background: "#4285f4", width: "100%", maxWidth: 320, marginBottom: 12 }}>Continue with Gmail</Btn>
        <Btn onClick={() => signIn("azure-ad")} style={{ background: "#0078d4", width: "100%", maxWidth: 320 }}>Continue with Outlook</Btn>
      </div>
    </Screen>
  );

  const loadEmails = async () => {
    setEmailLoading(true);
    try {
      const res = await fetch("/api/email/list");
      const data = await res.json();
      setEmails(data.emails || []);
    } catch (e) { alert("Failed to load emails: " + e.message); }
    setEmailLoading(false);
  };

  const summarize = async (email) => {
    setSelectedEmail(email); setSummary(""); setSummaryLoading(true); setDraft(""); setReplyInstructions("");
    try {
      const res = await fetch("/api/email/summarize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await res.json();
      setSummary(data.summary);
    } catch (e) { setSummary("Failed to summarize."); }
    setSummaryLoading(false);
  };

  const draftReply = async () => {
    if (!replyInstructions.trim()) return;
    setSummaryLoading(true);
    try {
      const res = await fetch("/api/email/reply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: selectedEmail, instructions: replyInstructions }) });
      const data = await res.json();
      setDraft(data.draft);
    } catch (e) { setDraft("Failed to draft reply."); }
    setSummaryLoading(false);
  };

  const sendReply = async () => {
    if (!draft.trim()) return;
    try {
      await fetch("/api/email/reply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: selectedEmail, send: true, draftBody: draft }) });
      alert("Sent!"); setDraft(""); setReplyInstructions(""); setSelectedEmail(null);
    } catch (e) { alert("Failed to send."); }
  };

  const scanDeadlines = async () => {
    if (!emails.length) { await loadEmails(); return; }
    setEmailLoading(true);
    try {
      const res = await fetch("/api/email/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emails: emails.slice(0, 10) }) });
      const data = await res.json();
      const newTasks = (data.deadlines || []).map((d, i) => ({ id: Date.now() + i, text: d.title, category: "Email", priority: "high", done: false, date: d.date }));
      setTasks(t => [...newTasks, ...t]);
      setTab("Tasks");
    } catch (e) { alert("Scan failed."); }
    setEmailLoading(false);
  };

  const addTask = () => {
    if (!newTask.trim()) return;
    setTasks(t => [...t, { id: Date.now(), text: newTask, category: "General", priority: "medium", done: false }]);
    setNewTask("");
  };

  const sortTasks = async () => {
    setTaskLoading(true);
    try {
      const res = await fetch("/api/tasks/sort", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tasks, financialContext: finance }) });
      const data = await res.json();
      setTasks(data.tasks || tasks);
    } catch (e) { alert("Sort failed."); }
    setTaskLoading(false);
  };

  const askFinance = async () => {
    if (!financeQuestion.trim()) return;
    setFinanceLoading(true);
    try {
      const res = await fetch("/api/finance/advise", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: financeQuestion, balances: finance }) });
      const data = await res.json();
      setFinanceAnswer(data.advice);
    } catch (e) { setFinanceAnswer("Failed to get advice."); }
    setFinanceLoading(false);
  };

  const sendChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg = { role: "user", content: chatInput };
    setChatMessages(m => [...m, userMsg]);
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [...chatMessages, userMsg], financialContext: finance }) });
      const data = await res.json();
      setChatMessages(m => [...m, { role: "assistant", content: data.reply }]);
    } catch (e) { setChatMessages(m => [...m, { role: "assistant", content: "Error: " + e.message }]); }
    setChatLoading(false);
  };

  const priorityColor = (p) => p === "high" ? "#ef4444" : p === "medium" ? "#f59e0b" : "#22c55e";

  return (
    <Screen>
      <div style={{ padding: "16px 20px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e1e2e" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 22 }}>⚡</span>
          <span style={{ fontWeight: 700, fontSize: 18, color: "#fff" }}>Nexus</span>
        </div>
        <button onClick={() => signOut()} style={{ background: "none", border: "1px solid #333", color: "#888", borderRadius: 8, padding: "4px 12px", fontSize: 13, cursor: "pointer" }}>Sign out</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 80px" }}>

        {tab === "Overview" && (
          <div>
            <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Overview</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              <Card><Label>UNREAD EMAILS</Label><Big>{emails.length || "—"}</Big><Sub>{emails.length ? `${emails.length} unread` : "Load inbox to sync"}</Sub></Card>
              <Card><Label>TASKS DUE TODAY</Label><Big>{tasks.filter(t => !t.done && t.priority === "high").length}</Big><Sub>{tasks.filter(t => !t.done).length} total open</Sub></Card>
              <Card><Label>OPEN TASKS</Label><Big>{tasks.filter(t => !t.done).length}</Big><Sub>Across all categories</Sub></Card>
              <Card><Label>CREDIT SCORE</Label><Big>{finance.creditScore || "—"}</Big><Sub>{finance.creditScore ? "Last updated" : "Enter in Finance tab"}</Sub></Card>
            </div>
            <Card style={{ marginBottom: 12 }}>
              <Label>TODAY'S TASKS</Label>
              {tasks.filter(t => !t.done).slice(0, 4).map(t => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #1e1e2e" }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", border: `2px solid ${priorityColor(t.priority)}`, flexShrink: 0 }} />
                  <span style={{ color: "#e0e0e0", fontSize: 14 }}>{t.text}</span>
                </div>
              ))}
              {tasks.filter(t => !t.done).length === 0 && <div style={{ color: "#555", fontSize: 14 }}>No tasks yet — scan your inbox to add some.</div>}
            </Card>
            <Card>
              <Label>QUICK ACTIONS</Label>
              <QuickAction onClick={() => { setTab("Email"); loadEmails(); }}>✉️ Load & prioritize my inbox</QuickAction>
              <QuickAction onClick={() => { setTab("Email"); scanDeadlines(); }}>🔍 Scan for deadlines & meetings</QuickAction>
              <QuickAction onClick={() => setTab("Chat")}>✦ Ask Nexus anything</QuickAction>
              <QuickAction onClick={() => setTab("Finance")}>$ Update my financial data</QuickAction>
            </Card>
          </div>
        )}

        {tab === "Email" && (
          <div>
            <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Email</h2>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <Btn onClick={loadEmails} disabled={emailLoading} style={{ flex: 1 }}>{emailLoading ? "Loading..." : "Refresh inbox"}</Btn>
              <Btn onClick={scanDeadlines} disabled={emailLoading} style={{ flex: 1, background: "#7c3aed" }}>Scan deadlines</Btn>
            </div>
            {selectedEmail ? (
              <div>
                <button onClick={() => setSelectedEmail(null)} style={{ background: "none", border: "none", color: "#6366f1", cursor: "pointer", marginBottom: 12, fontSize: 14 }}>← Back to inbox</button>
                <Card style={{ marginBottom: 12 }}>
                  <div style={{ color: "#fff", fontWeight: 600, marginBottom: 4 }}>{selectedEmail.subject}</div>
                  <div style={{ color: "#888", fontSize: 13, marginBottom: 8 }}>{selectedEmail.from}</div>
                  {summaryLoading ? <div style={{ color: "#888" }}>Thinking...</div> : summary ? <div style={{ color: "#e0e0e0", fontSize: 14, lineHeight: 1.6 }}>{summary}</div> : null}
                </Card>
                <Card>
                  <Label>DRAFT REPLY</Label>
                  <input value={replyInstructions} onChange={e => setReplyInstructions(e.target.value)} placeholder="Instructions (e.g. 'Decline politely')" style={inputStyle} />
                  <Btn onClick={draftReply} disabled={summaryLoading} style={{ marginBottom: 8 }}>Draft with AI</Btn>
                  {draft && <>
                    <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={6} style={{ ...inputStyle, resize: "vertical" }} />
                    <Btn onClick={sendReply} style={{ background: "#22c55e" }}>Send reply</Btn>
                  </>}
                </Card>
              </div>
            ) : (
              <div>
                {emails.length === 0 && <div style={{ color: "#888", textAlign: "center", marginTop: 40 }}>No unread emails — tap Refresh to check</div>}
                {emails.map(e => (
                  <Card key={e.id} onClick={() => summarize(e)} style={{ marginBottom: 8, cursor: "pointer" }}>
                    <div style={{ color: "#fff", fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{e.subject || "(no subject)"}</div>
                    <div style={{ color: "#888", fontSize: 12, marginBottom: 4 }}>{e.from}</div>
                    <div style={{ color: "#aaa", fontSize: 13 }}>{e.snippet?.slice(0, 100)}...</div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "Tasks" && (
          <div>
            <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Tasks</h2>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key === "Enter" && addTask()} placeholder="Add a task..." style={{ ...inputStyle, flex: 1, margin: 0 }} />
              <Btn onClick={addTask} style={{ flexShrink: 0 }}>Add</Btn>
            </div>
            <Btn onClick={sortTasks} disabled={taskLoading} style={{ marginBottom: 16, background: "#7c3aed", width: "100%" }}>{taskLoading ? "Sorting..." : "✦ AI sort by priority"}</Btn>
            {tasks.length === 0 && <div style={{ color: "#555", textAlign: "center", marginTop: 40 }}>No tasks yet — scan your inbox or add one above.</div>}
            {tasks.map(t => (
              <Card key={t.id} style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={() => setTasks(ts => ts.map(x => x.id === t.id ? { ...x, done: !x.done } : x))} style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${priorityColor(t.priority)}`, background: t.done ? priorityColor(t.priority) : "none", cursor: "pointer", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ color: t.done ? "#555" : "#e0e0e0", textDecoration: t.done ? "line-through" : "none", fontSize: 14 }}>{t.text}</div>
                  <div style={{ color: "#666", fontSize: 12 }}>{t.category}</div>
                </div>
                <button onClick={() => setTasks(ts => ts.filter(x => x.id !== t.id))} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 18 }}>×</button>
              </Card>
            ))}
          </div>
        )}

        {tab === "Finance" && (
          <div>
            <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Finance</h2>
            <Card style={{ marginBottom: 16 }}>
              <Label>YOUR BALANCES</Label>
              {[["checking", "Checking ($)"], ["savings", "Savings ($)"], ["creditCard", "Credit Card Debt ($)"], ["investments", "Investments ($)"], ["creditScore", "Credit Score"]].map(([key, label]) => (
                <div key={key} style={{ marginBottom: 10 }}>
                  <div style={{ color: "#888", fontSize: 12, marginBottom: 4 }}>{label}</div>
                  <input value={finance[key]} onChange={e => setFinance(f => ({ ...f, [key]: e.target.value }))} placeholder="0" style={inputStyle} />
                </div>
              ))}
            </Card>
            <Card>
              <Label>ASK YOUR ADVISOR</Label>
              <input value={financeQuestion} onChange={e => setFinanceQuestion(e.target.value)} placeholder="e.g. Should I pay off debt or invest?" style={inputStyle} />
              <Btn onClick={askFinance} disabled={financeLoading} style={{ marginBottom: 12 }}>{financeLoading ? "Thinking..." : "Get advice"}</Btn>
              {financeAnswer && <div style={{ color: "#e0e0e0", fontSize: 14, lineHeight: 1.7 }}>{financeAnswer}</div>}
            </Card>
          </div>
        )}

        {tab === "Chat" && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Ask Nexus</h2>
            <div style={{ marginBottom: 12 }}>
              {chatMessages.length === 0 && <div style={{ color: "#555", textAlign: "center", marginTop: 40 }}>Ask me anything — emails, tasks, finances, or anything else.</div>}
              {chatMessages.map((m, i) => (
                <div key={i} style={{ marginBottom: 12, display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "85%", padding: "10px 14px", borderRadius: 16, background: m.role === "user" ? "#6366f1" : "#1e1e2e", color: "#e0e0e0", fontSize: 14, lineHeight: 1.6 }}>{m.content}</div>
                </div>
              ))}
              {chatLoading && <div style={{ color: "#555", fontSize: 14, padding: "8px 0" }}>Nexus is thinking...</div>}
              <div ref={chatEndRef} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendChat()} placeholder="Message Nexus..." style={{ ...inputStyle, flex: 1, margin: 0 }} />
              <Btn onClick={sendChat} disabled={chatLoading} style={{ flexShrink: 0 }}>Send</Btn>
            </div>
          </div>
        )}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#0d0d1a", borderTop: "1px solid #1e1e2e", display: "flex", padding: "8px 0 20px" }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <span style={{ fontSize: 20 }}>{t === "Overview" ? "⚡" : t === "Email" ? "✉️" : t === "Tasks" ? "✅" : t === "Finance" ? "💰" : "💬"}</span>
            <span style={{ fontSize: 10, color: tab === t ? "#6366f1" : "#555", fontWeight: tab === t ? 700 : 400 }}>{t}</span>
          </button>
        ))}
      </div>
    </Screen>
  );
}

const Screen = ({ children }) => <div style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", flexDirection: "column" }}>{children}</div>;
const Card = ({ children, style, onClick }) => <div onClick={onClick} style={{ background: "#111120", borderRadius: 16, padding: 16, ...style }}>{children}</div>;
const Label = ({ children }) => <div style={{ color: "#555", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>{children}</div>;
const Big = ({ children }) => <div style={{ color: "#fff", fontSize: 32, fontWeight: 800, lineHeight: 1 }}>{children}</div>;
const Sub = ({ children }) => <div style={{ color: "#666", fontSize: 12, marginTop: 4 }}>{children}</div>;
const Btn = ({ children, onClick, disabled, style }) => <button onClick={onClick} disabled={disabled} style={{ width: "100%", padding: "12px 16px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1, ...style }}>{children}</button>;
const QuickAction = ({ children, onClick }) => <div onClick={onClick} style={{ padding: "12px 0", borderBottom: "1px solid #1e1e2e", color: "#e0e0e0", fontSize: 14, cursor: "pointer" }}>{children}</div>;
const inputStyle = { width: "100%", padding: "10px 14px", background: "#0a0a0f", border: "1px solid #2a2a3e", borderRadius: 10, color: "#fff", fontSize: 14, marginBottom: 10, outline: "none" };
