-- 管理者がサロンデータを閲覧するための RLS バイパス関数

CREATE OR REPLACE FUNCTION admin_get_staff(p_salon_id UUID)
RETURNS SETOF staff
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller_email TEXT;
BEGIN
  SELECT au.email INTO caller_email FROM auth.users au WHERE au.id = auth.uid();
  IF caller_email IS DISTINCT FROM 'buo7064kazuya@gmail.com' THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  RETURN QUERY SELECT * FROM staff WHERE salon_id = p_salon_id ORDER BY id;
END; $$;

CREATE OR REPLACE FUNCTION admin_get_menus(p_salon_id UUID)
RETURNS SETOF menus
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller_email TEXT;
BEGIN
  SELECT au.email INTO caller_email FROM auth.users au WHERE au.id = auth.uid();
  IF caller_email IS DISTINCT FROM 'buo7064kazuya@gmail.com' THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  RETURN QUERY SELECT * FROM menus WHERE salon_id = p_salon_id ORDER BY id;
END; $$;

CREATE OR REPLACE FUNCTION admin_get_customers(p_salon_id UUID)
RETURNS SETOF customers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller_email TEXT;
BEGIN
  SELECT au.email INTO caller_email FROM auth.users au WHERE au.id = auth.uid();
  IF caller_email IS DISTINCT FROM 'buo7064kazuya@gmail.com' THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  RETURN QUERY SELECT * FROM customers WHERE salon_id = p_salon_id ORDER BY id;
END; $$;

CREATE OR REPLACE FUNCTION admin_get_appointments(p_salon_id UUID)
RETURNS SETOF appointments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller_email TEXT;
BEGIN
  SELECT au.email INTO caller_email FROM auth.users au WHERE au.id = auth.uid();
  IF caller_email IS DISTINCT FROM 'buo7064kazuya@gmail.com' THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  RETURN QUERY SELECT * FROM appointments WHERE salon_id = p_salon_id ORDER BY date, time;
END; $$;

CREATE OR REPLACE FUNCTION admin_get_blocked_dates(p_salon_id UUID)
RETURNS SETOF blocked_dates
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller_email TEXT;
BEGIN
  SELECT au.email INTO caller_email FROM auth.users au WHERE au.id = auth.uid();
  IF caller_email IS DISTINCT FROM 'buo7064kazuya@gmail.com' THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  RETURN QUERY SELECT * FROM blocked_dates WHERE salon_id = p_salon_id ORDER BY date;
END; $$;

CREATE OR REPLACE FUNCTION admin_get_weekly_blocks(p_salon_id UUID)
RETURNS SETOF weekly_blocks
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller_email TEXT;
BEGIN
  SELECT au.email INTO caller_email FROM auth.users au WHERE au.id = auth.uid();
  IF caller_email IS DISTINCT FROM 'buo7064kazuya@gmail.com' THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  RETURN QUERY SELECT * FROM weekly_blocks WHERE salon_id = p_salon_id ORDER BY day_of_week, start_time;
END; $$;

GRANT EXECUTE ON FUNCTION admin_get_staff(UUID)         TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_menus(UUID)         TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_customers(UUID)     TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_appointments(UUID)  TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_blocked_dates(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_weekly_blocks(UUID) TO authenticated;
