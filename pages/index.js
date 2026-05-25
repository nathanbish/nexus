import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
const TABS = ["Overview", "Email", "Tasks", "Finance", "Chat"];
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
  const [finance, setFinance] = useState({ checking: "", savings: "", creditCard: "", investments: "", creditScore: "" });
  const [financeQuestion, setFinanceQuestion] = useState("");
  const [financeAnswer, setFinanceAnswer] = useState("");
  const [financeLoading, setFinanceLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);
  if (status === "loading") return <div style={{color:"#888",padding:40,textAlign:"center"}}>Loading...</div>;
  if (!session) return (
    <div style={{minHeight:"100vh",background:"#0a0a0f",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <h1 style={{fontSize:32,fontWeight:800,marginBottom:8,color:"#fff"}}>Nexus</h1>
      <p style={{color:"#888",marginBottom:48,textAlign:"center"}}>Your personal command center</p>
      <button onClick={() => signIn("google")} style={{width:"100%",maxWidth:320,padding:"14px 24px",background:"#4285f4",color:"#fff",border:"none",borderRadius:12,fontSize:16,fontWeight:600,cursor:"pointer",marginBottom:12}}>Continue with Gmail</button>
      <button onClick={() => signIn("azure-ad")} style={{width:"100%",maxWidth:320,padding:"14px 24px",background:"#0078d4",color:"#fff",border:"none",borderRadius:12,fontSize:16,fontWeight:600,cursor:"pointer"}}>Continue with Outlook</button>
    </div>
  );
  const S = {width:"100%",padding:"10px 14px",background:"#0a0a0f",border:"1px solid #2a2a3e",borderRadius:10,color:"#fff",fontSize:14,marginBottom:10,outline:"none"};
  const pc = p => p==="high"?"#ef4444":p==="medium"?"#f59e0b":"#22c55e";
  const loadEmails = async () => { setEmailLoading(true); try { const r=await fetch("/api/email/list"); const d=await r.json(); setEmails(d.emails||[]); } catch(e){alert(e.message);} setEmailLoading(false); };
  const summarize = async (email) => { setSelectedEmail(email); setSummary(""); setSummaryLoading(true); try { const r=await fetch("/api/email/summarize",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email})}); const d=await r.json(); setSummary(d.summary); } catch(e){setSummary("Error");} setSummaryLoading(false); };
  const scanDeadlines = async () => { if(!emails.length){await loadEmails();return;} setEmailLoading(true); try { const r=await fetch("/api/email/scan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({emails:emails.slice(0,10)})}); const d=await r.json(); setTasks(t=>[...(d.deadlines||[]).map((x,i)=>({id:Date.now()+i,text:x.title,category:"Email",priority:"high",done:false})),...t]); setTab("Tasks"); } catch(e){alert(e.message);} setEmailLoading(false); };
  const addTask = () => { if(!newTask.trim())return; setTasks(t=>[...t,{id:Date.now(),text:newTask,category:"General",priority:"medium",done:false}]); setNewTask(""); };
  const sendChat = async () => { if(!chatInput.trim())return; const m={role:"user",content:chatInput}; setChatMessages(ms=>[...ms,m]); setChatInput(""); setChatLoading(true); try { const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:[...chatMessages,m],financialContext:finance})}); const d=await r.json(); setChatMessages(ms=>[...ms,{role:"assistant",content:d.reply}]); } catch(e){setChatMessages(ms=>[...ms,{role:"assistant",content:"Error: "+e.message}]);} setChatLoading(false); };
  return (
    <div style={{minHeight:"100vh",background:"#0a0a0f",display:"flex",flexDirection:"column"}}>
      <div style={{padding:"16px 20px 8px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid #1e1e2e"}}>
        <span style={{fontWeight:700,fontSize:18,color:"#fff"}}>Nexus</span>
        <button onClick={() => signOut()} style={{background:"none",border:"1px solid #333",color:"#888",borderRadius:8,padding:"4px 12px",fontSize:13,cursor:"pointer"}}>Sign out</button>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"16px 16px 100px"}}>
        {tab==="Overview" && <div>
          <h2 style={{color:"#fff",fontSize:22,fontWeight:700,marginBottom:16}}>Overview</h2>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
            <div style={{background:"#111120",borderRadius:16,padding:16}}><div style={{color:"#555",fontSize:11,fontWeight:700,letterSpacing:1,marginBottom:10}}>UNREAD EMAILS</div><div style={{color:"#fff",fontSize:32,fontWeight:800}}>{emails.length||"--"}</div></div>
            <div style={{background:"#111120",borderRadius:16,padding:16}}><div style={{color:"#555",fontSize:11,fontWeight:700,letterSpacing:1,marginBottom:10}}>OPEN TASKS</div><div style={{color:"#fff",fontSize:32,fontWeight:800}}>{tasks.filter(t=>!t.done).length}</div></div>
          </div>
          <div style={{background:"#111120",borderRadius:16,padding:16}}>
            <div style={{color:"#555",fontSize:11,fontWeight:700,letterSpacing:1,marginBottom:10}}>QUICK ACTIONS</div>
            {[["Load my unread inbox",()=>{setTab("Email");loadEmails();}],["Scan for deadlines",()=>{setTab("Email");scanDeadlines();}],["Ask Nexus anything",()=>setTab("Chat")],["Financial advisor",()=>setTab("Finance")]].map(([label,fn])=>(
              <div key={label} onClick={fn} style={{padding:"12px 0",borderBottom:"1px solid #1e1e2e",color:"#e0e0e0",fontSize:14,cursor:"pointer"}}>{label}</div>
            ))}
          </div>
        </div>}
        {tab==="Email" && <div>
          <h2 style={{color:"#fff",fontSize:22,fontWeight:700,marginBottom:16}}>Email</h2>
          <div style={{display:"flex",gap:8,marginBottom:16}}>
            <button onClick={loadEmails} disabled={emailLoading} style={{flex:1,padding:"12px",background:"#6366f1",color:"#fff",border:"none",borderRadius:12,fontSize:14,fontWeight:600,cursor:"pointer"}}>{emailLoading?"Loading...":"Refresh inbox"}</button>
            <button onClick={scanDeadlines} disabled={emailLoading} style={{flex:1,padding:"12px",background:"#7c3aed",color:"#fff",border:"none",borderRadius:12,fontSize:14,fontWeight:600,cursor:"pointer"}}>Scan deadlines</button>
          </div>
          {selectedEmail?(<div>
            <button onClick={()=>setSelectedEmail(null)} style={{background:"none",border:"none",color:"#6366f1",cursor:"pointer",marginBottom:12,fontSize:14}}>Back</button>
            <div style={{background:"#111120",borderRadius:16,padding:16,marginBottom:12}}>
              <div style={{color:"#fff",fontWeight:600,marginBottom:4}}>{selectedEmail.subject}</div>
              <div style={{color:"#888",fontSize:13,marginBottom:8}}>{selectedEmail.from}</div>
              {summaryLoading?<div style={{color:"#888"}}>Thinking...</div>:summary?<div style={{color:"#e0e0e0",fontSize:14,lineHeight:1.6}}>{summary}</div>:null}
            </div>
            <div style={{background:"#111120",borderRadius:16,padding:16}}>
              <input value={replyInstructions} onChange={e=>setReplyInstructions(e.target.value)} placeholder="Reply instructions..." style={S} />
              <button onClick={async()=>{setSummaryLoading(true);try{const r=await fetch("/api/email/reply",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:selectedEmail,instructions:replyInstructions})});const d=await r.json();setDraft(d.draft);}catch(e){setDraft("Error");}setSummaryLoading(false);}} style={{width:"100%",padding:"12px",background:"#6366f1",color:"#fff",border:"none",borderRadius:12,fontSize:14,fontWeight:600,cursor:"pointer",marginBottom:8}}>Draft with AI</button>
              {draft&&<><textarea value={draft} onChange={e=>setDraft(e.target.value)} rows={5} style={{...S,resize:"vertical"}} /><button onClick={async()=>{try{await fetch("/api/email/reply",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:selectedEmail,send:true,draftBody:draft})});alert("Sent!");setDraft("");setSelectedEmail(null);}catch(e){alert(e.message);}}} style={{width:"100%",padding:"12px",background:"#22c55e",color:"#fff",border:"none",borderRadius:12,fontSize:14,fontWeight:600,cursor:"pointer"}}>Send reply</button></>}
            </div>
          </div>):(
            <div>{emails.length===0&&<div style={{color:"#888",textAlign:"center",marginTop:40}}>No emails - tap Refresh</div>}{emails.map(e=><div key={e.id} onClick={()=>summarize(e)} style={{background:"#111120",borderRadius:16,padding:16,marginBottom:8,cursor:"pointer"}}><div style={{color:"#fff",fontWeight:600,fontSize:14,marginBottom:4}}>{e.subject||"(no subject)"}</div><div style={{color:"#888",fontSize:12,marginBottom:4}}>{e.from}</div><div style={{color:"#aaa",fontSize:13}}>{(e.snippet||"").slice(0,100)}...</div></div>)}</div>
          )}
        </div>}
        {tab==="Tasks" && <div>
          <h2 style={{color:"#fff",fontSize:22,fontWeight:700,marginBottom:16}}>Tasks</h2>
          <div style={{display:"flex",gap:8,marginBottom:16}}>
            <input value={newTask} onChange={e=>setNewTask(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTask()} placeholder="Add a task..." style={{...S,flex:1,margin:0}} />
            <button onClick={addTask} style={{padding:"10px 16px",background:"#6366f1",color:"#fff",border:"none",borderRadius:12,fontSize:14,fontWeight:600,cursor:"pointer"}}>Add</button>
          </div>
          {tasks.length===0&&<div style={{color:"#555",textAlign:"center",marginTop:40}}>No tasks yet.</div>}
          {tasks.map(t=><div key={t.id} style={{background:"#111120",borderRadius:16,padding:16,marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
            <button onClick={()=>setTasks(ts=>ts.map(x=>x.id===t.id?{...x,done:!x.done}:x))} style={{width:22,height:22,borderRadius:"50%",border:"2px solid "+pc(t.priority),background:t.done?pc(t.priority):"none",cursor:"pointer",flexShrink:0}} />
            <div style={{flex:1,color:t.done?"#555":"#e0e0e0",textDecoration:t.done?"line-through":"none",fontSize:14}}>{t.text}</div>
            <button onClick={()=>setTasks(ts=>ts.filter(x=>x.id!==t.id))} style={{background:"none",border:"none",color:"#555",cursor:"pointer",fontSize:18}}>x</button>
          </div>)}
        </div>}
        {tab==="Finance" && <div>
          <h2 style={{color:"#fff",fontSize:22,fontWeight:700,marginBottom:16}}>Finance</h2>
          <div style={{background:"#111120",borderRadius:16,padding:16,marginBottom:16}}>
            {[["checking","Checking ($)"],["savings","Savings ($)"],["creditCard","Credit Card Debt ($)"],["investments","Investments ($)"],["creditScore","Credit Score"]].map(([k,l])=><div key={k} style={{marginBottom:10}}><div style={{color:"#888",fontSize:12,marginBottom:4}}>{l}</div><input value={finance[k]} onChange={e=>setFinance(f=>({...f,[k]:e.target.value}))} placeholder="0" style={S} /></div>)}
          </div>
          <div style={{background:"#111120",borderRadius:16,padding:16}}>
            <input value={financeQuestion} onChange={e=>setFinanceQuestion(e.target.value)} placeholder="Ask your advisor..." style={S} />
            <button onClick={async()=>{setFinanceLoading(true);try{const r=await fetch("/api/finance/advise",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:financeQuestion,balances:finance})});const d=await r.json();setFinanceAnswer(d.advice);}catch(e){setFinanceAnswer("Error");}setFinanceLoading(false);}} disabled={financeLoading} style={{width:"100%",padding:"12px",background:"#6366f1",color:"#fff",border:"none",borderRadius:12,fontSize:14,fontWeight:600,cursor:"pointer",marginBottom:12}}>{financeLoading?"Thinking...":"Get advice"}</button>
            {financeAnswer&&<div style={{color:"#e0e0e0",fontSize:14,lineHeight:1.7}}>{financeAnswer}</div>}
          </div>
        </div>}
        {tab==="Chat" && <div>
          <h2 style={{color:"#fff",fontSize:22,fontWeight:700,marginBottom:16}}>Ask Nexus</h2>
          {chatMessages.length===0&&<div style={{color:"#555",textAlign:"center",marginTop:40}}>Ask me anything.</div>}
          {chatMessages.map((m,i)=><div key={i} style={{marginBottom:12,display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}><div style={{maxWidth:"85%",padding:"10px 14px",borderRadius:16,background:m.role==="user"?"#6366f1":"#1e1e2e",color:"#e0e0e0",fontSize:14,lineHeight:1.6}}>{m.content}</div></div>)}
          {chatLoading&&<div style={{color:"#555",fontSize:14}}>Thinking...</div>}
          <div ref={chatEndRef} />
          <div style={{display:"flex",gap:8,marginTop:16}}>
            <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendChat()} placeholder="Message Nexus..." style={{...S,flex:1,margin:0}} />
            <button onClick={sendChat} disabled={chatLoading} style={{padding:"10px 16px",background:"#6366f1",color:"#fff",border:"none",borderRadius:12,fontSize:14,fontWeight:600,cursor:"pointer"}}>Send</button>
          </div>
        </div>}
      </div>
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#0d0d1a",borderTop:"1px solid #1e1e2e",display:"flex",paddingTop:8,paddingBottom:"max(20px, env(safe-area-inset-bottom))"}}>
        {TABS.map(t=><button key={t} onClick={()=>setTab(t)} style={{flex:1,background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"4px 0"}}>
          <span style={{fontSize:20}}>{t==="Overview"?"O":t==="Email"?"E":t==="Tasks"?"T":t==="Finance"?"F":"C"}</span>
          <span style={{fontSize:10,color:tab===t?"#6366f1":"#555",fontWeight:tab===t?700:400}}>{t}</span>
        </button>)}
      </div>
    </div>
  );
}