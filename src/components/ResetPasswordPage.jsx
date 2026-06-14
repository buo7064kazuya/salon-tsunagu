import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function translateError(msg) {
  if (msg.includes('Password should be at least')) return 'パスワードは6文字以上で設定してください'
  if (msg.includes('same password')) return '現在のパスワードと同じパスワードは使用できません'
  if (msg.includes('weak password') || msg.includes('Weak password')) return 'パスワードが弱すぎます。より複雑なパスワードを設定してください'
  return msg
}

export default function ResetPasswordPage() {
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'invalid'
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    // PASSWORD_RECOVERY イベントを待つ（リセットリンクからの遷移時に発火）
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setStatus('ready')
    })

    // すでにセッションがある場合（トークンが処理済みの場合）
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setStatus('ready')
      } else {
        // 一定時間待ってもイベントが来なければ無効リンクと判定
        const timer = setTimeout(() => {
          setStatus(prev => prev === 'loading' ? 'invalid' : prev)
        }, 2000)
        return () => clearTimeout(timer)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async e => {
    e.preventDefault()
    if (password !== confirm) {
      setError('パスワードが一致しません')
      return
    }
    if (password.length < 6) {
      setError('パスワードは6文字以上で設定してください')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setDone(true)
    } catch (err) {
      setError(translateError(err.message))
    } finally {
      setLoading(false)
    }
  }

  // --- ローディング ---
  if (status === 'loading') {
    return (
      <div style={styles.page}>
        <div style={{ color: 'var(--gold)', fontSize: '15px' }}>読み込み中...</div>
      </div>
    )
  }

  // --- 無効リンク ---
  if (status === 'invalid') {
    return (
      <div style={styles.page}>
        <div style={styles.box}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={styles.icon}>✦</div>
            <h1 style={styles.logoName}>サロンつなぐ</h1>
          </div>
          <div style={styles.errorBox}>
            <div style={{ fontWeight: 700, marginBottom: '6px' }}>リンクが無効または期限切れです</div>
            <div style={{ fontSize: '12px', opacity: 0.85 }}>
              パスワードリセットのリンクは一度しか使用できません。再度リセットメールをお送りください。
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <a href="/" style={styles.linkBtn}>← ログイン画面へ戻る</a>
          </div>
        </div>
      </div>
    )
  }

  // --- 設定完了 ---
  if (done) {
    return (
      <div style={styles.page}>
        <div style={styles.box}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={styles.icon}>✦</div>
            <h1 style={styles.logoName}>サロンつなぐ</h1>
          </div>
          <div style={styles.successBox}>
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>✓</div>
            <p style={{ fontWeight: 600, marginBottom: '8px' }}>パスワードを変更しました</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              新しいパスワードでログインできます。
            </p>
          </div>
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <a href="/" style={styles.primaryLink}>管理画面へ進む →</a>
          </div>
        </div>
      </div>
    )
  }

  // --- パスワード入力フォーム ---
  return (
    <div style={styles.page}>
      <div style={styles.box}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={styles.icon}>✦</div>
          <h1 style={styles.logoName}>サロンつなぐ</h1>
          <p style={styles.logoSub}>Salon Management</p>
        </div>

        <h2 style={styles.title}>新しいパスワードを設定</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px', lineHeight: 1.6 }}>
          新しいパスワードを入力してください。
        </p>

        {error && <div style={styles.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>
              新しいパスワード
              <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginLeft: '6px' }}>（6文字以上）</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="input-field"
              style={styles.input}
              autoFocus
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>パスワード（確認）</label>
            <input
              type="password"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setError(null) }}
              placeholder="••••••••"
              required
              minLength={6}
              className="input-field"
              style={{
                ...styles.input,
                borderColor: confirm && password !== confirm ? 'rgba(224,92,92,0.6)' : '',
              }}
            />
            {confirm && password !== confirm && (
              <div style={{ fontSize: '11px', color: '#E05C5C', marginTop: '4px' }}>パスワードが一致しません</div>
            )}
          </div>
          <button
            type="submit"
            className="btn-primary"
            disabled={loading || (confirm.length > 0 && password !== confirm)}
            style={styles.submitBtn}
          >
            {loading ? '保存中...' : 'パスワードを設定する'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <a href="/" style={styles.linkBtn}>← ログイン画面へ戻る</a>
        </div>
      </div>
    </div>
  )
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
    marginBottom: '8px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginBottom: '8px',
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
  linkBtn: {
    color: 'var(--gold)',
    fontSize: '13px',
    textDecoration: 'underline',
  },
  primaryLink: {
    color: 'var(--gold)',
    fontSize: '14px',
    fontWeight: 700,
    textDecoration: 'none',
    letterSpacing: '0.02em',
  },
  errorBox: {
    background: 'rgba(224,92,92,0.12)',
    border: '1px solid rgba(224,92,92,0.35)',
    color: '#E05C5C',
    padding: '12px 14px',
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
    lineHeight: 1.6,
  },
}
