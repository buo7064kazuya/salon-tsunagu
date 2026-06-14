import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// ===== HELPERS =====
const pad = n => String(n).padStart(2, '0')
const fmtPrice = n => `¥${Number(n).toLocaleString()}`

function getTodayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function timeToMins(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function fmtDateLabel(ds) {
  if (!ds) return ''
  const [y, m, d] = ds.split('-')
  return `${y}年${parseInt(m)}月${parseInt(d)}日`
}

function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate() }
function getFirstDOW(y, m) { return new Date(y, m, 1).getDay() }

const DAYS_JP = ['日', '月', '火', '水', '木', '金', '土']
const MONTHS_JP = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

const SLOT_START_H = 9
const SLOT_END_H = 19
const SLOT_INTERVAL = 30

function generateSlots(duration) {
  const slots = []
  const endMins = SLOT_END_H * 60 - duration
  for (let m = SLOT_START_H * 60; m <= endMins; m += SLOT_INTERVAL) {
    slots.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`)
  }
  return slots
}

function getAvailableStaffIds(slot, duration, appointments, allStaffIds) {
  const slotStart = timeToMins(slot)
  const slotEnd = slotStart + duration
  return allStaffIds.filter(sid => {
    return !appointments
      .filter(a => a.staffId === sid)
      .some(a => {
        const aStart = timeToMins(a.time)
        const aEnd = aStart + Number(a.duration)
        return slotStart < aEnd && slotEnd > aStart
      })
  })
}

// ===== PUBLIC DB (anon key — requires Supabase RLS policies) =====
async function fetchPublicMenus() {
  const { data, error } = await supabase
    .from('menus').select('*').order('category').order('id')
  if (error) throw error
  return data
}

async function fetchPublicStaff() {
  const { data, error } = await supabase
    .from('staff').select('id, name, role, color').order('id')
  if (error) throw error
  return data
}

async function fetchPublicAppointmentsByDate(date) {
  const { data, error } = await supabase
    .from('appointments')
    .select('staff_id, time, duration')
    .eq('date', date)
    .neq('status', 'cancelled')
  if (error) throw error
  return data.map(r => ({
    staffId: r.staff_id,
    time: r.time,
    duration: Number(r.duration),
  }))
}

async function createPublicBooking({ name, phone, notes, menuId, staffId, date, time, duration }) {
  const { data: customer, error: ce } = await supabase
    .from('customers')
    .insert({ name, phone, email: '', notes: notes || '', visit_count: 0 })
    .select('id')
    .single()
  if (ce) throw ce

  const { data: appt, error: ae } = await supabase
    .from('appointments')
    .insert({
      customer_id: customer.id,
      staff_id: staffId,
      menu_id: menuId,
      date, time, duration,
      notes: notes || '',
      status: 'pending',
    })
    .select('id')
    .single()
  if (ae) throw ae

  return appt
}

// ===== PROGRESS BAR =====
const STEP_LABELS = ['メニュー', '日時', 'お客様情報']
const STEP_KEYS = ['menu', 'datetime', 'contact']

function StepBar({ step }) {
  const idx = STEP_KEYS.indexOf(step)
  return (
    <div style={s.stepBar}>
      {STEP_LABELS.map((label, i) => (
        <div key={i} style={s.stepItem}>
          <div style={{ ...s.stepDot, ...(i <= idx ? s.stepDotActive : {}) }}>
            {i < idx ? '✓' : i + 1}
          </div>
          <span style={{ ...s.stepLabel, color: i <= idx ? 'var(--gold)' : 'var(--text-muted)' }}>
            {label}
          </span>
          {i < STEP_LABELS.length - 1 && (
            <div style={{ ...s.stepLine, background: i < idx ? 'var(--gold)' : 'var(--border)' }} />
          )}
        </div>
      ))}
    </div>
  )
}

// ===== STEP 1: MENU =====
function MenuStep({ menus, selected, onSelect, onNext }) {
  const categories = [...new Set(menus.map(m => m.category))]
  return (
    <>
      <h2 style={s.stepTitle}>メニューをお選びください</h2>
      {categories.map(cat => (
        <div key={cat} style={{ marginBottom: '22px' }}>
          <div style={s.catLabel}>{cat}</div>
          <div style={s.menuGrid}>
            {menus.filter(m => m.category === cat).map(m => (
              <button
                key={m.id}
                style={{ ...s.menuCard, ...(selected?.id === m.id ? s.menuCardSel : {}) }}
                onClick={() => onSelect(m)}
              >
                {selected?.id === m.id && <span style={s.menuCheck}>✓</span>}
                <div style={s.menuName}>{m.name}</div>
                <div style={s.menuPrice}>{fmtPrice(m.price)}</div>
                <div style={s.menuDur}>{m.duration}分</div>
              </button>
            ))}
          </div>
        </div>
      ))}
      <div style={s.navRow}>
        <div />
        <button
          style={{ ...s.btnPrimary, ...(!selected ? s.btnOff : {}) }}
          disabled={!selected}
          onClick={onNext}
        >
          次へ →
        </button>
      </div>
    </>
  )
}

// ===== STEP 2: DATE + TIME =====
function DateTimeStep({ menu, staff, selectedDate, setSelectedDate, selectedTime, setSelectedTime, calDate, setCalDate, onBack, onNext }) {
  const [appointments, setAppointments] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const TODAY = getTodayStr()
  const y = calDate.getFullYear()
  const mo = calDate.getMonth()
  const days = getDaysInMonth(y, mo)
  const firstDOW = getFirstDOW(y, mo)
  const cells = [...Array(firstDOW).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]

  useEffect(() => {
    if (!selectedDate) return
    setLoadingSlots(true)
    setSelectedTime(null)
    fetchPublicAppointmentsByDate(selectedDate)
      .then(setAppointments)
      .catch(console.error)
      .finally(() => setLoadingSlots(false))
  }, [selectedDate])

  const slots = useMemo(() => generateSlots(menu.duration), [menu.duration])
  const staffIds = useMemo(() => staff.map(st => st.id), [staff])

  const availMap = useMemo(() => {
    const map = {}
    slots.forEach(slot => {
      map[slot] = getAvailableStaffIds(slot, menu.duration, appointments, staffIds)
    })
    return map
  }, [slots, menu.duration, appointments, staffIds])

  return (
    <>
      <h2 style={s.stepTitle}>ご希望の日時をお選びください</h2>

      {/* Calendar */}
      <div style={s.calBox}>
        <div style={s.calNav}>
          <button style={s.iconBtn} onClick={() => setCalDate(new Date(y, mo - 1, 1))}>‹</button>
          <span style={s.calNavTitle}>{y}年 {MONTHS_JP[mo]}</span>
          <button style={s.iconBtn} onClick={() => setCalDate(new Date(y, mo + 1, 1))}>›</button>
        </div>
        <div style={s.dowRow}>
          {DAYS_JP.map((d, i) => (
            <div key={d} style={{ ...s.dowCell, color: i === 0 ? '#E05C5C' : i === 6 ? '#5C8BCC' : 'var(--text-muted)' }}>
              {d}
            </div>
          ))}
        </div>
        <div style={s.calGrid}>
          {cells.map((day, i) => {
            if (!day) return <div key={`e${i}`} />
            const ds = `${y}-${pad(mo + 1)}-${pad(day)}`
            const past = ds < TODAY
            const isSelected = ds === selectedDate
            const isToday = ds === TODAY
            const dow = (firstDOW + day - 1) % 7
            return (
              <button
                key={day}
                disabled={past}
                style={{
                  ...s.calDay,
                  ...(past ? s.calDayPast : {}),
                  ...(isToday && !isSelected ? s.calDayToday : {}),
                  ...(isSelected ? s.calDaySelected : {}),
                  color: isSelected
                    ? '#0F0E0D'
                    : past ? 'var(--border)'
                    : dow === 0 ? '#E05C5C'
                    : dow === 6 ? '#5C8BCC'
                    : 'var(--text)',
                }}
                onClick={() => setSelectedDate(ds)}
              >
                {day}
              </button>
            )
          })}
        </div>
      </div>

      {/* Time Slots */}
      {selectedDate && (
        <div style={{ marginTop: '20px' }}>
          <div style={s.slotTitle}>{fmtDateLabel(selectedDate)} の空き時間</div>
          {loadingSlots ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '8px 0' }}>読み込み中...</div>
          ) : slots.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              このメニューは対応可能な時間帯がありません。
            </div>
          ) : (
            <div style={s.slotsGrid}>
              {slots.map(slot => {
                const avail = availMap[slot]?.length > 0
                const isSel = slot === selectedTime
                return (
                  <button
                    key={slot}
                    disabled={!avail}
                    style={{
                      ...s.slotBtn,
                      ...(isSel ? s.slotBtnSel : {}),
                      ...(!avail ? s.slotBtnOff : {}),
                    }}
                    onClick={() => setSelectedTime(slot)}
                  >
                    {slot}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div style={s.navRow}>
        <button style={s.btnSecondary} onClick={onBack}>← 戻る</button>
        <button
          style={{ ...s.btnPrimary, ...(!(selectedDate && selectedTime) ? s.btnOff : {}) }}
          disabled={!selectedDate || !selectedTime}
          onClick={onNext}
        >
          次へ →
        </button>
      </div>
    </>
  )
}

// ===== STEP 3: CONTACT =====
function ContactStep({ menu, selectedDate, selectedTime, onBack, onSubmit, submitting }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState(null)

  const handleSubmit = async () => {
    setError(null)
    try {
      await onSubmit({ name, phone, notes })
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <>
      <h2 style={s.stepTitle}>お客様情報を入力してください</h2>

      <div style={s.summaryBox}>
        <div style={s.summaryRow}>
          <span style={s.summaryLabel}>メニュー</span>
          <span style={s.summaryValue}>{menu?.name}（{fmtPrice(menu?.price)} · {menu?.duration}分）</span>
        </div>
        <div style={{ ...s.summaryRow, marginBottom: 0 }}>
          <span style={s.summaryLabel}>日時</span>
          <span style={s.summaryValue}>{fmtDateLabel(selectedDate)}　{selectedTime}</span>
        </div>
      </div>

      {error && <div style={s.errorBox}>{error}</div>}

      <div style={s.field}>
        <label style={s.fieldLabel}>お名前 <span style={{ color: 'var(--danger)' }}>*</span></label>
        <input
          style={s.input}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="例: 山田 花子"
        />
      </div>
      <div style={s.field}>
        <label style={s.fieldLabel}>電話番号 <span style={{ color: 'var(--danger)' }}>*</span></label>
        <input
          type="tel"
          style={s.input}
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="090-0000-0000"
        />
      </div>
      <div style={s.field}>
        <label style={s.fieldLabel}>ご要望・メモ（任意）</label>
        <textarea
          style={{ ...s.input, minHeight: '80px', resize: 'vertical' }}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="アレルギーやご希望などがあればご記入ください"
        />
      </div>

      <div style={s.navRow}>
        <button style={s.btnSecondary} onClick={onBack} disabled={submitting}>← 戻る</button>
        <button
          style={{ ...s.btnPrimary, ...(!name || !phone || submitting ? s.btnOff : {}) }}
          disabled={!name || !phone || submitting}
          onClick={handleSubmit}
        >
          {submitting ? '送信中...' : '予約を確定する'}
        </button>
      </div>
    </>
  )
}

// ===== DONE =====
function DoneStep({ menu, selectedDate, selectedTime, onReset }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 0' }}>
      <div style={s.doneIcon}>✓</div>
      <h2 style={s.doneTitle}>ご予約が完了しました</h2>
      <p style={s.doneSub}>スタッフより確認のご連絡をいたします。</p>

      <div style={{ ...s.summaryBox, textAlign: 'left', marginBottom: '28px' }}>
        <div style={s.summaryRow}>
          <span style={s.summaryLabel}>メニュー</span>
          <span style={s.summaryValue}>{menu?.name}</span>
        </div>
        <div style={s.summaryRow}>
          <span style={s.summaryLabel}>日時</span>
          <span style={s.summaryValue}>{fmtDateLabel(selectedDate)}　{selectedTime}</span>
        </div>
        <div style={{ ...s.summaryRow, marginBottom: 0 }}>
          <span style={s.summaryLabel}>ステータス</span>
          <span style={{ ...s.summaryValue, color: 'var(--gold)' }}>仮予約（確認待ち）</span>
        </div>
      </div>

      <button style={s.btnSecondary} onClick={onReset}>別の予約をする</button>
    </div>
  )
}

// ===== ROOT =====
export default function BookingPage() {
  useParams() // salonId は将来のマルチサロン対応時に使用

  const [step, setStep] = useState('menu')
  const [menus, setMenus] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [selectedMenu, setSelectedMenu] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedTime, setSelectedTime] = useState(null)
  const [calDate, setCalDate] = useState(new Date())
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([fetchPublicMenus(), fetchPublicStaff()])
      .then(([m, st]) => { setMenus(m); setStaff(st) })
      .catch(e => setLoadError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = async ({ name, phone, notes }) => {
    setSubmitting(true)
    try {
      const appointments = await fetchPublicAppointmentsByDate(selectedDate)
      const staffIds = staff.map(st => st.id)
      const available = getAvailableStaffIds(selectedTime, selectedMenu.duration, appointments, staffIds)
      const staffId = available.length > 0 ? available[0] : (staff[0]?.id ?? null)

      await createPublicBooking({
        name, phone, notes,
        menuId: selectedMenu.id,
        staffId,
        date: selectedDate,
        time: selectedTime,
        duration: selectedMenu.duration,
      })
      setStep('done')
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setStep('menu')
    setSelectedMenu(null)
    setSelectedDate(null)
    setSelectedTime(null)
    setCalDate(new Date())
  }

  if (loading) {
    return (
      <div style={s.page}>
        <div style={{ ...s.container, paddingTop: '80px', textAlign: 'center', color: 'var(--gold)' }}>
          読み込み中...
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div style={s.page}>
        <div style={{ ...s.container, paddingTop: '80px', textAlign: 'center' }}>
          <div style={{ color: 'var(--danger)', fontSize: '14px', lineHeight: 1.7 }}>
            データの読み込みに失敗しました。<br />
            しばらく時間をおいてからアクセスしてください。
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={s.page}>
      <div style={s.container}>
        <div style={s.header}>
          <div style={s.logoIcon}>✦</div>
          <div style={s.logoName}>サロンつなぐ</div>
          <div style={s.logoSub}>ご予約フォーム</div>
        </div>

        {step !== 'done' && <StepBar step={step} />}

        <div style={s.card}>
          {step === 'menu' && (
            <MenuStep
              menus={menus}
              selected={selectedMenu}
              onSelect={setSelectedMenu}
              onNext={() => setStep('datetime')}
            />
          )}
          {step === 'datetime' && (
            <DateTimeStep
              menu={selectedMenu}
              staff={staff}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              selectedTime={selectedTime}
              setSelectedTime={setSelectedTime}
              calDate={calDate}
              setCalDate={setCalDate}
              onBack={() => setStep('menu')}
              onNext={() => setStep('contact')}
            />
          )}
          {step === 'contact' && (
            <ContactStep
              menu={selectedMenu}
              selectedDate={selectedDate}
              selectedTime={selectedTime}
              onBack={() => setStep('datetime')}
              onSubmit={handleSubmit}
              submitting={submitting}
            />
          )}
          {step === 'done' && (
            <DoneStep
              menu={selectedMenu}
              selectedDate={selectedDate}
              selectedTime={selectedTime}
              onReset={reset}
            />
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
    maxWidth: '560px',
    margin: '0 auto',
  },
  header: {
    textAlign: 'center',
    marginBottom: '28px',
  },
  logoIcon: { fontSize: '28px', color: 'var(--gold)', marginBottom: '6px' },
  logoName: { fontSize: '22px', fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.08em' },
  logoSub: { fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.12em', marginTop: '3px' },

  // Step bar
  stepBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '20px',
  },
  stepItem: { display: 'flex', alignItems: 'center', gap: '6px' },
  stepDot: {
    width: '28px', height: '28px', borderRadius: '50%',
    border: '2px solid var(--border)', background: 'var(--bg-card)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0,
  },
  stepDotActive: { border: '2px solid var(--gold)', color: 'var(--gold)', background: 'var(--gold-dim)' },
  stepLabel: { fontSize: '11px', whiteSpace: 'nowrap' },
  stepLine: { width: '28px', height: '2px', margin: '0 4px', flexShrink: 0 },

  // Card
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '28px 24px',
  },
  stepTitle: { fontSize: '16px', fontWeight: 700, color: 'var(--text)', marginBottom: '20px' },

  // Menu grid
  catLabel: {
    fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)',
    letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px',
  },
  menuGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' },
  menuCard: {
    background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '10px',
    padding: '14px 12px', textAlign: 'left', cursor: 'pointer', position: 'relative',
    transition: 'border-color 0.15s',
  },
  menuCardSel: { border: '1.5px solid var(--gold)', background: 'var(--gold-dim)' },
  menuCheck: { position: 'absolute', top: '8px', right: '10px', color: 'var(--gold)', fontSize: '13px', fontWeight: 700 },
  menuName: { fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' },
  menuPrice: { fontSize: '15px', fontWeight: 700, color: 'var(--gold)', marginBottom: '2px' },
  menuDur: { fontSize: '11px', color: 'var(--text-muted)' },

  // Calendar
  calBox: {
    background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: '10px', padding: '16px',
  },
  calNav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' },
  calNavTitle: { fontSize: '14px', fontWeight: 700, color: 'var(--text)' },
  iconBtn: {
    background: 'none', border: '1px solid var(--border-light)',
    color: 'var(--text-muted)', borderRadius: '6px',
    width: '30px', height: '30px', fontSize: '17px', cursor: 'pointer', lineHeight: 1,
  },
  dowRow: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '4px' },
  dowCell: { textAlign: 'center', fontSize: '11px', fontWeight: 600, padding: '4px 0' },
  calGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' },
  calDay: {
    background: 'none', border: 'none', borderRadius: '6px',
    padding: '7px 2px', fontSize: '13px', textAlign: 'center',
    cursor: 'pointer', transition: 'background 0.1s',
  },
  calDayPast: { cursor: 'not-allowed' },
  calDayToday: { border: '1px solid var(--gold)', color: 'var(--gold)' },
  calDaySelected: { background: 'var(--gold)', fontWeight: 700 },

  // Slots
  slotTitle: { fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '10px' },
  slotsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: '8px' },
  slotBtn: {
    background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '8px 4px', fontSize: '13px',
    color: 'var(--text)', cursor: 'pointer', textAlign: 'center',
    transition: 'border-color 0.1s, background 0.1s',
  },
  slotBtnSel: { background: 'var(--gold)', border: '1px solid var(--gold)', color: '#0F0E0D', fontWeight: 700 },
  slotBtnOff: { color: 'var(--border)', cursor: 'not-allowed', textDecoration: 'line-through' },

  // Summary
  summaryBox: {
    background: 'rgba(201,169,110,0.06)', border: '1px solid rgba(201,169,110,0.2)',
    borderRadius: '10px', padding: '14px 16px', marginBottom: '20px',
  },
  summaryRow: { display: 'flex', gap: '12px', marginBottom: '6px' },
  summaryLabel: { fontSize: '12px', color: 'var(--text-muted)', minWidth: '52px', flexShrink: 0 },
  summaryValue: { fontSize: '13px', color: 'var(--text)', fontWeight: 500 },

  // Contact form
  field: { marginBottom: '16px' },
  fieldLabel: {
    display: 'block', fontSize: '12px', fontWeight: 600,
    color: 'var(--text-muted)', marginBottom: '6px', letterSpacing: '0.04em',
  },
  input: {
    display: 'block', width: '100%',
    background: 'var(--bg-input)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '9px 12px',
    color: 'var(--text)', fontSize: '14px', outline: 'none',
  },

  // Nav
  navRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)',
  },
  btnPrimary: {
    background: 'var(--gold)', border: 'none', borderRadius: '8px',
    color: '#0F0E0D', fontSize: '14px', fontWeight: 700,
    padding: '10px 24px', cursor: 'pointer',
  },
  btnSecondary: {
    background: 'none', border: '1px solid var(--border-light)',
    borderRadius: '8px', color: 'var(--text-muted)',
    fontSize: '13px', padding: '9px 18px', cursor: 'pointer',
  },
  btnOff: { opacity: 0.4, cursor: 'not-allowed' },

  // Done
  doneIcon: {
    width: '60px', height: '60px', borderRadius: '50%',
    background: 'rgba(92,184,92,0.12)', border: '2px solid #5CB85C',
    color: '#5CB85C', fontSize: '24px', lineHeight: '60px',
    margin: '0 auto 16px',
  },
  doneTitle: { fontSize: '18px', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' },
  doneSub: { fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.6 },

  // Error
  errorBox: {
    background: 'rgba(224,92,92,0.1)', border: '1px solid rgba(224,92,92,0.3)',
    color: '#E05C5C', padding: '10px 14px', borderRadius: '8px',
    fontSize: '13px', marginBottom: '16px', lineHeight: 1.5,
  },
}
