import { useState, useEffect } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'

const ADMIN_EMAIL = 'buo7064kazuya@gmail.com'
const fmtPrice = n => `¥${Number(n || 0).toLocaleString()}`
const fmtDate = s =>
  s ? new Date(s).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'

const AGE_GROUP_ORDER = ['10歳未満', '10代', '20代', '30代', '40代', '50代', '60代', '70代以上']
const AGE_GROUP_COLORS = [
  '#8B6F9E', '#5C8BCC', '#5CA89E', '#C9A96E',
  '#E0A85C', '#E05C5C', '#5CB85C', '#9E6F8B',
]

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

// ==================== AGE GROUP CHART (ADMIN) ====================
function AgeGroupChart({ salons }) {
  // 全サロンの顧客データから年代を集計（admin_stats に age_group_stats がある場合）
  const [ageCounts, setAgeCounts] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.rpc('get_age_group_stats').then(({ data, error }) => {
      if (!error && data) setAgeCounts(data)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '24px 0', textAlign: 'center' }}>
        読み込み中...
      </div>
    )
  }

  if (!ageCounts || ageCounts.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
        年代データがありません（顧客の生年月日を登録すると表示されます）
      </div>
    )
  }

  const countsMap = {}
  ageCounts.forEach(r => { countsMap[r.age_group] = Number(r.count) })

  const groups = AGE_GROUP_ORDER.filter(g => countsMap[g] > 0)
  const total = groups.reduce((s, g) => s + countsMap[g], 0)
  const max = Math.max(...groups.map(g => countsMap[g]))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {groups.map(g => {
        const color = AGE_GROUP_COLORS[AGE_GROUP_ORDER.indexOf(g)] || '#C9A96E'
        const count = countsMap[g]
        const pct = Math.round((count / total) * 100)
        const barW = Math.round((count / max) * 100)
        return (
          <div key={g} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '60px', fontSize: '12px', fontWeight: 600,
              color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0,
            }}>{g}</div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: '4px', height: '24px', overflow: 'hidden' }}>
              <div style={{
                width: `${barW}%`, height: '100%',
                background: `linear-gradient(90deg, ${color}cc, ${color})`,
                borderRadius: '4px',
                transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
                display: 'flex', alignItems: 'center', paddingLeft: '10px',
              }}>
                {barW > 20 && (
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#0F0E0D' }}>
                    {count}名
                  </span>
                )}
              </div>
            </div>
            <div style={{ width: '52px', fontSize: '12px', color, fontWeight: 700, textAlign: 'right', flexShrink: 0 }}>
              {barW <= 20 ? `${count}名` : `${pct}%`}
            </div>
          </div>
        )
      })}
      <div style={{
        marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)',
        textAlign: 'right', borderTop: '1px solid var(--border-light)', paddingTop: '8px',
      }}>
        年代登録済み顧客: 合計 {total}名
      </div>
    </div>
  )
}

