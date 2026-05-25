import { signIn } from 'next-auth/react'

export default function SignIn() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f4' }}>
      <div style={{ background: '#fff', borderRadius: 16, border: '0.5px solid #e5e7eb', padding: '40px 48px', width: 380, textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 600, marginBottom: 6, letterSpacing: -0.5 }}>Nexus</div>
        <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 32 }}>Your AI command center</div>

        <button
          onClick={() => signIn('google', { callbackUrl: '/' })}
          style={{ width: '100%', padding: '11px 16px', borderRadius: 10, border: '0.5px solid #e5e7eb', background: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10, transition: 'background 0.1s' }}
          onMouseOver={e => e.currentTarget.style.background = '#f9fafb'}
          onMouseOut={e => e.currentTarget.style.background = '#fff'}
        >
          <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/><path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/><path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/><path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/></svg>
          Continue with Gmail (Google)
        </button>

        <button
          onClick={() => signIn('azure-ad', { callbackUrl: '/' })}
          style={{ width: '100%', padding: '11px 16px', borderRadius: 10, border: '0.5px solid #e5e7eb', background: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10, transition: 'background 0.1s' }}
          onMouseOver={e => e.currentTarget.style.background = '#f9fafb'}
          onMouseOut={e => e.currentTarget.style.background = '#fff'}
        >
          <svg width="18" height="18" viewBox="0 0 18 18"><rect x="1" y="1" width="7.5" height="7.5" fill="#f25022"/><rect x="9.5" y="1" width="7.5" height="7.5" fill="#7fba00"/><rect x="1" y="9.5" width="7.5" height="7.5" fill="#00a4ef"/><rect x="9.5" y="9.5" width="7.5" height="7.5" fill="#ffb900"/></svg>
          Continue with Outlook (Microsoft)
        </button>

        <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 24, lineHeight: 1.6 }}>
          Your emails and data are processed securely via official APIs and never stored permanently.
        </p>
      </div>
    </div>
  )
}
