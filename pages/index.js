import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect, useRef } from "react";

const TABS = ["Overview", "Email", "Tasks", "Finance", "Chat"];
const CU_EMAILS = ["nathan.bish@colorado.edu", "nabi2561@colorado.edu"];
const MOVEMENT_EMAIL = "nathan.bish@movementgyms.com";

const DEFAULT_SIGNATURE_LINES = [
  { id: 1, text: "Nathan Bish", enabled: true },
  { id: 2, text: "CUSG Deputy Chief of Staff", enabled: true },
  { id: 3, text: "President, Triangle Fraternity", enabled: true },
  { id: 4, text: "University of Colorado Boulder", enabled: false },
  { id: 5, text: "nathanbish1@gmail.com", enabled: false },
];

const isJunk = (email) => {
  const from = (email.from || "").toLowerCase();
  const subject = (email.subject || "").toLowerCase();
  const junkSenders = ["noreply", "no-reply", "donotreply", "notifications@", "newsletter", "mailer", "marketing", "promotions", "unsubscribe", "digest", "alerts@"];
  const junkSubjects = ["unsubscribe", "newsletter", "digest", "% off", "limited time", "act now", "verify your email", "your receipt", "your order", "invoice #", "payment confirmation"];
  return junkSenders.some(j => from.includes(j)) || junkSubjects.some(j => subject.includes(j));
};

const getOutlookAddresses = (email) => {
  const from = (email.from || "").toLowerCase();
  const addrs = [];
  if (from.includes("colorado.edu")) addrs.push(...CU_EMAILS);
  if (from.includes("movementgyms.com")) addrs.push(MOVEMENT_EMAIL);
  return addrs;
};

