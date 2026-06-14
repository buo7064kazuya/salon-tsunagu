import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'

export default function LoginPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [signupDone, setSignupDone] = useState(false)

  const handleSubmit = async e => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password)
        if (error) throw error
      } else {
        const { error } = await signUp(email, password)
        if (error) throw error
        setSignupDone(true)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (signupDone) {
    return (
      <div style={styles.page}>
        <div style={styles.box}>
          <div style={styles.icon}>✦</div>
          <h1 style={styles.logoName}>サロンつなぐ</h1>
          <div style={styles.successBox}>
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>✉</div>
            <p style={{ fontWeight: 600, marginBottom: '8px' }}>確認メールを送信しました</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              {email} に届いたメールのリンクをクリックしてアカウントを有効化してください。
            </p>
          </div>
          <button style={styles.linkBtn} onClick={() => { setSignupDone(false); setMode('login') }}>
            ログイン画面に戻る
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.box}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={styles.icon}>✦</div>
          <h1 style={styles.logoName}>サロンつなぐ</h1>
          <p style={styles.logoSub}>Salon Management</p>
        </div>

        <h2 style={styles.title}>{mode === 'login' ? 'ログイン' : 'アカウント作成'}</h2>

        {error && (
          <div style={styles.errorBox}>{translateError(error)}</div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="example@salon.com"
              required
              className="input-field"
              style={styles.input}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>パスワード{mode === 'signup' && <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginLeft: '6px' }}>（6文字以上）</span>}</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="input-field"
              style={styles.input}
            />
          </div>
          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={styles.submitBtn}
          >
            {loading ? '処理中...' : mode === 'login' ? 'ログイン' : 'アカウントを作成'}
          </button>
        </form>

        <div style={styles.switchRow}>
          {mode === 'login' ? (
            <>
              <span style={{ color: 'var(--text-muted)' }}>アカウントをお持ちでない方は</span>
              <button style={styles.linkBtn} onClick={() => { setMode('signup'); setError(null) }}>新規登録</button>
            </>
          ) : (
            <>
              <span style={{ color: 'var(--text-muted)' }}>すでにアカウントをお持ちの方は</span>
              <button style={styles.linkBtn} onClick={() => { setMode('login'); setError(null) }}>ログイン</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function translateError(msg) {
  if (msg.includes('Invalid login credentials')) return 'メールアドレスまたはパスワードが正しくありません'
  if (msg.includes('Email not confirmed')) return 'メールアドレスの確認が完了していません。届いたメールのリンクをクリックしてください'
  if (msg.includes('User already registered')) return 'このメールアドレスはすでに登録されています'
  if (msg.includes('Password should be at least')) return 'パスワードは6文字以上で設定してください'
  return msg
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg)',
    padding: '20px',
  },
  box: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '40px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
  },
  icon: {
    fontSize: '28px',
    color: 'var(--gold)',
    marginBottom: '8px',
  },
  logoName: {
    fontSize: '22px',
    fontWeight: 700,
    color: 'var(--gold)',
    letterSpacing: '0.08em',
    margin: '0 0 4px',
  },
  logoSub: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    letterSpacing: '0.14em',
  },
  title: {
    fontSize: '17px',
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: '20px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginBottom: '20px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-muted)',
    letterSpacing: '0.05em',
  },
  input: {
    width: '100%',
  },
  submitBtn: {
    width: '100%',
    padding: '11px',
    fontSize: '14px',
    marginTop: '4px',
  },
  switchRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    fontSize: '13px',
    flexWrap: 'wrap',
  },
  linkBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--gold)',
    fontSize: '13px',
    cursor: 'pointer',
    padding: '0',
    textDecoration: 'underline',
  },
  errorBox: {
    background: 'rgba(224,92,92,0.12)',
    border: '1px solid rgba(224,92,92,0.35)',
    color: '#E05C5C',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '16px',
    lineHeight: 1.5,
  },
  successBox: {
    background: 'rgba(92,184,92,0.1)',
    border: '1px solid rgba(92,184,92,0.3)',
    color: 'var(--text)',
    padding: '24px',
    borderRadius: '10px',
    textAlign: 'center',
    marginBottom: '20px',
    lineHeight: 1.6,
  },
}
