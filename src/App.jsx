import { useState, useEffect, useRef } from 'react'
import './App.css'
import {
  fetchStaff, upsertStaff, deleteStaff as dbDeleteStaff,
  fetchMenus, upsertMenu, deleteMenu as dbDeleteMenu,
  fetchCustomers, upsertCustomer, deleteCustomer as dbDeleteCustomer,
  fetchAppointments, upsertAppointment, deleteAppointment as dbDeleteAppointment,
} from './lib/db'
import { supabase } from './lib/supabase'
import { useAuth } from './lib/AuthContext'
import LoginPage from './components/LoginPage'

// ==================== HELPERS ====================
function getTodayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const TODAY = getTodayStr()
const pad = n => String(n).padStart(2, '0')
const fmtPrice = n => `¥${Number(n).toLocaleString()}`
const fmtDate = str => {
  if (!str) return ''
  const [y, m, d] = str.split('-')
  return `${y}年${parseInt(m)}月${parseInt(d)}日`
}

const DAYS_JP = ['日', '月', '火', '水', '木', '金', '土']
const MONTHS_JP = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
const STATUS_LABELS = { confirmed: '確定', pending: '仮予約', cancelled: 'キャンセル' }
const STATUS_COLORS = { confirmed: '#5CB85C', pending: '#C9A96E', cancelled: '#E05C5C' }

function timeToMins(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function checkDuplicate(appointments, appt, excludeId = null) {
  const start = timeToMins(appt.time)
  const end = start + Number(appt.duration)
  return appointments.some(a => {
    if (a.id === excludeId) return false
    if (Number(a.staffId) !== Number(appt.staffId)) return false
    if (a.date !== appt.date) return false
    if (a.status === 'cancelled') return false
    const aStart = timeToMins(a.time)
    const aEnd = aStart + Number(a.duration)
    return start < aEnd && end > aStart
  })
}

function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate() }
function getFirstDOW(y, m) { return new Date(y, m, 1).getDay() }

// ==================== SIDEBAR ====================
const NAV = [
  { id: 'dashboard', label: 'ダッシュボード', icon: '◈' },
  { id: 'calendar', label: 'カレンダー', icon: '◉' },
  { id: 'appointments', label: '予約管理', icon: '◆' },
  { id: 'customers', label: '顧客管理', icon: '◎' },
  { id: 'menus', label: 'メニュー管理', icon: '◐' },
  { id: 'staff', label: 'スタッフ管理', icon: '◑' },
]

