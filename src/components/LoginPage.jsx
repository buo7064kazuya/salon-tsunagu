import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import PrivacyPolicy from './PrivacyPolicy'

export default function LoginPage() {
  const { signIn } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'reset'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [resetDone, setResetDone] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)

  const switchMode = next => { setMode(next); setError(null) }

  const handleSubmit = async e => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { error } = await signIn(email, password)
      if (error) throw error
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async e => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      setResetDone(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const Logo = () => (
    <div style={{ textAlign: 'center', marginBottom: '32px' }}>
      <div style={styles.icon}>✦</div>
      <h1 style={styles.logoName}>サロンつなぐ</h1>
      <p style={styles.logoSub}>Salon Management</p>
    </div>
  )

  // パスワードリセットメール送信完了
  if (resetDone) {
    return (
      <div style={styles.page}>
        <div style={styles.box}>
          <Logo />
          <div style={styles.successBox}>
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>✉</div>
            <p style={{ fontWeight: 600, marginBottom: '8px' }}>リセットメールを送信しました</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              {email} に届いたメールのリンクからパスワードを再設定してください。
            </p>
          </div>
          <button style={styles.linkBtn} onClick={() => { setResetDone(false); switchMode('login') }}>
            ログイン画面に戻る
          </button>
        </div>
      </div>
    )
  }

  // パスワードリセット入力フォーム
  if (mode === 'reset') {
    return (
      <div style={styles.page}>
        <div style={styles.box}>
          <Logo />
          <h2 style={styles.title}>パスワードをリセット</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px', lineHeight: 1.6 }}>
            登録済みのメールアドレスを入力してください。パスワード再設定用のリンクを送信します。
          </p>

          {error && <div style={styles.errorBox}>{translateError(error)}</div>}

          <form onSubmit={handleReset} style={styles.form}>
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
            <button type="submit" className="btn-primary" disabled={loading} style={styles.submitBtn}>
              {loading ? '送信中...' : 'リセットメールを送信'}
            </button>
          </form>

          <div style={styles.switchRow}>
            <button style={styles.linkBtn} onClick={() => switchMode('login')}>← ログイン画面に戻る</button>
          </div>
        </div>
      </div>
    )
  }

  // ログイン / 新規登録フォーム
  return (
    <div style={styles.page}>
      <div style={styles.box}>
        <Logo />

        <h2 style={styles.title}>ログイン</h2>

        {error && <div style={styles.errorBox}>{translateError(error)}</div>}

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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={styles.label}>パスワード</label>
              <button
                type="button"
                style={styles.forgotLink}
                onClick={() => switchMode('reset')}
              >
                パスワードをお忘れの方
              </button>
            </div>
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
            {loading ? '処理中...' : 'ログイン'}
          </button>
        </form>


        <div style={styles.footer}>
          <button style={styles.footerLink} onClick={() => setShowPrivacy(true)}>
            プライバシーポリシー
          </button>
        </div>
      </div>

      {showPrivacy && <PrivacyPolicy onClose={() => setShowPrivacy(false)} />}
    </div>
  )
}

function translateError(msg) {
  if (msg.includes('Invalid login credentials')) return 'メールアドレスまたはパスワードが正しくありません'
  if (msg.includes('Email not confirmed')) return 'メールアドレスの確認が完了していません。届いたメールのリンクをクリックしてください'
  if (msg.includes('User already registered')) return 'このメールアドレスはすでに登録されています'
  if (msg.includes('Password should be at least')) return 'パスワードは6文字以上で設定してください'
  if (msg.includes('rate limit') || msg.includes('over_email_send_rate_limit')) return 'メール送信の上限に達しました。しばらく待ってから再試行してください'
  if (msg.includes('For security purposes')) return 'セキュリティのため、しばらく待ってから再試行してください'
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
  forgotLink: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '11px',
    cursor: 'pointer',
    padding: '0',
    textDecoration: 'underline',
    letterSpacing: '0.02em',
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
  footer: {
    marginTop: '20px',
    textAlign: 'center',
    borderTop: '1px solid var(--border-light)',
    paddingTop: '16px',
  },
  footerLink: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '11px',
    cursor: 'pointer',
    padding: '0',
    textDecoration: 'underline',
    letterSpacing: '0.03em',
  },
}
