import { useState, useEffect } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'

const ADMIN_EMAIL = 'buo7064kazuya@gmail.com'
const fmtPrice = n => `¥${Number(n || 0).toLocaleString()}`
const fmtDate = s =>
  s ? new Date(s).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'

// ==================== LAYOUT HELPERS ====================
const bg = { minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit' }
const centered = { ...bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }

function GateCard({ icon, iconColor = 'var(--gold)', title, titleColor = 'var(--gold)', body, link }) {
  return (
    <div style={centered}>
      <div style={{
        background: 'var(--bg-card)', border: `1px solid ${iconColor === '#E05C5C' ? '#E05C5C' : 'var(--border-light)'}`,
        borderRadius: '16px', padding: '48px 40px', textAlign: 'center', maxWidth: '420px', width: '100%',
      }}>
        <div style={{ fontSize: '2.2rem', marginBottom: '16px', color: iconColor }}>{icon}</div>
        <h1 style={{ color: titleColor, marginBottom: '12px', fontSize: '1.4rem', fontWeight: 700 }}>{title}</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '28px', fontSize: '14px', lineHeight: 1.7 }}>{body}</p>
        {link && <a href={link.href} style={{ color: 'var(--gold)', textDecoration: 'none', fontSize: '13px' }}>{link.label}</a>}
      </div>
    </div>
  )
}

// ==================== STAT CARD ====================
function StatCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-light)',
      borderRadius: '16px', padding: '28px 24px',
    }}>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: '2rem', fontWeight: 700, color, marginBottom: '8px', letterSpacing: '-0.01em' }}>{value}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{sub}</div>
    </div>
  )
}