// ==================== CSV EXPORT ====================
function buildCsv(rows) {
  const escape = v => {
    const s = v == null ? '' : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  const headers = ['名前', '予約日', '予約時間', 'メニュー', '料金', '年代', '新規/継続', '電話番号', 'メールアドレス', 'メモ', '来店回数']
  const lines = [headers, ...rows.map(r => [
    r.name, r.appt_date, r.appt_time, r.menu_name,
    r.menu_price != null ? r.menu_price : '',
    r.age_group, r.customer_type, r.phone, r.email, r.notes, r.visit_count,
  ])]
  return '﻿' + lines.map(r => r.map(escape).join(',')).join('\r\n')
}

function triggerDownload(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ==================== SALON SETTINGS EDIT ====================

const INPUT_STYLE = {
  background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-light)',
  borderRadius: '6px', padding: '7px 10px', color: 'var(--text)',
  fontSize: '13px', width: '100%', boxSizing: 'border-box',
}
const BTN = (variant = 'default') => ({
  border: 'none', borderRadius: '6px', padding: '6px 14px',
  fontSize: '12px', cursor: 'pointer', fontWeight: 600,
  ...(variant === 'primary'
    ? { background: 'rgba(201,169,110,0.15)', color: 'var(--gold)', border: '1px solid rgba(201,169,110,0.4)' }
    : variant === 'danger'
    ? { background: 'rgba(224,92,92,0.1)', color: '#E05C5C', border: '1px solid rgba(224,92,92,0.3)' }
    : { background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', border: '1px solid var(--border-light)' }),
})

const COLORS = ['#C9A96E', '#5C8BCC', '#5CA89E', '#E05C5C', '#5CB85C', '#8B6F9E', '#E0A85C', '#9E6F8B']

function MenuEditRow({ item, onSave, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: item.name, price: item.price, duration: item.duration, category: item.category })
  const [saving, setSaving] = useState(false)

  if (!editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ flex: 1, fontSize: '13px', color: 'var(--text)' }}>{item.name}</div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', width: '80px', textAlign: 'right' }}>¥{Number(item.price).toLocaleString()}</div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', width: '50px', textAlign: 'right' }}>{item.duration}分</div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', width: '80px' }}>{item.category}</div>
        <button onClick={() => setEditing(true)} style={BTN('primary')}>編集</button>
        <button onClick={() => onDelete(item.id)} style={BTN('danger')}>削除</button>
      </div>
    )
  }

  async function handleSave() {
    setSaving(true)
    await onSave(item.id, form)
    setSaving(false)
    setEditing(false)
  }

  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 70px 1fr', gap: '6px', marginBottom: '8px' }}>
        <input style={INPUT_STYLE} placeholder="メニュー名" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <input style={INPUT_STYLE} placeholder="料金" type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
        <input style={INPUT_STYLE} placeholder="分" type="number" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} />
        <input style={INPUT_STYLE} placeholder="カテゴリ" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <button onClick={handleSave} disabled={saving} style={BTN('primary')}>{saving ? '保存中...' : '保存'}</button>
        <button onClick={() => setEditing(false)} style={BTN()}>キャンセル</button>
      </div>
    </div>
  )
}

function StaffEditRow({ item, onSave, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: item.name, role: item.role, color: item.color })
  const [saving, setSaving] = useState(false)

  if (!editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: item.color, flexShrink: 0 }} />
        <div style={{ flex: 1, fontSize: '13px', color: 'var(--text)' }}>{item.name}</div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', width: '100px' }}>{item.role}</div>
        <button onClick={() => setEditing(true)} style={BTN('primary')}>編集</button>
        <button onClick={() => onDelete(item.id)} style={BTN('danger')}>削除</button>
      </div>
    )
  }

  async function handleSave() {
    setSaving(true)
    await onSave(item.id, form)
    setSaving(false)
    setEditing(false)
  }

  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
        <input style={INPUT_STYLE} placeholder="スタッフ名" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <input style={INPUT_STYLE} placeholder="役割（例：スタイリスト）" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
        {COLORS.map(c => (
          <div key={c} onClick={() => setForm(f => ({ ...f, color: c }))} style={{
            width: '22px', height: '22px', borderRadius: '50%', background: c, cursor: 'pointer',
            border: form.color === c ? '2px solid white' : '2px solid transparent',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <button onClick={handleSave} disabled={saving} style={BTN('primary')}>{saving ? '保存中...' : '保存'}</button>
        <button onClick={() => setEditing(false)} style={BTN()}>キャンセル</button>
      </div>
    </div>
  )
}

function AddMenuRow({ salonId, onAdded }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', price: '', duration: '60', category: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ ...BTN('primary'), marginTop: '10px' }}>
        + メニューを追加
      </button>
    )
  }

  async function handleAdd() {
    if (!form.name.trim()) { setErr('メニュー名を入力してください'); return }
    setSaving(true); setErr(null)
    try {
      const { error } = await supabase.rpc('admin_upsert_menu', {
        p_salon_id: salonId, p_menu_id: null,
        p_name: form.name, p_price: Number(form.price) || 0,
        p_duration: Number(form.duration) || 60, p_category: form.category,
      })
      if (error) throw error
      setForm({ name: '', price: '', duration: '60', category: '' })
      setOpen(false)
      onAdded()
    } catch (e) { setErr(e.message) }
    setSaving(false)
  }

  return (
    <div style={{ marginTop: '10px', padding: '12px', background: 'rgba(201,169,110,0.05)', borderRadius: '8px', border: '1px solid rgba(201,169,110,0.2)' }}>
      <div style={{ fontSize: '12px', color: 'var(--gold)', marginBottom: '8px', fontWeight: 600 }}>新規メニュー</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 70px 1fr', gap: '6px', marginBottom: '8px' }}>
        <input style={INPUT_STYLE} placeholder="メニュー名" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <input style={INPUT_STYLE} placeholder="料金" type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
        <input style={INPUT_STYLE} placeholder="分" type="number" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} />
        <input style={INPUT_STYLE} placeholder="カテゴリ" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
      </div>
      {err && <div style={{ fontSize: '11px', color: '#E05C5C', marginBottom: '6px' }}>{err}</div>}
      <div style={{ display: 'flex', gap: '6px' }}>
        <button onClick={handleAdd} disabled={saving} style={BTN('primary')}>{saving ? '追加中...' : '追加'}</button>
        <button onClick={() => setOpen(false)} style={BTN()}>キャンセル</button>
      </div>
    </div>
  )
}

