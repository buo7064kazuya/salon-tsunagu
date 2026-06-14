import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// ===== HELPERS =====
function fmtDate(ds) {
  if (!ds) return ''
  const [y, m, d] = ds.split('-')
  return `${y}年${parseInt(m)}月${parseInt(d)}日`
}

function fmtPrice(n) {
  return `¥${Number(n).toLocaleString()}`
}

// ===== DB =====
// public_id (UUID) で予約を取得し、内部 id (整数) も一緒に返す
async function fetchBooking(publicId) {
  const { data, error } = await supabase
    .from('appointments')
    .select('id, public_id, date, time, duration, status, notes, customers(name, phone, email), menus(name, price, duration), staff(name, color)')
    .eq('public_id', publicId)
    .single()
  if (error) throw error
  return data
}

async function cancelBooking(appointmentId) {
  const { error } = await supabase
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', appointmentId)
  if (error) throw error
}

// ===== STATUS CONFIG =====
const STATUS = {
  pending:   { label: '仮予約（確認待ち）', color: '#C9A96E', bg: 'rgba(201,169,110,0.12)', border: 'rgba(201,169,110,0.3)' },
  confirmed: { label: '予約確定',           color: '#5CB85C', bg: 'rgba(92,184,92,0.12)',   border: 'rgba(92,184,92,0.35)' },
  cancelled: { label: 'キャンセル済み',     color: '#E05C5C', bg: 'rgba(224,92,92,0.1)',    border: 'rgba(224,92,92,0.3)' },
}

// ===== ROW =====
function Row({ label, value, valueColor, last }) {
  return (
    <div style={{ display: 'flex', gap: '12px', ...(last ? {} : { marginBottom: '10px' }) }}>
      <span style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '64px', flexShrink: 0, paddingTop: '1px' }}>
        {label}
      </span>
      <span style={{ fontSize: '13px', color: valueColor || 'var(--text)', fontWeight: 500, lineHeight: 1.5 }}>
        {value}
      </span>
    </div>
  )
}

// ===== MAIN =====
export default function BookingStatusPage() {
  const { id: publicId } = useParams()   // URL param は public_id (UUID)
  const [booking, setBooking] = useState(null)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cancelling, setCancelling] = useState(false)

  // 初期データ取得
  useEffect(() => {
    fetchBooking(publicId)
      .then(data => {
        setBooking(data)
        setStatus(data.status)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [publicId])

  // Realtime: ステータス変更をリアルタイム受信（整数 id でフィルタ）
  useEffect(() => {
    if (!booking) return
    const channel = supabase
      .channel(`booking-status-${booking.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'appointments', filter: `id=eq.${booking.id}` },
        payload => setStatus(payload.new.status)
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [booking])

  const handleCancel = async () => {
    if (!window.confirm('この予約をキャンセルしてもよろしいですか？\nキャンセル後は取り消せません。')) return
    setCancelling(true)
    try {
      await cancelBooking(booking.id)
      // Realtime が status を 'cancelled' に更新する
    } catch {
      alert('キャンセルに失敗しました。もう一度お試しください。')
    } finally {
      setCancelling(false)
    }
  }

  const st = STATUS[status] ?? STATUS.pending

  // ===== LOADING / ERROR =====
  if (loading) {
    return (
      <div style={s.page}>
        <div style={{ ...s.container, paddingTop: '80px', textAlign: 'center', color: 'var(--gold)' }}>
          読み込み中...
        </div>
      </div>
    )
  }

  if (error || !booking) {
    return (
      <div style={s.page}>
        <div style={{ ...s.container, paddingTop: '80px', textAlign: 'center' }}>
          <div style={{ color: '#E05C5C', fontSize: '14px', lineHeight: 1.8 }}>
            予約情報が見つかりませんでした。<br />
            URLをご確認のうえ、もう一度お試しください。
          </div>
        </div>
      </div>
    )
  }

  const canCancel = status === 'pending' || status === 'confirmed'

  // ===== RENDER =====
  return (
    <div style={s.page}>
      <div style={s.container}>

        {/* Header */}
        <div style={s.header}>
          <div style={s.logoIcon}>✦</div>
          <div style={s.logoName}>サロンつなぐ</div>
          <div style={s.logoSub}>予約確認</div>
        </div>

        {/* Status Banner */}
        <div style={{ ...s.statusBanner, background: st.bg, border: `1px solid ${st.border}` }}>
          <div style={{ ...s.statusDot, background: st.color }} />
          <span style={{ fontSize: '14px', fontWeight: 700, color: st.color }}>{st.label}</span>
        </div>

        {/* Details Card */}
        <div style={s.card}>
          {status === 'confirmed' && (
            <p style={{ fontSize: '13px', color: '#5CB85C', marginBottom: '20px', lineHeight: 1.6 }}>
              ご予約が確定しました。当日お待ちしております。
            </p>
          )}
          {status === 'cancelled' && (
            <p style={{ fontSize: '13px', color: '#E05C5C', marginBottom: '20px', lineHeight: 1.6 }}>
              この予約はキャンセルされました。<br />
              ご不明な点はサロンまでお問い合わせください。
            </p>
          )}
          {status === 'pending' && (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.6 }}>
              ご予約を承りました。スタッフより確認のご連絡をいたします。
            </p>
          )}

          <div style={s.divider} />

          <div style={{ marginTop: '16px' }}>
            <Row label="お名前"   value={`${booking.customers?.name} 様`} />
            <Row label="メニュー" value={`${booking.menus?.name}（${fmtPrice(booking.menus?.price)} · ${booking.menus?.duration}分）`} />
            <Row label="日時"     value={`${fmtDate(booking.date)}（${booking.time}〜）`} />
            {booking.staff?.name && (
              <Row label="担当" value={booking.staff.name} />
            )}
            {booking.notes && (
              <Row label="メモ" value={booking.notes} />
            )}
            <Row label="ステータス" value={st.label} valueColor={st.color} last />
          </div>

          {/* Cancel Button */}
          {canCancel && (
            <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                style={{
                  background: 'none',
                  border: '1px solid rgba(224,92,92,0.4)',
                  color: cancelling ? 'var(--text-muted)' : '#E05C5C',
                  borderRadius: '8px', padding: '9px 24px',
                  fontSize: '13px', cursor: cancelling ? 'not-allowed' : 'pointer',
                  transition: 'opacity 0.15s',
                }}
              >
                {cancelling ? 'キャンセル中...' : 'この予約をキャンセルする'}
              </button>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                キャンセル後は取り消せません
              </p>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <span style={{ fontSize: '11px', color: 'var(--border-light)' }}>
            © サロンつなぐ運営事務局
          </span>
        </div>
      </div>
    </div>
  )
}

// ===== STYLES =====
const s = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg)',
    padding: '32px 16px 56px',
  },
  container: {
    maxWidth: '480px',
    margin: '0 auto',
  },
  header: {
    textAlign: 'center',
    marginBottom: '24px',
  },
  logoIcon: { fontSize: '28px', color: 'var(--gold)', marginBottom: '6px' },
  logoName: { fontSize: '22px', fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.08em' },
  logoSub:  { fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.12em', marginTop: '3px' },

  statusBanner: {
    borderRadius: '12px', padding: '14px 18px',
    display: 'flex', alignItems: 'center', gap: '10px',
    marginBottom: '16px',
  },
  statusDot: { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 },

  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '24px',
  },
  divider: {
    height: '1px', background: 'var(--border)', margin: '0 -24px',
  },
}