// ==================== SALON TABLE ====================
function SalonTable({ salons }) {
  const headers = ['サロン', '登録日', '顧客数', 'スタッフ数', '今月の予約', '今月の売上', '累計予約', '累計売上']

  if (!salons || salons.length === 0) {
    return (
      <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '48px 0', fontSize: '14px' }}>
        登録されているサロンがありません
      </p>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
            {headers.map(h => (
              <th key={h} style={{
                textAlign: h === 'サロン' || h === '登録日' ? 'left' : 'right',
                padding: '10px 14px', fontSize: '11px', color: 'var(--text-muted)',
                fontWeight: 600, whiteSpace: 'nowrap', letterSpacing: '0.03em',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {salons.map(s => (
            <SalonRow key={s.salon_id} s={s} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SalonRow({ s }) {
  const [hover, setHover] = useState(false)
  const initial = (s.salon_email?.[0] || '?').toUpperCase()

  return (
    <tr
      style={{ borderBottom: '1px solid var(--border-light)', background: hover ? 'rgba(255,255,255,0.025)' : 'transparent', transition: 'background 0.15s' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <td style={{ padding: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--gold)', fontWeight: 700, fontSize: '13px', flexShrink: 0,
          }}>
            {initial}
          </div>
          <span style={{ color: 'var(--text)', fontSize: '13px' }}>{s.salon_email || '不明'}</span>
        </div>
      </td>
      <td style={{ padding: '14px', color: 'var(--text-muted)', fontSize: '12px', whiteSpace: 'nowrap' }}>
        {fmtDate(s.joined_at)}
      </td>
      <td style={{ padding: '14px', color: 'var(--text)', textAlign: 'right', fontWeight: 600 }}>{s.customer_count}</td>
      <td style={{ padding: '14px', color: 'var(--text)', textAlign: 'right', fontWeight: 600 }}>{s.staff_count}</td>
      <td style={{ padding: '14px', color: '#5CB85C', textAlign: 'right', fontWeight: 700 }}>{s.monthly_appointments}</td>
      <td style={{ padding: '14px', color: 'var(--gold)', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>
        {fmtPrice(s.monthly_revenue)}
      </td>
      <td style={{ padding: '14px', color: 'var(--text-muted)', textAlign: 'right' }}>{s.total_appointments}</td>
      <td style={{ padding: '14px', color: 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>
        {fmtPrice(s.total_revenue)}
      </td>
    </tr>
  )
}

// ==================== ADMIN STATS ====================
function AdminStats({ stats }) {
  const now = new Date()
  const monthLabel = `${now.getFullYear()}年${now.getMonth() + 1}月`

  const cards = [
    {
      label: '登録サロン数',
      value: `${stats.total_salons}件`,
      sub: '累計登録数',
      color: 'var(--gold)',
    },
    {
      label: `${monthLabel}の予約数`,
      value: `${stats.monthly_appointments}件`,
      sub: `累計 ${stats.total_appointments}件`,
      color: '#5CB85C',
    },
    {
      label: `${monthLabel}の売上合計`,
      value: fmtPrice(stats.monthly_revenue),
      sub: `累計 ${fmtPrice(stats.total_revenue)}`,
      color: 'var(--gold)',
    },
  ]

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '28px' }}>
        {cards.map(c => <StatCard key={c.label} {...c} />)}
      </div>

      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-light)',
        borderRadius: '16px', padding: '24px',
      }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', marginBottom: '20px', letterSpacing: '0.02em' }}>
          サロン別利用状況
        </h2>
        <SalonTable salons={stats.salons} />
      </div>
    </>
  )
}

// ==================== ADMIN PAGE ====================
export default function AdminPage() {
  const { user, session, signOut } = useAuth()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const isAdmin = user?.email === ADMIN_EMAIL

  useEffect(() => {
    if (session === undefined) return
    if (!session || !isAdmin) { setLoading(false); return }

    supabase.rpc('get_admin_stats').then(({ data, error: err }) => {
      if (err) setError(err.message)
      else setStats(data)
      setLoading(false)
    })
  }, [session, isAdmin])

  if (session === undefined) {
    return (
      <div style={{ ...centered, color: 'var(--gold)', fontSize: '1.1rem' }}>
        読み込み中...
      </div>
    )
  }

  if (!session) {
    return (
      <GateCard
        icon="✦"
        title="管理者ページ"
        body="アクセスするには管理者アカウントでログインしてください"
        link={{ href: '/', label: '← ログインページへ' }}
      />
    )
  }

  if (!isAdmin) {
    return (
      <GateCard
        icon="✕"
        iconColor="#E05C5C"
        title="アクセス拒否"
        titleColor="#E05C5C"
        body={<>このページへのアクセス権限がありません<br /><small style={{ opacity: 0.7 }}>（{user?.email}）</small></>}
        link={{ href: '/', label: '← ホームへ戻る' }}
      />
    )
  }

  return (
    <div style={bg}>
      {/* ヘッダー */}
      <div style={{
        background: 'var(--bg-card)', borderBottom: '1px solid var(--border-light)',
        padding: '0 32px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', height: '64px', position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: 'var(--gold)', fontSize: '1.4rem' }}>✦</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}>サロンつなぐ</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>ADMIN DASHBOARD</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{user?.email}</span>
          <a
            href="/"
            style={{ color: 'var(--gold)', textDecoration: 'none', fontSize: '12px', opacity: 0.85 }}
          >
            通常画面 →
          </a>
          <button
            onClick={signOut}
            style={{
              background: 'none', border: '1px solid var(--border-light)',
              color: 'var(--text-muted)', borderRadius: '6px',
              padding: '6px 14px', fontSize: '12px', cursor: 'pointer',
            }}
          >
            ログアウト
          </button>
        </div>
      </div>

      {/* コンテンツ */}
      <div style={{ padding: '36px 32px', maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text)', marginBottom: '6px' }}>
          管理者ダッシュボード
        </h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '32px', fontSize: '13px' }}>
          全サロンの登録状況・予約数・売上を確認できます
        </p>

        {loading ? (
          <div style={{ color: 'var(--gold)', textAlign: 'center', padding: '80px', fontSize: '15px' }}>
            読み込み中...
          </div>
        ) : error ? (
          <div style={{
            background: 'rgba(224,92,92,0.08)', border: '1px solid rgba(224,92,92,0.35)',
            borderRadius: '14px', padding: '28px',
          }}>
            <div style={{ fontWeight: 700, color: '#E05C5C', marginBottom: '10px', fontSize: '15px' }}>
              データ取得エラー
            </div>
            <div style={{ fontSize: '13px', color: '#E05C5C', marginBottom: '20px', opacity: 0.85 }}>{error}</div>
            <div style={{
              background: 'var(--bg-card)', borderRadius: '10px', padding: '16px',
              fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.8,
            }}>
              <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>解決方法</div>
              <div>Supabase ダッシュボード › SQL Editor で以下のファイルを実行してください：</div>
              <code style={{ color: 'var(--gold)', fontSize: '11px' }}>supabase/admin_functions.sql</code>
              <div style={{ marginTop: '6px' }}>
                ※ 事前に <code style={{ color: 'var(--gold)', fontSize: '11px' }}>supabase/rls.sql</code> も実行してください
              </div>
            </div>
          </div>
        ) : stats ? (
          <AdminStats stats={stats} />
        ) : null}
      </div>
    </div>
  )
}