function AddStaffRow({ salonId, onAdded }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', role: '', color: '#C9A96E' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ ...BTN('primary'), marginTop: '10px' }}>
        + スタッフを追加
      </button>
    )
  }

  async function handleAdd() {
    if (!form.name.trim()) { setErr('スタッフ名を入力してください'); return }
    setSaving(true); setErr(null)
    try {
      const { error } = await supabase.rpc('admin_upsert_staff', {
        p_salon_id: salonId, p_staff_id: null,
        p_name: form.name, p_role: form.role, p_color: form.color,
      })
      if (error) throw error
      setForm({ name: '', role: '', color: '#C9A96E' })
      setOpen(false)
      onAdded()
    } catch (e) { setErr(e.message) }
    setSaving(false)
  }

  return (
    <div style={{ marginTop: '10px', padding: '12px', background: 'rgba(201,169,110,0.05)', borderRadius: '8px', border: '1px solid rgba(201,169,110,0.2)' }}>
      <div style={{ fontSize: '12px', color: 'var(--gold)', marginBottom: '8px', fontWeight: 600 }}>新規スタッフ</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
        <input style={INPUT_STYLE} placeholder="スタッフ名" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <input style={INPUT_STYLE} placeholder="役割" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
        {COLORS.map(c => (
          <div key={c} onClick={() => setForm(f => ({ ...f, color: c }))} style={{
            width: '22px', height: '22px', borderRadius: '50%', background: c, cursor: 'pointer',
            border: form.color === c ? '2px solid white' : '2px solid transparent',
          }} />
        ))}
      </div>
      {err && <div style={{ fontSize: '11px', color: '#E05C5C', marginBottom: '6px' }}>{err}</div>}
      <div style={{ display: 'flex', gap: '6px' }}>
        <button onClick={handleAdd} disabled={saving} style={BTN('primary')}>{saving ? '追加中...' : '追加'}</button>
        <button onClick={() => setOpen(false)} style={BTN()}>キャンセル</button>
      </div>
    </div>
  )
}