function Sidebar({ page, setPage, user, onSignOut, notifPerm, onRequestNotif }) {
  const [copied, setCopied] = useState(false)

  const copyBookingUrl = () => {
    const url = `${window.location.origin}/book/${user?.id}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="logo-icon">✦</span>
        <div>
          <div className="logo-name">サロンつなぐ</div>
          <div className="logo-sub">Salon Management</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {NAV.map(item => (
          <button
            key={item.id}
            className={'nav-item' + (page === item.id ? ' active' : '')}
            onClick={() => setPage(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user?.email}
        </div>
        {notifPerm === 'default' && (
          <button
            onClick={onRequestNotif}
            style={{
              background: 'none', border: '1px solid var(--border-light)',
              color: 'var(--text-muted)', borderRadius: '6px',
              padding: '5px 10px', fontSize: '11px', cursor: 'pointer', textAlign: 'left',
            }}
          >
            予約通知を有効にする
          </button>
        )}
        {notifPerm === 'granted' && (
          <div style={{ fontSize: '11px', color: 'var(--success)', letterSpacing: '0.02em' }}>
            ✓ 予約通知 有効
          </div>
        )}
        <button
          onClick={copyBookingUrl}
          style={{
            background: copied ? 'rgba(92,184,92,0.12)' : 'var(--gold-dim)',
            border: `1px solid ${copied ? 'rgba(92,184,92,0.4)' : 'rgba(201,169,110,0.3)'}`,
            color: copied ? '#5CB85C' : 'var(--gold)',
            borderRadius: '6px', padding: '6px 10px', fontSize: '11px',
            cursor: 'pointer', textAlign: 'left', transition: 'background 0.2s, color 0.2s, border-color 0.2s',
            fontWeight: 600, letterSpacing: '0.02em',
          }}
        >
          {copied ? '✓ コピーしました' : '予約ページURLをコピー'}
        </button>
        <button
          onClick={onSignOut}
          style={{ background: 'none', border: '1px solid var(--border-light)', color: 'var(--text-muted)', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s, color 0.15s' }}
          onMouseEnter={e => { e.target.style.borderColor = 'var(--danger)'; e.target.style.color = 'var(--danger)' }}
          onMouseLeave={e => { e.target.style.borderColor = 'var(--border-light)'; e.target.style.color = 'var(--text-muted)' }}
        >
          ログアウト
        </button>
      </div>
    </aside>
  )
}

// ==================== TOAST ====================
function Toast({ message, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      position: 'fixed', top: '20px', right: '20px', zIndex: 2000,
      background: 'var(--bg-card)', border: '1px solid var(--gold)',
      borderRadius: '12px', padding: '14px 16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'flex-start', gap: '12px',
      minWidth: '260px', maxWidth: '360px',
      animation: 'slideIn 0.25s ease',
    }}>
      <span style={{ color: 'var(--gold)', fontSize: '16px', lineHeight: 1, marginTop: '1px', flexShrink: 0 }}>◆</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginBottom: '3px' }}>
          新しい予約が入りました
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{message}</div>
      </div>
      <button onClick={onClose} style={{
        background: 'none', border: 'none', color: 'var(--text-muted)',
        cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: 0, flexShrink: 0,
      }}>✕</button>
    </div>
  )
}

// ==================== LOADING / ERROR ====================
function LoadingScreen() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#C9A96E', fontSize: '1.1rem' }}>
      読み込み中...
    </div>
  )
}

function ErrorScreen({ message, onRetry }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem' }}>
      <div style={{ color: '#E05C5C', fontSize: '1rem' }}>データの読み込みに失敗しました</div>
      <div style={{ color: '#888', fontSize: '0.85rem' }}>{message}</div>
      <button className="btn-primary" onClick={onRetry}>再試行</button>
    </div>
  )
}

// ==================== DASHBOARD ====================
function Dashboard({ appointments, customers, menus, staff, openModal, setPage }) {
  const todayAppts = appointments.filter(a => a.date === TODAY && a.status !== 'cancelled')
  const revenue = todayAppts
    .filter(a => a.status === 'confirmed')
    .reduce((s, a) => s + (menus.find(m => m.id === a.menuId)?.price || 0), 0)

  const upcoming = [...appointments]
    .filter(a => a.date >= TODAY && a.status !== 'cancelled')
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    .slice(0, 6)

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">ダッシュボード</h1>
        <button className="btn-primary" onClick={() => openModal('appointment')}>＋ 新規予約</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">本日の予約</div>
          <div className="stat-value gold">{todayAppts.length}</div>
          <div className="stat-sub">確定 {todayAppts.filter(a => a.status === 'confirmed').length} / 仮予約 {todayAppts.filter(a => a.status === 'pending').length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">本日の売上見込</div>
          <div className="stat-value gold">{fmtPrice(revenue)}</div>
          <div className="stat-sub">確定予約より算出</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">登録顧客数</div>
          <div className="stat-value purple">{customers.length}名</div>
          <div className="stat-sub">全登録顧客</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">在籍スタッフ</div>
          <div className="stat-value purple">{staff.length}名</div>
          <div className="stat-sub">全スタッフ</div>
        </div>
      </div>

      <div className="dashboard-row">
        <div className="card flex2">
          <div className="card-header">
            <h2 className="card-title">直近の予約</h2>
            <button className="btn-link" onClick={() => setPage('appointments')}>すべて見る →</button>
          </div>
          {upcoming.length === 0
            ? <p className="empty-state">予約がありません</p>
            : upcoming.map(a => {
              const c = customers.find(x => x.id === a.customerId)
              const s = staff.find(x => x.id === a.staffId)
              const m = menus.find(x => x.id === a.menuId)
              return (
                <div key={a.id} className="appt-row" onClick={() => openModal('appointment', a)}>
                  <div className="appt-color-bar" style={{ background: s?.color || '#C9A96E' }} />
                  <div className="appt-row-date">
                    <div className="appt-row-d">{a.date === TODAY ? '本日' : fmtDate(a.date)}</div>
                    <div className="appt-row-t">{a.time}</div>
                  </div>
                  <div className="appt-row-info">
                    <div className="appt-row-name">{c?.name || '不明'}</div>
                    <div className="appt-row-sub">{m?.name} · {s?.name}</div>
                  </div>
                  <span className="status-badge" style={{ background: STATUS_COLORS[a.status] + '22', color: STATUS_COLORS[a.status] }}>
                    {STATUS_LABELS[a.status]}
                  </span>
                </div>
              )
            })
          }
        </div>

        <div className="card flex1">
          <div className="card-header">
            <h2 className="card-title">本日のスタッフ</h2>
          </div>
          {staff.map(s => {
            const count = todayAppts.filter(a => a.staffId === s.id).length
            return (
              <div key={s.id} className="staff-row">
                <div className="staff-avatar-sm" style={{ background: s.color + '33', borderColor: s.color, color: s.color }}>
                  {s.name[0]}
                </div>
                <div className="staff-row-info">
                  <div className="staff-row-name">{s.name}</div>
                  <div className="staff-row-role">{s.role}</div>
                </div>
                <div className="staff-row-count" style={{ color: s.color }}>{count}件</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ==================== CALENDAR ====================
function CalendarPage({ appointments, customers, menus, staff, calendarDate, setCalendarDate, calendarView, setCalendarView, openModal }) {
  const y = calendarDate.getFullYear()
  const mo = calendarDate.getMonth()

  const prev = () => {
    if (calendarView === 'month') setCalendarDate(new Date(y, mo - 1, 1))
    else setCalendarDate(new Date(calendarDate.getTime() - 7 * 86400000))
  }
  const next = () => {
    if (calendarView === 'month') setCalendarDate(new Date(y, mo + 1, 1))
    else setCalendarDate(new Date(calendarDate.getTime() + 7 * 86400000))
  }

  const ws = new Date(calendarDate)
  ws.setDate(calendarDate.getDate() - calendarDate.getDay())

  const navTitle = calendarView === 'month'
    ? `${y}年 ${MONTHS_JP[mo]}`
    : `${y}年${MONTHS_JP[ws.getMonth()]}${ws.getDate()}日 〜 ${ws.getDate() + 6}日`

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">カレンダー</h1>
        <div className="header-actions">
          <div className="view-toggle">
            <button className={'toggle-btn' + (calendarView === 'month' ? ' active' : '')} onClick={() => setCalendarView('month')}>月</button>
            <button className={'toggle-btn' + (calendarView === 'week' ? ' active' : '')} onClick={() => setCalendarView('week')}>週</button>
          </div>
          <button className="btn-primary" onClick={() => openModal('appointment')}>＋ 新規予約</button>
        </div>
      </div>

      <div className="cal-nav">
        <button className="icon-btn" onClick={prev}>‹</button>
        <span className="cal-nav-title">{navTitle}</span>
        <button className="icon-btn" onClick={next}>›</button>
      </div>

      {calendarView === 'month'
        ? <MonthView year={y} month={mo} appointments={appointments} customers={customers} staff={staff} openModal={openModal} />
        : <WeekView baseDate={calendarDate} appointments={appointments} customers={customers} staff={staff} openModal={openModal} />
      }
    </div>
  )
}

function MonthView({ year, month, appointments, customers, staff, openModal }) {
  const days = getDaysInMonth(year, month)
  const firstDOW = getFirstDOW(year, month)
  const cells = [...Array(firstDOW).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]

  return (
    <div className="card cal-card">
      <div className="month-header-row">
        {DAYS_JP.map(d => <div key={d} className={'month-dow' + (d === '日' ? ' sun' : d === '土' ? ' sat' : '')}>{d}</div>)}
      </div>
      <div className="month-grid">
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} className="month-cell empty" />
          const ds = `${year}-${pad(month + 1)}-${pad(day)}`
          const da = appointments.filter(a => a.date === ds && a.status !== 'cancelled')
          const isToday = ds === TODAY
          const dow = (firstDOW + day - 1) % 7
          return (
            <div key={day} className={'month-cell' + (isToday ? ' today' : '')} onClick={() => openModal('appointment', { date: ds })}>
              <div className={'month-day-num' + (isToday ? ' today' : '') + (dow === 0 ? ' sun' : dow === 6 ? ' sat' : '')}>{day}</div>
              {da.slice(0, 3).map(a => {
                const s = staff.find(x => x.id === a.staffId)
                const c = customers.find(x => x.id === a.customerId)
                return (
                  <div key={a.id} className="month-appt" style={{ borderLeftColor: s?.color || '#C9A96E' }}
                    onClick={e => { e.stopPropagation(); openModal('appointment', a) }}>
                    {a.time} {c?.name?.split(' ')[0] || ''}
                  </div>
                )
              })}
              {da.length > 3 && <div className="month-more">+{da.length - 3}件</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeekView({ baseDate, appointments, customers, staff, openModal }) {
  const ws = new Date(baseDate)
  ws.setDate(baseDate.getDate() - baseDate.getDay())
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(ws); d.setDate(ws.getDate() + i); return d })
  const hours = Array.from({ length: 12 }, (_, i) => i + 9)

  return (
    <div className="card cal-card week-card">
      <div className="week-grid">
        <div className="week-time-col">
          <div className="week-corner" />
          {hours.map(h => <div key={h} className="week-time-label">{pad(h)}:00</div>)}
        </div>
        {days.map(d => {
          const ds = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
          const da = appointments.filter(a => a.date === ds && a.status !== 'cancelled')
          const isToday = ds === TODAY
          return (
            <div key={ds} className="week-day-col">
              <div className={'week-day-header' + (isToday ? ' today' : '')}>
                <div className="week-dow">{DAYS_JP[d.getDay()]}</div>
                <div className={'week-date-num' + (isToday ? ' today' : '')}>{d.getDate()}</div>
              </div>
              <div className="week-body">
                {hours.map(h => (
                  <div key={h} className="week-hour-cell"
                    onClick={() => openModal('appointment', { date: ds, time: `${pad(h)}:00` })} />
                ))}
                {da.map(a => {
                  const s = staff.find(x => x.id === a.staffId)
                  const c = customers.find(x => x.id === a.customerId)
                  const startMins = timeToMins(a.time) - 9 * 60
                  const top = (startMins / 60) * 48
                  const height = Math.max((Number(a.duration) / 60) * 48, 22)
                  return (
                    <div key={a.id} className="week-appt-block"
                      style={{ top: `${top}px`, height: `${height}px`, background: (s?.color || '#C9A96E') + '33', borderLeftColor: s?.color || '#C9A96E' }}
                      onClick={e => { e.stopPropagation(); openModal('appointment', a) }}>
                      <div className="week-appt-time">{a.time}</div>
                      <div className="week-appt-name">{c?.name?.split(' ')[0] || ''}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ==================== APPOINTMENTS PAGE ====================
function AppointmentsPage({ appointments, customers, menus, staff, openModal, onConfirm }) {
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const filtered = appointments
    .filter(a => {
      if (dateFilter && a.date !== dateFilter) return false
      if (statusFilter && a.status !== statusFilter) return false
      if (search) {
        const c = customers.find(x => x.id === a.customerId)
        const s = staff.find(x => x.id === a.staffId)
        const m = menus.find(x => x.id === a.menuId)
        const q = search.toLowerCase()
        return c?.name.toLowerCase().includes(q) || s?.name.toLowerCase().includes(q) || m?.name.toLowerCase().includes(q)
      }
      return true
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">予約管理</h1>
        <button className="btn-primary" onClick={() => openModal('appointment')}>＋ 新規予約</button>
      </div>
      <div className="filter-bar">
        <input className="input-field filter-search" placeholder="顧客名・スタッフ・メニューで検索" value={search} onChange={e => setSearch(e.target.value)} />
        <input type="date" className="input-field" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
        <select className="input-field" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">すべてのステータス</option>
          <option value="confirmed">確定</option>
          <option value="pending">仮予約</option>
          <option value="cancelled">キャンセル</option>
        </select>
      </div>
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>日時</th><th>顧客名</th><th>メニュー</th><th>担当スタッフ</th><th>料金</th><th>ステータス</th><th />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={7} className="empty-td">予約が見つかりません</td></tr>
              : filtered.map(a => {
                const c = customers.find(x => x.id === a.customerId)
                const s = staff.find(x => x.id === a.staffId)
                const m = menus.find(x => x.id === a.menuId)
                return (
                  <tr key={a.id} className="table-row" onClick={() => openModal('appointment', a)}>
                    <td>
                      <div className="td-main">{fmtDate(a.date)}</div>
                      <div className="td-sub">{a.time}</div>
                    </td>
                    <td>{c?.name || '不明'}</td>
                    <td>{m?.name || '不明'}</td>
                    <td>
                      <span className="staff-chip" style={{ borderColor: s?.color || '#555', color: s?.color || '#ccc' }}>
                        {s?.name || '不明'}
                      </span>
                    </td>
                    <td>{m ? fmtPrice(m.price) : '-'}</td>
                    <td>
                      <span className="status-badge" style={{ background: STATUS_COLORS[a.status] + '22', color: STATUS_COLORS[a.status] }}>
                        {STATUS_LABELS[a.status]}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'flex-end' }}>
                        {a.status === 'pending' && (
                          <button
                            onClick={e => { e.stopPropagation(); onConfirm(a.id) }}
                            style={{
                              background: 'rgba(92,184,92,0.12)', border: '1px solid rgba(92,184,92,0.4)',
                              color: '#5CB85C', borderRadius: '6px', padding: '4px 10px',
                              fontSize: '11px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                            }}
                          >
                            確定する
                          </button>
                        )}
                        <button className="btn-icon-sm" onClick={e => { e.stopPropagation(); openModal('appointment', a) }}>✎</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ==================== CUSTOMERS PAGE ====================
function CustomersPage({ customers, openModal }) {
  const [search, setSearch] = useState('')
  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">顧客管理</h1>
        <button className="btn-primary" onClick={() => openModal('customer')}>＋ 顧客追加</button>
      </div>
      <div className="filter-bar">
        <input className="input-field filter-search" placeholder="名前・電話番号・メールで検索" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="card">
        <table className="data-table">
          <thead>
            <tr><th>顧客名</th><th>電話番号</th><th>メールアドレス</th><th>来店回数</th><th>備考</th><th /></tr>
          </thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={6} className="empty-td">顧客が見つかりません</td></tr>
              : filtered.map(c => (
                <tr key={c.id} className="table-row" onClick={() => openModal('customer', c)}>
                  <td>
                    <div className="customer-name-cell">
                      <div className="customer-avatar">{c.name[0]}</div>
                      {c.name}
                    </div>
                  </td>
                  <td>{c.phone || '-'}</td>
                  <td>{c.email || '-'}</td>
                  <td><span className="visit-badge">{c.visitCount}回</span></td>
                  <td className="td-sub">{c.notes || '-'}</td>
                  <td><button className="btn-icon-sm" onClick={e => { e.stopPropagation(); openModal('customer', c) }}>✎</button></td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ==================== MENUS PAGE ====================
function MenusPage({ menus, openModal }) {
  const categories = [...new Set(menus.map(m => m.category))]

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">メニュー管理</h1>
        <button className="btn-primary" onClick={() => openModal('menu')}>＋ メニュー追加</button>
      </div>
      {categories.map(cat => (
        <div key={cat} className="menu-section">
          <h2 className="section-title">{cat}</h2>
          <div className="menu-grid">
            {menus.filter(m => m.category === cat).map(m => (
              <div key={m.id} className="menu-card" onClick={() => openModal('menu', m)}>
                <div className="menu-card-top">
                  <span className="menu-card-name">{m.name}</span>
                  <button className="btn-icon-sm" onClick={e => { e.stopPropagation(); openModal('menu', m) }}>✎</button>
                </div>
                <div className="menu-card-price">{fmtPrice(m.price)}</div>
                <div className="menu-card-dur">{m.duration}分</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ==================== STAFF PAGE ====================
function StaffPage({ staff, appointments, openModal }) {
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">スタッフ管理</h1>
        <button className="btn-primary" onClick={() => openModal('staff')}>＋ スタッフ追加</button>
      </div>
      <div className="staff-card-grid">
        {staff.map(s => {
          const total = appointments.filter(a => a.staffId === s.id && a.status !== 'cancelled').length
          const todayCount = appointments.filter(a => a.staffId === s.id && a.date === TODAY && a.status !== 'cancelled').length
          return (
            <div key={s.id} className="staff-card">
              <div className="staff-card-avatar" style={{ background: s.color + '22', borderColor: s.color, color: s.color }}>
                {s.name[0]}
              </div>
              <div className="staff-card-name">{s.name}</div>
              <div className="staff-card-role">{s.role}</div>
              <div className="staff-card-stats">
                <div className="staff-stat-item">
                  <div className="staff-stat-val" style={{ color: s.color }}>{todayCount}</div>
                  <div className="staff-stat-lbl">本日</div>
                </div>
                <div className="staff-stat-item">
                  <div className="staff-stat-val" style={{ color: s.color }}>{total}</div>
                  <div className="staff-stat-lbl">累計</div>
                </div>
              </div>
              <button className="btn-secondary sm" onClick={() => openModal('staff', s)}>編集</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ==================== MODAL ====================
function Modal({ modal, onClose, appointments, customers, menus, staff, saveAppointment, deleteAppointment, saveCustomer, deleteCustomer, saveMenu, deleteMenu, saveStaff, deleteStaff }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>✕</button>
        {modal.type === 'appointment' && (
          <AppointmentForm data={modal.data} appointments={appointments} customers={customers} menus={menus} staff={staff}
            onSave={saveAppointment} onDelete={deleteAppointment} onClose={onClose} />
        )}
        {modal.type === 'customer' && (
          <CustomerForm data={modal.data} onSave={saveCustomer} onDelete={deleteCustomer} onClose={onClose} />
        )}
        {modal.type === 'menu' && (
          <MenuForm data={modal.data} onSave={saveMenu} onDelete={deleteMenu} onClose={onClose} />
        )}
        {modal.type === 'staff' && (
          <StaffForm data={modal.data} onSave={saveStaff} onDelete={deleteStaff} onClose={onClose} />
        )}
      </div>
    </div>
  )
}

// ==================== APPOINTMENT FORM ====================
function AppointmentForm({ data, appointments, customers, menus, staff, onSave, onDelete, onClose }) {
  const isEdit = Boolean(data?.id)
  const [form, setForm] = useState({
    id: data?.id ?? null,
    customerId: data?.customerId ?? customers[0]?.id ?? '',
    staffId: data?.staffId ?? staff[0]?.id ?? '',
    menuId: data?.menuId ?? menus[0]?.id ?? '',
    date: data?.date ?? TODAY,
    time: data?.time ?? '10:00',
    duration: data?.duration ?? menus[0]?.duration ?? 60,
    notes: data?.notes ?? '',
    status: data?.status ?? 'confirmed',
  })
  const [saving, setSaving] = useState(false)

  const update = (key, val) => {
    setForm(prev => {
      const next = { ...prev, [key]: val }
      if (key === 'menuId') {
        const m = menus.find(x => x.id === Number(val))
        if (m) next.duration = m.duration
      }
      return next
    })
  }

  const dupWarn = checkDuplicate(appointments, { ...form, staffId: Number(form.staffId), duration: Number(form.duration) }, isEdit ? form.id : null)

  const handleSave = async () => {
    if (!form.customerId || !form.staffId || !form.menuId || !form.date || !form.time) return
    setSaving(true)
    await onSave({ ...form, customerId: Number(form.customerId), staffId: Number(form.staffId), menuId: Number(form.menuId), duration: Number(form.duration) })
    setSaving(false)
  }

  return (
    <>
      <h2 className="modal-title">{isEdit ? '予約を編集' : '新規予約'}</h2>
      {dupWarn && <div className="dup-warning">⚠ このスタッフはこの時間帯に別の予約があります（重複）</div>}
      <div className="form-grid">
        <div className="form-group">
          <label className="form-label">顧客</label>
          <select className="input-field" value={form.customerId} onChange={e => update('customerId', e.target.value)}>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">担当スタッフ</label>
          <select className="input-field" value={form.staffId} onChange={e => update('staffId', e.target.value)}>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="form-group full-w">
          <label className="form-label">メニュー</label>
          <select className="input-field" value={form.menuId} onChange={e => update('menuId', e.target.value)}>
            {menus.map(m => <option key={m.id} value={m.id}>{m.name}（{fmtPrice(m.price)} · {m.duration}分）</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">日付</label>
          <input type="date" className="input-field" value={form.date} onChange={e => update('date', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">開始時間</label>
          <input type="time" className="input-field" value={form.time} onChange={e => update('time', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">所要時間（分）</label>
          <input type="number" className="input-field" value={form.duration} min={15} step={15} onChange={e => update('duration', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">ステータス</label>
          <select className="input-field" value={form.status} onChange={e => update('status', e.target.value)}>
            <option value="confirmed">確定</option>
            <option value="pending">仮予約</option>
            <option value="cancelled">キャンセル</option>
          </select>
        </div>
        <div className="form-group full-w">
          <label className="form-label">メモ</label>
          <textarea className="input-field" rows={3} value={form.notes} onChange={e => update('notes', e.target.value)} />
        </div>
      </div>
      <div className="modal-footer">
        {isEdit && <button className="btn-danger" disabled={saving} onClick={() => { if (window.confirm('この予約を削除しますか？')) onDelete(form.id) }}>削除</button>}
        <div style={{ flex: 1 }} />
        <button className="btn-secondary" onClick={onClose}>キャンセル</button>
        <button className="btn-primary" disabled={saving} onClick={handleSave}>{saving ? '保存中...' : isEdit ? '更新する' : '予約する'}</button>
      </div>
    </>
  )
}

// ==================== CUSTOMER FORM ====================
function CustomerForm({ data, onSave, onDelete, onClose }) {
  const isEdit = Boolean(data?.id)
  const [form, setForm] = useState({
    id: data?.id ?? null,
    name: data?.name ?? '',
    phone: data?.phone ?? '',
    email: data?.email ?? '',
    notes: data?.notes ?? '',
    visitCount: data?.visitCount ?? 0,
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.name) return
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <>
      <h2 className="modal-title">{isEdit ? '顧客を編集' : '顧客を追加'}</h2>
      <div className="form-grid">
        <div className="form-group full-w">
          <label className="form-label">顧客名 <span className="req">*</span></label>
          <input className="input-field" value={form.name} onChange={e => set('name', e.target.value)} placeholder="例: 山田 太郎" />
        </div>
        <div className="form-group">
          <label className="form-label">電話番号</label>
          <input className="input-field" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="090-0000-0000" />
        </div>
        <div className="form-group">
          <label className="form-label">メールアドレス</label>
          <input type="email" className="input-field" value={form.email} onChange={e => set('email', e.target.value)} />
        </div>
        <div className="form-group full-w">
          <label className="form-label">備考</label>
          <textarea className="input-field" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
      </div>
      <div className="modal-footer">
        {isEdit && <button className="btn-danger" disabled={saving} onClick={() => { if (window.confirm('この顧客を削除しますか？')) onDelete(form.id) }}>削除</button>}
        <div style={{ flex: 1 }} />
        <button className="btn-secondary" onClick={onClose}>キャンセル</button>
        <button className="btn-primary" disabled={saving} onClick={handleSave}>{saving ? '保存中...' : isEdit ? '更新する' : '追加する'}</button>
      </div>
    </>
  )
}

// ==================== MENU FORM ====================
function MenuForm({ data, onSave, onDelete, onClose }) {
  const isEdit = Boolean(data?.id)
  const [form, setForm] = useState({
    id: data?.id ?? null,
    name: data?.name ?? '',
    price: data?.price ?? 0,
    duration: data?.duration ?? 60,
    category: data?.category ?? 'カット',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.name) return
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <>
      <h2 className="modal-title">{isEdit ? 'メニューを編集' : 'メニューを追加'}</h2>
      <div className="form-grid">
        <div className="form-group full-w">
          <label className="form-label">メニュー名 <span className="req">*</span></label>
          <input className="input-field" value={form.name} onChange={e => set('name', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">料金（円）</label>
          <input type="number" className="input-field" value={form.price} min={0} onChange={e => set('price', Number(e.target.value))} />
        </div>
        <div className="form-group">
          <label className="form-label">所要時間（分）</label>
          <input type="number" className="input-field" value={form.duration} min={15} step={15} onChange={e => set('duration', Number(e.target.value))} />
        </div>
        <div className="form-group full-w">
          <label className="form-label">カテゴリ</label>
          <input className="input-field" value={form.category} onChange={e => set('category', e.target.value)} placeholder="例: カット" />
        </div>
      </div>
      <div className="modal-footer">
        {isEdit && <button className="btn-danger" disabled={saving} onClick={() => { if (window.confirm('このメニューを削除しますか？')) onDelete(form.id) }}>削除</button>}
        <div style={{ flex: 1 }} />
        <button className="btn-secondary" onClick={onClose}>キャンセル</button>
        <button className="btn-primary" disabled={saving} onClick={handleSave}>{saving ? '保存中...' : isEdit ? '更新する' : '追加する'}</button>
      </div>
    </>
  )
}

// ==================== STAFF FORM ====================
const PRESET_COLORS = ['#C9A96E', '#8B6F9E', '#5CA89E', '#E05C5C', '#5CB85C', '#5C8BCC']

function StaffForm({ data, onSave, onDelete, onClose }) {
  const isEdit = Boolean(data?.id)
  const [form, setForm] = useState({
    id: data?.id ?? null,
    name: data?.name ?? '',
    role: data?.role ?? '',
    color: data?.color ?? '#C9A96E',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.name) return
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <>
      <h2 className="modal-title">{isEdit ? 'スタッフを編集' : 'スタッフを追加'}</h2>
      <div className="form-grid">
        <div className="form-group full-w">
          <label className="form-label">氏名 <span className="req">*</span></label>
          <input className="input-field" value={form.name} onChange={e => set('name', e.target.value)} placeholder="例: 田中 花子" />
        </div>
        <div className="form-group full-w">
          <label className="form-label">役職</label>
          <input className="input-field" value={form.role} onChange={e => set('role', e.target.value)} placeholder="例: シニアスタイリスト" />
        </div>
        <div className="form-group full-w">
          <label className="form-label">カラー</label>
          <div className="color-picker-row">
            {PRESET_COLORS.map(c => (
              <button key={c} type="button"
                className={'color-swatch' + (form.color === c ? ' selected' : '')}
                style={{ background: c }}
                onClick={() => set('color', c)} />
            ))}
          </div>
        </div>
      </div>
      <div className="modal-footer">
        {isEdit && <button className="btn-danger" disabled={saving} onClick={() => { if (window.confirm('このスタッフを削除しますか？')) onDelete(form.id) }}>削除</button>}
        <div style={{ flex: 1 }} />
        <button className="btn-secondary" onClick={onClose}>キャンセル</button>
        <button className="btn-primary" disabled={saving} onClick={handleSave}>{saving ? '保存中...' : isEdit ? '更新する' : '追加する'}</button>
      </div>
    </>
  )
}

// ==================== ROOT APP ====================
export default function App() {
  const { session, user, signOut } = useAuth()
  const [page, setPage] = useState('dashboard')
  const [appointments, setAppointments] = useState([])
  const [customers, setCustomers] = useState([])
  const [menus, setMenus] = useState([])
  const [staff, setStaff] = useState([])
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [calendarView, setCalendarView] = useState('month')
  const [modal, setModal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const [notifPerm, setNotifPerm] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  )

  const requestNotifPerm = async () => {
    if (typeof Notification === 'undefined') return
    const result = await Notification.requestPermission()
    setNotifPerm(result)
  }

  const loadAll = async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, m, c, a] = await Promise.all([
        fetchStaff(),
        fetchMenus(),
        fetchCustomers(),
        fetchAppointments(),
      ])
      setStaff(s)
      setMenus(m)
      setCustomers(c)
      setAppointments(a)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // session が変化したとき（ログイン時）にデータを読み込む
  useEffect(() => { if (session) loadAll() }, [session])

  // Supabase Realtime: 新着予約をリアルタイム受信
  useEffect(() => {
    if (!session) return
    const channel = supabase
      .channel('appointments-inserts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'appointments' },
        payload => {
          const r = payload.new
          const appt = {
            id: r.id, customerId: r.customer_id, staffId: r.staff_id,
            menuId: r.menu_id, date: r.date, time: r.time,
            duration: r.duration, notes: r.notes, status: r.status,
          }
          setAppointments(prev => prev.some(a => a.id === appt.id) ? prev : [...prev, appt])

          const label = `${r.date} ${r.time}〜 の予約`
          setToast(label)

          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification('サロンつなぐ — 新着予約', {
              body: `新しい予約が入りました（${label}）`,
            })
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [session])

  // セッション未確定（初期ロード中）
  if (session === undefined) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', color: 'var(--gold)', fontSize: '1.1rem' }}>
        読み込み中...
      </div>
    )
  }

  // 未ログイン
  if (!session) return <LoginPage />

  const openModal = (type, data = null) => setModal({ type, data })

  const saveAppointment = async a => {
    const saved = await upsertAppointment(a)
    setAppointments(p => a.id ? p.map(x => x.id === saved.id ? saved : x) : [...p, saved])
    setModal(null)
  }
  const handleDeleteAppointment = async id => {
    await dbDeleteAppointment(id)
    setAppointments(p => p.filter(a => a.id !== id))
    setModal(null)
  }

  const confirmAppointment = async id => {
    const appt = appointments.find(a => a.id === id)
    if (!appt) return
    const saved = await upsertAppointment({ ...appt, status: 'confirmed' })
    setAppointments(p => p.map(a => a.id === saved.id ? saved : a))
  }

  const saveCustomer = async c => {
    const saved = await upsertCustomer(c)
    setCustomers(p => c.id ? p.map(x => x.id === saved.id ? saved : x) : [...p, saved])
    setModal(null)
  }
  const handleDeleteCustomer = async id => {
    await dbDeleteCustomer(id)
    setCustomers(p => p.filter(c => c.id !== id))
    setModal(null)
  }

  const saveMenu = async m => {
    const saved = await upsertMenu(m)
    setMenus(p => m.id ? p.map(x => x.id === saved.id ? saved : x) : [...p, saved])
    setModal(null)
  }
  const handleDeleteMenu = async id => {
    await dbDeleteMenu(id)
    setMenus(p => p.filter(m => m.id !== id))
    setModal(null)
  }

  const saveStaff = async s => {
    const saved = await upsertStaff(s)
    setStaff(p => s.id ? p.map(x => x.id === saved.id ? saved : x) : [...p, saved])
    setModal(null)
  }
  const handleDeleteStaff = async id => {
    await dbDeleteStaff(id)
    setStaff(p => p.filter(s => s.id !== id))
    setModal(null)
  }

  const shared = { appointments, customers, menus, staff, openModal }

  return (
    <div className="app">
      <Sidebar
        page={page} setPage={setPage} user={user} onSignOut={signOut}
        notifPerm={notifPerm} onRequestNotif={requestNotifPerm}
      />
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      <main className="main-content">
        {loading ? (
          <LoadingScreen />
        ) : error ? (
          <ErrorScreen message={error} onRetry={loadAll} />
        ) : (
          <>
            {page === 'dashboard' && <Dashboard {...shared} setPage={setPage} />}
            {page === 'calendar' && (
              <CalendarPage {...shared}
                calendarDate={calendarDate} setCalendarDate={setCalendarDate}
                calendarView={calendarView} setCalendarView={setCalendarView}
              />
            )}
            {page === 'appointments' && <AppointmentsPage {...shared} onConfirm={confirmAppointment} />}
            {page === 'customers' && <CustomersPage customers={customers} openModal={openModal} />}
            {page === 'menus' && <MenusPage menus={menus} openModal={openModal} />}
            {page === 'staff' && <StaffPage staff={staff} appointments={appointments} openModal={openModal} />}
          </>
        )}
      </main>
      {modal && (
        <Modal modal={modal} onClose={() => setModal(null)}
          appointments={appointments} customers={customers} menus={menus} staff={staff}
          saveAppointment={saveAppointment} deleteAppointment={handleDeleteAppointment}
          saveCustomer={saveCustomer} deleteCustomer={handleDeleteCustomer}
          saveMenu={saveMenu} deleteMenu={handleDeleteMenu}
          saveStaff={saveStaff} deleteStaff={handleDeleteStaff}
        />
      )}
    </div>
  )
}
