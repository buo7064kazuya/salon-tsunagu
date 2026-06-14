import { supabase } from './supabase'

// snake_case (DB) <-> camelCase (app) 変換
const toAppAppointment = r => ({
  id: r.id,
  customerId: r.customer_id,
  staffId: r.staff_id,
  menuId: r.menu_id,
  date: r.date,
  time: r.time,
  duration: r.duration,
  notes: r.notes,
  status: r.status,
})

const toDbAppointment = a => ({
  customer_id: a.customerId,
  staff_id: a.staffId,
  menu_id: a.menuId,
  date: a.date,
  time: a.time,
  duration: a.duration,
  notes: a.notes,
  status: a.status,
})

const toAppCustomer = r => ({
  id: r.id,
  name: r.name,
  phone: r.phone,
  email: r.email,
  notes: r.notes,
  visitCount: r.visit_count,
})

const toDbCustomer = c => ({
  name: c.name,
  phone: c.phone,
  email: c.email,
  notes: c.notes,
  visit_count: c.visitCount,
})

// ==================== STAFF ====================
export async function fetchStaff() {
  const { data, error } = await supabase.from('staff').select('*').order('id')
  if (error) throw error
  return data
}

export async function upsertStaff(staff) {
  const row = { name: staff.name, role: staff.role, color: staff.color }
  if (staff.id) {
    const { data, error } = await supabase.from('staff').update(row).eq('id', staff.id).select().single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase.from('staff').insert(row).select().single()
    if (error) throw error
    return data
  }
}

export async function deleteStaff(id) {
  const { error } = await supabase.from('staff').delete().eq('id', id)
  if (error) throw error
}

// ==================== MENUS ====================
export async function fetchMenus() {
  const { data, error } = await supabase.from('menus').select('*').order('id')
  if (error) throw error
  return data
}

export async function upsertMenu(menu) {
  const row = { name: menu.name, price: menu.price, duration: menu.duration, category: menu.category }
  if (menu.id) {
    const { data, error } = await supabase.from('menus').update(row).eq('id', menu.id).select().single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase.from('menus').insert(row).select().single()
    if (error) throw error
    return data
  }
}

export async function deleteMenu(id) {
  const { error } = await supabase.from('menus').delete().eq('id', id)
  if (error) throw error
}

// ==================== CUSTOMERS ====================
export async function fetchCustomers() {
  const { data, error } = await supabase.from('customers').select('*').order('id')
  if (error) throw error
  return data.map(toAppCustomer)
}

export async function upsertCustomer(customer) {
  const row = toDbCustomer(customer)
  if (customer.id) {
    const { data, error } = await supabase.from('customers').update(row).eq('id', customer.id).select().single()
    if (error) throw error
    return toAppCustomer(data)
  } else {
    const { data, error } = await supabase.from('customers').insert(row).select().single()
    if (error) throw error
    return toAppCustomer(data)
  }
}

export async function deleteCustomer(id) {
  const { error } = await supabase.from('customers').delete().eq('id', id)
  if (error) throw error
}

// ==================== APPOINTMENTS ====================
export async function fetchAppointments() {
  const { data, error } = await supabase.from('appointments').select('*').order('date').order('time')
  if (error) throw error
  return data.map(toAppAppointment)
}

export async function upsertAppointment(appointment) {
  const row = toDbAppointment(appointment)
  if (appointment.id) {
    const { data, error } = await supabase.from('appointments').update(row).eq('id', appointment.id).select().single()
    if (error) throw error
    return toAppAppointment(data)
  } else {
    const { data, error } = await supabase.from('appointments').insert(row).select().single()
    if (error) throw error
    return toAppAppointment(data)
  }
}

export async function deleteAppointment(id) {
  const { error } = await supabase.from('appointments').delete().eq('id', id)
  if (error) throw error
}