function SalonEditPanel({ salonId, salonEmail, onClose }) {
  const [passphrase, setPassphrase] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verifyErr, setVerifyErr] = useState(null)

  const [menus, setMenus] = useState([])
  const [staffList, setStaffList] = useState([])
  const [dataLoading, setDataLoading] = useState(false)

  // あいことば設定
  const [showSetPass, setShowSetPass] = useState(false)
  const [newPass, setNewPass] = useState('')
  const [settingPass, setSettingPass] = useState(false)
  const [setPassMsg, setSetPassMsg] = useState(null)

  async function handleVerify() {
    if (!passphrase.trim()) { setVerifyErr('あいことばを入力してください'); return }
    setVerifying(true); setVerifyErr(null)
    try {
      const { data, error } = await supabase.rpc('admin_verify_passphrase', {
        p_salon_id: salonId, p_passphrase: passphrase,
      })
      if (error) throw error
      if (!data) { setVerifyErr('あいことばが違います'); setVerifying(false); return }
      setUnlocked(true)
      loadData()
    } catch (e) { setVerifyErr(e.message) }
    setVerifying(false)
  }

  async function loadData() {
    setDataLoading(true)
    const [{ data: m }, { data: s }] = await Promise.all([
      supabase.rpc('admin_get_salon_menus', { p_salon_id: salonId }),
      supabase.rpc('admin_get_salon_staff', { p_salon_id: salonId }),
    ])
    setMenus(m || [])
    setStaffList(s || [])
    setDataLoading(false)
  }

  async function handleSaveMenu(menuId, form) {
    await supabase.rpc('admin_upsert_menu', {
      p_salon_id: salonId, p_menu_id: menuId,
      p_name: form.name, p_price: Number(form.price),
      p_duration: Number(form.duration), p_category: form.category,
    })
    await loadData()
  }

  async function handleDeleteMenu(menuId) {
    if (!window.confirm('このメニューを削除しますか？')) return
    await supabase.rpc('admin_delete_menu', { p_salon_id: salonId, p_menu_id: menuId })
    await loadData()
  }

  async function handleSaveStaff(staffId, form) {
    await supabase.rpc('admin_upsert_staff', {
      p_salon_id: salonId, p_staff_id: staffId,
      p_name: form.name, p_role: form.role, p_color: form.color,
    })
    await loadData()
  }

  async function handleDeleteStaff(staffId) {
    if (!window.confirm('このスタッフを削除しますか？')) return
    await supabase.rpc('admin_delete_staff', { p_salon_id: salonId, p_staff_id: staffId })
    await loadData()
  }

  async function handleSetPassphrase() {
    if (!newPass.trim()) return
    setSettingPass(true); setSetPassMsg(null)
    const { error } = await supabase.rpc('admin_set_passphrase', {
      p_salon_id: salonId, p_passphrase: newPass,
    })
    if (error) setSetPassMsg({ ok: false, text: error.message })
    else setSetPassMsg({ ok: true, text: 'あいことばを設定しました' })
    setSettingPass(false)
    setNewPass('')
  }

  return (
    <div style={{
      background: 'rgba(15,14,13,0.97)', border: '1px solid var(--border-light)',
      borderRadius: '12px', padding: '24px', marginTop: '8px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>設定変更</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{salonEmail}</div>
        </div>
        <button onClick={onClose} style={{ ...BTN(), fontSize: '11px' }}>閉じる</button>
      </div>

      {/* あいことば入力 */}
      {!unlocked && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            あいことばを入力して設定変更を解除してください
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              style={{ ...INPUT_STYLE, flex: 1 }}
              type="password"
              placeholder="あいことば"
              value={passphrase}
              onChange={e => setPassphrase(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
            />
            <button onClick={handleVerify} disabled={verifying} style={BTN('primary')}>
              {verifying ? '確認中...' : '解除'}
            </button>
          </div>
          {verifyErr && <div style={{ fontSize: '11px', color: '#E05C5C', marginTop: '6px' }}>{verifyErr}</div>}
        </div>
      )}

      {/* あいことば設定（ロック状態でも表示） */}
      <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid var(--border-light)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', flex: 1 }}>
            {unlocked ? 'あいことばを変更する' : 'あいことばを新規設定する'}
          </div>
          <button onClick={() => setShowSetPass(v => !v)} style={{ ...BTN(), fontSize: '11px' }}>
            {showSetPass ? '閉じる' : 'あいことば設定'}
          </button>
        </div>
        {showSetPass && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <input
              style={{ ...INPUT_STYLE, flex: 1 }}
              type="text"
              placeholder="新しいあいことば"
              value={newPass}
              onChange={e => setNewPass(e.target.value)}
            />
            <button onClick={handleSetPassphrase} disabled={settingPass} style={BTN('primary')}>
              {settingPass ? '設定中...' : '設定'}
            </button>
          </div>
        )}
        {setPassMsg && (
          <div style={{ fontSize: '11px', color: setPassMsg.ok ? '#5CB85C' : '#E05C5C', marginTop: '6px' }}>
            {setPassMsg.text}
          </div>
        )}
      </div>

      {/* 編集エリア（解除後のみ） */}
      {unlocked && (
        <div>
          {dataLoading ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '20px 0' }}>読み込み中...</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              {/* メニュー */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gold)', marginBottom: '12px' }}>
                  メニュー ({menus.length})
                </div>
                {menus.length === 0 && (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', paddingBottom: '8px' }}>メニューがありません</div>
                )}
                {menus.map(m => (
                  <MenuEditRow key={m.id} item={m} onSave={handleSaveMenu} onDelete={handleDeleteMenu} />
                ))}
                <AddMenuRow salonId={salonId} onAdded={loadData} />
              </div>

              {/* スタッフ */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gold)', marginBottom: '12px' }}>
                  スタッフ ({staffList.length})
                </div>
                {staffList.length === 0 && (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', paddingBottom: '8px' }}>スタッフがいません</div>
                )}
                {staffList.map(s => (
                  <StaffEditRow key={s.id} item={s} onSave={handleSaveStaff} onDelete={handleDeleteStaff} />
                ))}
                <AddStaffRow salonId={salonId} onAdded={loadData} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ==================== SALON TABLE ====================
function SalonTable({ salons }) {
  const headers = ['サロン', '登録日', '顧客数', 'スタッフ数', '今月の予約', '今月の売上', '累計予約', '累計売上', '']

  if (!salons || salons.length === 0) {
    return (
      <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '48px 0', fontSize: '14px' }}>
        登録されているサロンがありません
      </p>
    )
  }

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
              {headers.map((h, i) => (
                <th key={i} style={{
                  textAlign: i < 2 ? 'left' : 'right',
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

      <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', letterSpacing: '0.04em' }}>
          顧客データ書き出し（CSV）
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {salons.map(s => <SalonExportButton key={s.salon_id} s={s} />)}
        </div>
      </div>
    </div>
  )
}

function SalonExportButton({ s }) {
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(null)

  async function handleExport() {
    setExporting(true)
    setExportError(null)
    try {
      const { data, error } = await supabase.rpc('get_salon_customers', { p_salon_id: s.salon_id })
      if (error) throw error
      if (!data || data.length === 0) {
        setExportError('予約データがありません')
        return
      }
      const date = new Date().toISOString().slice(0, 10)
      triggerDownload(buildCsv(data), `customers_${s.salon_email || s.salon_id}_${date}.csv`)
    } catch (err) {
      setExportError(err.message || 'エラーが発生しました')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <button
        onClick={handleExport}
        disabled={exporting}
        style={{
          background: 'transparent',
          border: '1px solid rgba(201,169,110,0.4)',
          color: 'var(--gold)',
          borderRadius: '6px', padding: '6px 14px',
          fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap',
          transition: 'background 0.15s',
        }}
      >
        {exporting ? '取得中...' : `${s.salon_email || s.salon_id} — CSV書き出し`}
      </button>
      {exportError && (
        <span style={{ fontSize: '11px', color: '#E05C5C' }}>{exportError}</span>
      )}
    </div>
  )
}

function SalonRow({ s }) {
  const [hover, setHover] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const initial = (s.salon_email?.[0] || '?').toUpperCase()

  return (
    <>
      <tr
        style={{ borderBottom: editOpen ? 'none' : '1px solid var(--border-light)', background: hover ? 'rgba(255,255,255,0.025)' : 'transparent', transition: 'background 0.15s' }}
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
        <td style={{ padding: '14px', textAlign: 'right' }}>
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setEditOpen(v => !v)}
              style={{
                background: editOpen ? 'rgba(201,169,110,0.15)' : 'transparent',
                border: `1px solid ${editOpen ? 'rgba(201,169,110,0.6)' : 'rgba(201,169,110,0.3)'}`,
                color: 'var(--gold)', borderRadius: '6px',
                padding: '4px 10px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {editOpen ? '▲ 設定' : '▼ 設定変更'}
            </button>
            <a
              href={`/admin/salon/${s.salon_id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--text-muted)', fontSize: '12px', textDecoration: 'none',
                border: '1px solid var(--border-light)', borderRadius: '6px',
                padding: '4px 10px', whiteSpace: 'nowrap',
              }}
            >
              詳細
            </a>
            <a
              href={`/book/${s.salon_id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--text-muted)', fontSize: '12px', textDecoration: 'none',
                border: '1px solid var(--border-light)', borderRadius: '6px',
                padding: '4px 10px', whiteSpace: 'nowrap',
              }}
            >
              予約
            </a>
          </div>
        </td>
      </tr>
      {editOpen && (
        <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
          <td colSpan={9} style={{ padding: '0 14px 14px' }}>
            <SalonEditPanel
              salonId={s.salon_id}
              salonEmail={s.salon_email}
              onClose={() => setEditOpen(false)}
            />
          </td>
        </tr>
      )}
    </>
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

      {/* 年代別顧客グラフ */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-light)',
        borderRadius: '16px', padding: '24px', marginBottom: '24px',
      }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', marginBottom: '20px', letterSpacing: '0.02em' }}>
          年代別顧客数（全サロン合計）
        </h2>
        <AgeGroupChart salons={stats.salons} />
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
          全サロンの登録状況・予約数・売上・年代分布を確認できます
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