export default function Home() {
  const { data: session, status } = useSession();
  const [tab, setTab] = useState("Overview");
  const [showSettings, setShowSettings] = useState(false);
  const [emails, setEmails] = useState([]);
  const [emailLoading, setEmailLoading] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [replyQueue, setReplyQueue] = useState([]);
  const [newTask, setNewTask] = useState("");
  const [taskLoading, setTaskLoading] = useState(false);
  const [finance, setFinance] = useState({ checking: "", savings: "", creditCard: "", investments: "", creditScore: "" });
  const [financeQuestion, setFinanceQuestion] = useState("");
  const [financeAnswer, setFinanceAnswer] = useState("");
  const [financeLoading, setFinanceLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [toDelete, setToDelete] = useState([]);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [selectedReply, setSelectedReply] = useState(null);
  const [replyIntent, setReplyIntent] = useState("");
  const [draftPreview, setDraftPreview] = useState(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [signatureLines, setSignatureLines] = useState(DEFAULT_SIGNATURE_LINES);
  const [newSigLine, setNewSigLine] = useState("");
  const [aiJunkIds, setAiJunkIds] = useState([]);
  const [darkMode, setDarkMode] = useState(true);
  const [replyInstructions, setReplyInstructions] = useState("");
  const [draft, setDraft] = useState("");
  const chatEndRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);
  useEffect(() => { if (session) loadEmails(); }, [session]);
  useEffect(() => {
    if (!session) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    navigator.serviceWorker.register("/sw.js").then(async reg => {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;
      const existing = await reg.pushManager.getSubscription();
      const sub = existing || await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      });
      await fetch("/api/push/subscribe", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub })
      });
    }).catch(console.error);
  }, [session]);

  if (status === "loading") return <Screen><p style={{ color: "#888", textAlign: "center", marginTop: 80 }}>Loading...</p></Screen>;
  if (!session) return (
    <Screen>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 24 }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>⚡</div>
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8, color: "#fff" }}>Nexus</h1>
        <p style={{ color: "#888", marginBottom: 48, textAlign: "center" }}>Your personal command center</p>
        <Btn onClick={() => signIn("google")} style={{ background: "#4285f4", width: "100%", maxWidth: 320, marginBottom: 12 }}>Continue with Gmail</Btn>
        <Btn onClick={() => signIn("azure-ad")} style={{ background: "#0078d4", width: "100%", maxWidth: 320 }}>Continue with Outlook</Btn>
      </div>
    </Screen>
  );

  const theme = {
    bg: darkMode ? "#0a0a0f" : "#f0f0f5",
    card: darkMode ? "#111120" : "#ffffff",
    border: darkMode ? "#1e1e2e" : "#e0e0e8",
    text: darkMode ? "#e0e0e0" : "#111111",
    sub: darkMode ? "#888" : "#555",
    muted: darkMode ? "#555" : "#999",
    header: darkMode ? "#0d0d1a" : "#ffffff",
  };

  const buildSignature = (lines) => {
    const enabled = lines.filter(l => l.enabled).map(l => l.text);
    if (!enabled.length) return "";
    return "\n\n" + enabled.join("\n");
  };

  const loadEmails = async () => {
    setEmailLoading(true);
    try {
      const res = await fetch("/api/email/list");
      const data = await res.json();
      const loaded = data.emails || [];
      setEmails(loaded);
      if (loaded.length > 0) autoScan(loaded);
    } catch (e) { console.error(e); }
    setEmailLoading(false);
  };

  const autoScan = async (emailList) => {
    setScanning(true);
    try {
      const res = await fetch("/api/email/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emails: emailList }) });
      const data = await res.json();
      const items = data.items || [];
      const actionTasks = items.filter(i => i.type === "deadline" || i.type === "meeting").map(i => ({
        id: Date.now() + Math.random(), text: i.title || i.description, category: i.type === "meeting" ? "Meeting" : "Deadline",
        priority: "high", done: false, date: i.date
      }));
      if (actionTasks.length) setTasks(t => {
        const existing = new Set(t.map(x => x.text));
        return [...t, ...actionTasks.filter(a => !existing.has(a.text))];
      });
      // Reply queue — Claude-detected
      const needsReplyMeta = data.needsReply || [];
      const replyEmails = needsReplyMeta.map(r => emailList[r.index]).filter(Boolean);
      setReplyQueue(replyEmails.slice(0, 20));

      // AI junk flagging — red slivers
      const junkIds = (data.junk || []).map(j => emailList[j.index]?.id).filter(Boolean);
      setAiJunkIds(junkIds);
    } catch (e) { console.error(e); }
    setScanning(false);
  };

  const openDeleteReview = () => {
    const junk = emails.filter(isJunk);
    setToDelete(junk.map(e => e.id));
    setDeleteMode(true);
  };

  const confirmDelete = async () => {
    setDeleteLoading(true);
    try {
      await fetch("/api/email/delete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailIds: toDelete, emails: emails.filter(e => toDelete.includes(e.id)) })
      });
      setEmails(e => e.filter(x => !toDelete.includes(x.id)));
      setReplyQueue(q => q.filter(x => !toDelete.includes(x.id)));
      setDeleteMode(false);
      setToDelete([]);
    } catch (e) { alert("Delete failed: " + e.message); }
    setDeleteLoading(false);
  };

  const generateDraft = async () => {
    if (!replyIntent.trim()) return;
    setDraftLoading(true);
    try {
      const res = await fetch("/api/email/reply", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: selectedReply, instructions: replyIntent })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!data.draft) throw new Error("AI returned an empty draft — please try again");
      setDraftPreview({ body: data.draft, sigLines: signatureLines.map(l => ({ ...l })) });
    } catch (e) { alert("Draft failed: " + e.message); }
    setDraftLoading(false);
  };

  const sendDraft = async () => {
    if (!draftPreview) return;
    setSendLoading(true);
    try {
      const sig = buildSignature(draftPreview.sigLines);
      const fullBody = draftPreview.body + sig;
      await fetch("/api/email/reply", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: selectedReply, send: true, draftBody: fullBody })
      });
      setReplyQueue(q => q.filter(x => x.id !== selectedReply.id));
      setSelectedReply(null);
      setReplyIntent("");
      setDraftPreview(null);
    } catch (e) { alert("Send failed: " + e.message); }
    setSendLoading(false);
  };

  const handleReplyAction = async (action) => {
    try {
      if (action === "delete") {
        await fetch("/api/email/delete", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emailIds: [selectedReply.id], emails: [selectedReply] })
        });
        setEmails(e => e.filter(x => x.id !== selectedReply.id));
      }
      setReplyQueue(q => q.filter(x => x.id !== selectedReply.id));
      setSelectedReply(null);
      setReplyIntent("");
      setDraftPreview(null);
    } catch (e) { alert("Action failed: " + e.message); }
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

  const draftEmailReply = async () => {
    if (!replyInstructions.trim()) { alert("Please enter reply instructions first."); return; }
    setDraftLoading(true);
    try {
      const res = await fetch("/api/email/reply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: selectedEmail, instructions: replyInstructions }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!data.draft) throw new Error("AI returned an empty draft — please try again");
      setDraft(data.draft);
    } catch (e) { alert("Draft failed: " + e.message); setDraft(""); }
    setDraftLoading(false);
  };

  const sendEmailReply = async () => {
    if (!draft.trim()) return;
    try {
      const sig = buildSignature(signatureLines);
      await fetch("/api/email/reply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: selectedEmail, send: true, draftBody: draft + sig }) });
      alert("Sent!"); setDraft(""); setReplyInstructions(""); setSelectedEmail(null);
    } catch (e) { alert("Failed to send."); }
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

  const pc = (p) => p === "high" ? "#ef4444" : p === "medium" ? "#f59e0b" : "#22c55e";

  // Settings screen
  if (showSettings) return (
    <Screen bg={theme.bg}>
      <div style={{ padding: "16px 20px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid " + theme.border, background: theme.header }}>
        <button onClick={() => setShowSettings(false)} style={{ background: "none", border: "none", color: "#6366f1", fontSize: 14, cursor: "pointer" }}>← Back</button>
        <span style={{ fontWeight: 700, fontSize: 16, color: theme.text }}>Settings</span>
        <div style={{ width: 60 }} />
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 40px" }}>

        <div style={{ background: theme.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <Label>ACCOUNT</Label>
          <div style={{ color: theme.sub, fontSize: 13, marginBottom: 12 }}>{session?.user?.email}</div>
          <button onClick={() => signOut()} style={{ width: "100%", padding: "12px 16px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Sign out</button>
        </div>

        <div style={{ background: theme.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <Label>APPEARANCE</Label>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ color: theme.text, fontSize: 14 }}>{darkMode ? "Dark mode" : "Light mode"}</span>
            <div onClick={() => setDarkMode(d => !d)} style={{ width: 48, height: 28, borderRadius: 14, background: darkMode ? "#6366f1" : "#ccc", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
              <div style={{ position: "absolute", top: 3, left: darkMode ? 23 : 3, width: 22, height: 22, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
            </div>
          </div>
        </div>

        <div style={{ background: theme.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <Label>EMAIL SIGNATURE</Label>
          <p style={{ color: theme.muted, fontSize: 13, marginBottom: 12 }}>Toggle lines on/off. These appear at the bottom of every sent email.</p>
          {signatureLines.map((line, idx) => (
            <div key={line.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid " + theme.border }}>
              <button onClick={() => setSignatureLines(ls => ls.map(l => l.id === line.id ? { ...l, enabled: !l.enabled } : l))}
                style={{ width: 22, height: 22, borderRadius: 6, border: "2px solid " + (line.enabled ? "#6366f1" : theme.border), background: line.enabled ? "#6366f1" : "none", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {line.enabled && <span style={{ color: "#fff", fontSize: 12 }}>✓</span>}
              </button>
              <span style={{ flex: 1, color: line.enabled ? theme.text : theme.muted, fontSize: 14 }}>{line.text}</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <button onClick={() => { if (idx === 0) return; setSignatureLines(ls => { const n = [...ls]; [n[idx-1], n[idx]] = [n[idx], n[idx-1]]; return n; }); }}
                  style={{ background: "none", border: "none", color: theme.muted, cursor: "pointer", fontSize: 12, padding: "2px 4px" }}>▲</button>
                <button onClick={() => { if (idx === signatureLines.length - 1) return; setSignatureLines(ls => { const n = [...ls]; [n[idx], n[idx+1]] = [n[idx+1], n[idx]]; return n; }); }}
                  style={{ background: "none", border: "none", color: theme.muted, cursor: "pointer", fontSize: 12, padding: "2px 4px" }}>▼</button>
              </div>
              <button onClick={() => setSignatureLines(ls => ls.filter(l => l.id !== line.id))}
                style={{ background: "none", border: "none", color: theme.muted, cursor: "pointer", fontSize: 18 }}>×</button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <input value={newSigLine} onChange={e => setNewSigLine(e.target.value)} onKeyDown={e => e.key === "Enter" && newSigLine.trim() && (setSignatureLines(ls => [...ls, { id: Date.now(), text: newSigLine, enabled: true }]), setNewSigLine(""))}
              placeholder="Add signature line..." style={{ ...inputStyle, flex: 1, margin: 0, background: theme.bg, color: theme.text, borderColor: theme.border }} />
            <Btn onClick={() => { if (!newSigLine.trim()) return; setSignatureLines(ls => [...ls, { id: Date.now(), text: newSigLine, enabled: true }]); setNewSigLine(""); }}
              style={{ flexShrink: 0, width: "auto", padding: "10px 16px" }}>Add</Btn>
          </div>
        </div>

        <div style={{ background: theme.card, borderRadius: 16, padding: 16 }}>
          <Label>SIGNATURE PREVIEW</Label>
          <div style={{ color: theme.sub, fontSize: 13, fontFamily: "Times New Roman, serif", lineHeight: 1.8, whiteSpace: "pre-line" }}>
            {signatureLines.filter(l => l.enabled).map(l => l.text).join("\n") || "(no signature lines enabled)"}
          </div>
        </div>

      </div>
    </Screen>
  );

  // Draft preview screen
  if (draftPreview) return (
    <Screen>
      <div style={{ padding: "16px 20px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e1e2e" }}>
        <button onClick={() => setDraftPreview(null)} style={{ background: "none", border: "none", color: "#6366f1", fontSize: 14, cursor: "pointer" }}>← Edit</button>
        <span style={{ fontWeight: 700, fontSize: 16, color: "#fff" }}>Review draft</span>
        <div style={{ width: 60 }} />
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 120px" }}>
        <Card style={{ marginBottom: 16 }}>
          <Label>TO</Label>
          <div style={{ color: "#e0e0e0", fontSize: 14, marginBottom: 12 }}>{selectedReply?.from}</div>
          <Label>SUBJECT</Label>
          <div style={{ color: "#e0e0e0", fontSize: 14, marginBottom: 12 }}>Re: {selectedReply?.subject}</div>
          <Label>BODY</Label>
          <textarea value={draftPreview.body} onChange={e => setDraftPreview(d => ({ ...d, body: e.target.value }))}
            rows={8} style={{ ...inputStyle, resize: "vertical", fontFamily: "Times New Roman, serif", fontSize: 14 }} />
        </Card>
        <Card>
          <Label>SIGNATURE LINES</Label>
          <p style={{ color: "#666", fontSize: 12, marginBottom: 12 }}>Toggle which lines to include in this email.</p>
          {draftPreview.sigLines.map(line => (
            <div key={line.id} onClick={() => setDraftPreview(d => ({ ...d, sigLines: d.sigLines.map(l => l.id === line.id ? { ...l, enabled: !l.enabled } : l) }))}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #1e1e2e", cursor: "pointer" }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, border: "2px solid " + (line.enabled ? "#6366f1" : "#333"), background: line.enabled ? "#6366f1" : "none", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {line.enabled && <span style={{ color: "#fff", fontSize: 12 }}>✓</span>}
              </div>
              <span style={{ color: line.enabled ? "#e0e0e0" : "#555", fontSize: 14, fontFamily: "Times New Roman, serif" }}>{line.line}</span>
            </div>
          ))}
        </Card>
      </div>
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "12px 16px 32px", background: "#0d0d1a", borderTop: "1px solid #1e1e2e" }}>
        <Btn onClick={sendDraft} disabled={sendLoading} style={{ background: "#22c55e" }}>
          {sendLoading ? "Sending..." : "Send email"}
        </Btn>
      </div>
    </Screen>
  );

  // Reply queue action screen
  if (selectedReply) return (
    <Screen>
      <div style={{ padding: "16px 20px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e1e2e" }}>
        <button onClick={() => { setSelectedReply(null); setReplyIntent(""); setDraftPreview(null); }} style={{ background: "none", border: "none", color: "#6366f1", fontSize: 14, cursor: "pointer" }}>← Back</button>
        <span style={{ fontWeight: 700, fontSize: 16, color: "#fff" }}>Reply needed</span>
        <button onClick={() => setShowSettings(true)} style={{ background: "none", border: "1px solid #333", color: "#888", borderRadius: 8, padding: "4px 12px", fontSize: 13, cursor: "pointer" }}>⚙</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 120px" }}>
        <Card style={{ marginBottom: 16 }}>
          <div style={{ color: "#fff", fontWeight: 600, marginBottom: 4 }}>{selectedReply.subject}</div>
          <div style={{ color: "#888", fontSize: 13, marginBottom: 12 }}>{selectedReply.from}</div>
          <div style={{ color: "#aaa", fontSize: 14, lineHeight: 1.6 }}>{selectedReply.snippet}</div>
        </Card>
        <Card style={{ marginBottom: 12 }}>
          <Label>WHAT DO YOU WANT TO SAY?</Label>
          <textarea value={replyIntent} onChange={e => setReplyIntent(e.target.value)}
            placeholder="e.g. I can do Tuesday and Wednesday after 3pm"
            rows={4} style={{ ...inputStyle, resize: "vertical" }} />
          <Btn onClick={generateDraft} disabled={draftLoading || !replyIntent.trim()}>
            {draftLoading ? "Drafting..." : "✦ Draft reply"}
          </Btn>
        </Card>
        <Card>
          <Label>OR MARK AS</Label>
          <div onClick={() => handleReplyAction("sent_from_outlook")}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: "1px solid #1e1e2e", cursor: "pointer" }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, border: "2px solid #6366f1", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#6366f1", fontSize: 14 }}>✓</span>
            </div>
            <div>
              <div style={{ color: "#e0e0e0", fontSize: 14 }}>Already replied from Outlook</div>
              <div style={{ color: "#666", fontSize: 12 }}>Removes from queue</div>
            </div>
          </div>
          <div onClick={() => handleReplyAction("delete")}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", cursor: "pointer" }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, border: "2px solid #ef4444", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#ef4444", fontSize: 14 }}>🗑</span>
            </div>
            <div>
              <div style={{ color: "#e0e0e0", fontSize: 14 }}>Mark for deletion</div>
              <div style={{ color: "#666", fontSize: 12 }}>Trashes in Gmail + notifies Outlook</div>
            </div>
          </div>
        </Card>
      </div>
    </Screen>
  );

  // Delete review modal
  if (deleteMode) {
    const junkEmails = emails.filter(isJunk);
    return (
      <Screen>
        <div style={{ padding: "16px 20px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e1e2e" }}>
          <span style={{ fontWeight: 700, fontSize: 18, color: "#fff" }}>Review for deletion</span>
          <button onClick={() => setDeleteMode(false)} style={{ background: "none", border: "none", color: "#888", fontSize: 24, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: "12px 16px", background: "#1a1a2e", borderBottom: "1px solid #1e1e2e" }}>
          <p style={{ color: "#aaa", fontSize: 13 }}>{toDelete.length} of {junkEmails.length} selected. Uncheck any to keep.</p>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px 120px" }}>
          {junkEmails.map(e => (
            <div key={e.id} onClick={() => setToDelete(ids => ids.includes(e.id) ? ids.filter(x => x !== e.id) : [...ids, e.id])}
              style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 0", borderBottom: "1px solid #1e1e2e", cursor: "pointer" }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, border: "2px solid " + (toDelete.includes(e.id) ? "#ef4444" : "#333"), background: toDelete.includes(e.id) ? "#ef4444" : "none", flexShrink: 0, marginTop: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {toDelete.includes(e.id) && <span style={{ color: "#fff", fontSize: 14 }}>✓</span>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#e0e0e0", fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{e.subject || "(no subject)"}</div>
                <div style={{ color: "#666", fontSize: 12 }}>{e.from}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "12px 16px 32px", background: "#0d0d1a", borderTop: "1px solid #1e1e2e", display: "flex", gap: 8 }}>
          <Btn onClick={() => setDeleteMode(false)} style={{ background: "#333", flex: 1 }}>Cancel</Btn>
          <Btn onClick={confirmDelete} disabled={deleteLoading || !toDelete.length} style={{ background: "#ef4444", flex: 2 }}>
            {deleteLoading ? "Deleting..." : `Delete ${toDelete.length} emails`}
          </Btn>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <div style={{ padding: "16px 20px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e1e2e" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 22 }}>⚡</span>
          <span style={{ fontWeight: 700, fontSize: 18, color: "#fff" }}>Nexus</span>
        </div>
        <button onClick={() => setShowSettings(true)} style={{ background: "none", border: "1px solid #333", color: "#888", borderRadius: 8, padding: "4px 12px", fontSize: 13, cursor: "pointer" }}>⚙ Settings</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 80px" }}>

        {tab === "Overview" && (
          <div>
            <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Overview</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              <Card><Label>EMAILS</Label><Big>{emailLoading ? "…" : emails.length}</Big><Sub>{scanning ? "scanning..." : "in inbox"}</Sub></Card>
              <Card onClick={() => replyQueue.length && setTab("Email")}><Label>REPLIES NEEDED</Label><Big style={{ color: replyQueue.length ? "#6366f1" : "#fff" }}>{replyQueue.length}</Big><Sub>tap to action</Sub></Card>
              <Card><Label>ACTION ITEMS</Label><Big>{tasks.filter(t => !t.done && t.priority === "high").length}</Big><Sub>{tasks.filter(t => !t.done).length} total open</Sub></Card>
              <Card><Label>CREDIT SCORE</Label><Big>{finance.creditScore || "—"}</Big><Sub>{finance.creditScore ? "on file" : "Enter in Finance"}</Sub></Card>
            </div>

            {replyQueue.length > 0 && (
              <Card style={{ marginBottom: 12 }}>
                <Label>REPLIES NEEDED</Label>
                {replyQueue.map(e => (
                  <div key={e.id} onClick={() => setSelectedReply(e)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #1e1e2e", cursor: "pointer" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#6366f1", flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "#e0e0e0", fontSize: 14 }}>{e.subject || "(no subject)"}</div>
                      <div style={{ color: "#666", fontSize: 12 }}>{e.from?.split("<")[0].trim()}</div>
                    </div>
                    <span style={{ color: "#555", fontSize: 18 }}>›</span>
                  </div>
                ))}
              </Card>
            )}

            {tasks.filter(t => !t.done && t.priority === "high").length > 0 && (
              <Card style={{ marginBottom: 12 }}>
                <Label>ACTION ITEMS</Label>
                {tasks.filter(t => !t.done && t.priority === "high").slice(0, 5).map(t => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #1e1e2e" }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444", flexShrink: 0 }} />
                    <span style={{ color: "#e0e0e0", fontSize: 14 }}>{t.text}</span>
                  </div>
                ))}
              </Card>
            )}

            <Card>
              <Label>QUICK ACTIONS</Label>
              <QuickAction onClick={loadEmails}>↻ Refresh inbox</QuickAction>
              <QuickAction onClick={() => { setTab("Email"); openDeleteReview(); }}>🗑 Clean up junk</QuickAction>
              <QuickAction onClick={() => setTab("Tasks")}>✅ View all tasks</QuickAction>
              <QuickAction onClick={() => setTab("Chat")}>✦ Ask Nexus anything</QuickAction>
              <QuickAction onClick={() => setTab("Finance")}>💰 Financial advisor</QuickAction>
            </Card>
          </div>
        )}

        {tab === "Email" && (
          <div>
            <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 700, marginBottom: 16 }}>
              Email {emailLoading && <span style={{ fontSize: 14, color: "#666" }}>loading...</span>}
            </h2>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <Btn onClick={loadEmails} disabled={emailLoading} style={{ flex: 1 }}>{emailLoading ? "Loading..." : "↻ Refresh"}</Btn>
              <Btn onClick={openDeleteReview} disabled={emailLoading || !emails.length} style={{ flex: 1, background: "#ef4444" }}>🗑 Clean up</Btn>
            </div>
            {scanning && <div style={{ color: "#6366f1", fontSize: 13, marginBottom: 12, textAlign: "center" }}>✦ Scanning for action items...</div>}
            {selectedEmail ? (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <button onClick={() => setSelectedEmail(null)} style={{ background: "none", border: "none", color: "#6366f1", cursor: "pointer", fontSize: 14 }}>← Back to inbox</button>
                </div>
                <Card style={{ marginBottom: 12 }}>
                  <div style={{ color: "#fff", fontWeight: 600, marginBottom: 4 }}>{selectedEmail.subject}</div>
                  <div style={{ color: "#888", fontSize: 13, marginBottom: 8 }}>{selectedEmail.from}</div>
                  {summaryLoading ? <div style={{ color: "#888" }}>Thinking...</div> : summary ? <div style={{ color: "#e0e0e0", fontSize: 14, lineHeight: 1.6 }}>{summary}</div> : null}
                </Card>
                <Card>
                  <Label>DRAFT REPLY</Label>
                  <textarea value={replyInstructions} onChange={e => setReplyInstructions(e.target.value)} placeholder="e.g. Decline politely, say I'm available Tuesday or Wednesday after 3pm" rows={3} style={{ ...inputStyle, resize: "vertical" }} />
                  <Btn onClick={draftEmailReply} disabled={draftLoading} style={{ marginBottom: 8 }}>{draftLoading ? "Drafting..." : "✦ Draft with AI"}</Btn>
                  {draft && <>
                    <Label>EDIT DRAFT</Label>
                    <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={8} style={{ ...inputStyle, resize: "vertical", fontFamily: "Times New Roman, serif", fontSize: 14 }} />
                    <Btn onClick={sendEmailReply} style={{ background: "#22c55e" }}>Send reply</Btn>
                  </>}
                </Card>
              </div>
            ) : (
              <div>
                {emails.length === 0 && !emailLoading && <div style={{ color: "#888", textAlign: "center", marginTop: 40 }}>No emails found</div>}
                {emails.map(e => (
                  <Card key={e.id} onClick={() => summarize(e)} style={{ marginBottom: 8, cursor: "pointer", borderLeft: replyQueue.find(r => r.id === e.id) ? "3px solid #6366f1" : (aiJunkIds.includes(e.id) && !toDelete.includes(e.id)) ? "3px solid #ef4444" : isJunk(e) ? "3px solid #333" : "3px solid transparent" }}>
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
              <Btn onClick={addTask} style={{ flexShrink: 0, width: "auto", padding: "10px 16px" }}>Add</Btn>
            </div>
            <Btn onClick={sortTasks} disabled={taskLoading} style={{ marginBottom: 16, background: "#7c3aed" }}>{taskLoading ? "Sorting..." : "✦ AI sort by priority"}</Btn>
            {tasks.length === 0 && <div style={{ color: "#555", textAlign: "center", marginTop: 40 }}>No tasks yet — emails are scanned automatically.</div>}
            {tasks.map(t => (
              <Card key={t.id} style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={() => setTasks(ts => ts.map(x => x.id === t.id ? { ...x, done: !x.done } : x))} style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${pc(t.priority)}`, background: t.done ? pc(t.priority) : "none", cursor: "pointer", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ color: t.done ? "#555" : "#e0e0e0", textDecoration: t.done ? "line-through" : "none", fontSize: 14 }}>{t.text}</div>
                  <div style={{ color: "#666", fontSize: 12 }}>{t.category}{t.date ? ` · ${t.date}` : ""}</div>
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
          <div>
            <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Ask Nexus</h2>
            {chatMessages.length === 0 && <div style={{ color: "#555", textAlign: "center", marginTop: 40 }}>Ask me anything about your emails, tasks, or finances.</div>}
            {chatMessages.map((m, i) => (
              <div key={i} style={{ marginBottom: 12, display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "85%", padding: "10px 14px", borderRadius: 16, background: m.role === "user" ? "#6366f1" : "#1e1e2e", color: "#e0e0e0", fontSize: 14, lineHeight: 1.6 }}>{m.content}</div>
              </div>
            ))}
            {chatLoading && <div style={{ color: "#555", fontSize: 14 }}>Nexus is thinking...</div>}
            <div ref={chatEndRef} />
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendChat()} placeholder="Message Nexus..." style={{ ...inputStyle, flex: 1, margin: 0 }} />
              <Btn onClick={sendChat} disabled={chatLoading} style={{ flexShrink: 0, width: "auto", padding: "10px 16px" }}>Send</Btn>
            </div>
          </div>
        )}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#0d0d1a", borderTop: "1px solid #1e1e2e", display: "flex", paddingTop: 8, paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "4px 0" }}>
            <span style={{ fontSize: 20 }}>{t === "Overview" ? "⚡" : t === "Email" ? "✉️" : t === "Tasks" ? "✅" : t === "Finance" ? "💰" : "💬"}</span>
            <span style={{ fontSize: 10, color: tab === t ? "#6366f1" : "#555", fontWeight: tab === t ? 700 : 400 }}>{t}</span>
          </button>
        ))}
      </div>
    </Screen>
  );
}

const Screen = ({ children, bg }) => <div style={{ minHeight: "100vh", background: bg || "#0a0a0f", display: "flex", flexDirection: "column" }}>{children}</div>;
const Card = ({ children, style, onClick }) => <div onClick={onClick} style={{ background: "#111120", borderRadius: 16, padding: 16, ...style }}>{children}</div>;
const Label = ({ children }) => <div style={{ color: "#555", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>{children}</div>;
const Big = ({ children, style }) => <div style={{ color: "#fff", fontSize: 32, fontWeight: 800, lineHeight: 1, ...style }}>{children}</div>;
const Sub = ({ children }) => <div style={{ color: "#666", fontSize: 12, marginTop: 4 }}>{children}</div>;
const Btn = ({ children, onClick, disabled, style }) => <button onClick={onClick} disabled={disabled} style={{ width: "100%", padding: "12px 16px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1, ...style }}>{children}</button>;
const QuickAction = ({ children, onClick }) => <div onClick={onClick} style={{ padding: "12px 0", borderBottom: "1px solid #1e1e2e", color: "#e0e0e0", fontSize: 14, cursor: "pointer" }}>{children}</div>;
const inputStyle = { width: "100%", padding: "10px 14px", background: "#0a0a0f", border: "1px solid #2a2a3e", borderRadius: 10, color: "#fff", fontSize: 14, marginBottom: 10, outline: "none" };
