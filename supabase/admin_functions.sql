-- ============================================================
-- サロンつなぐ — 管理者用統計関数
-- Supabase ダッシュボード > SQL Editor に貼り付けて実行してください
-- ※ rls.sql を先に実行して salon_id カラムを追加してください
-- ============================================================

CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_email TEXT;
  result       JSON;
BEGIN
  -- 管理者のみ実行可能
  SELECT email INTO caller_email FROM auth.users WHERE id = auth.uid();
  IF caller_email IS DISTINCT FROM 'buo7064kazuya@gmail.com' THEN
    RAISE EXCEPTION 'Unauthorized: admin access only';
  END IF;

  SELECT json_build_object(
    -- 登録サロン数（auth.users の総数）
    'total_salons', (SELECT COUNT(*) FROM auth.users),

    -- 今月の予約数（全サロン合計）
    'monthly_appointments', (
      SELECT COUNT(*) FROM appointments
      WHERE date >= date_trunc('month', CURRENT_DATE)::date
        AND status != 'cancelled'
    ),

    -- 累計予約数
    'total_appointments', (
      SELECT COUNT(*) FROM appointments WHERE status != 'cancelled'
    ),

    -- 今月の売上合計
    'monthly_revenue', (
      SELECT COALESCE(SUM(m.price), 0)
      FROM appointments a
      JOIN menus m ON a.menu_id = m.id
      WHERE a.status = 'confirmed'
        AND a.date >= date_trunc('month', CURRENT_DATE)::date
    ),

    -- 累計売上合計
    'total_revenue', (
      SELECT COALESCE(SUM(m.price), 0)
      FROM appointments a
      JOIN menus m ON a.menu_id = m.id
      WHERE a.status = 'confirmed'
    ),

    -- サロンごとの利用状況
    'salons', (
      SELECT COALESCE(json_agg(s ORDER BY s.monthly_appointments DESC NULLS LAST), '[]'::json)
      FROM (
        SELECT
          u.id::text                           AS salon_id,
          u.email                              AS salon_email,
          u.created_at                         AS joined_at,
          (SELECT COUNT(*) FROM customers  c  WHERE c.salon_id  = u.id) AS customer_count,
          (SELECT COUNT(*) FROM staff      st WHERE st.salon_id = u.id) AS staff_count,
          (
            SELECT COUNT(*) FROM appointments a
            WHERE a.salon_id = u.id AND a.status != 'cancelled'
          ) AS total_appointments,
          (
            SELECT COUNT(*) FROM appointments a
            WHERE a.salon_id = u.id
              AND a.status != 'cancelled'
              AND a.date >= date_trunc('month', CURRENT_DATE)::date
          ) AS monthly_appointments,
          COALESCE((
            SELECT SUM(m.price) FROM appointments a
            JOIN menus m ON a.menu_id = m.id
            WHERE a.salon_id = u.id AND a.status = 'confirmed'
          ), 0) AS total_revenue,
          COALESCE((
            SELECT SUM(m.price) FROM appointments a
            JOIN menus m ON a.menu_id = m.id
            WHERE a.salon_id = u.id AND a.status = 'confirmed'
              AND a.date >= date_trunc('month', CURRENT_DATE)::date
          ), 0) AS monthly_revenue
        FROM auth.users u
      ) s
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- 認証済みユーザーに実行権限を付与（関数内で権限チェックを行うため安全）
GRANT EXECUTE ON FUNCTION get_admin_stats() TO authenticated;

-- ============================================================
-- サロンごとの顧客データ取得（管理者専用）
-- ============================================================

CREATE OR REPLACE FUNCTION get_salon_customers(p_salon_id UUID)
RETURNS TABLE(
  name          TEXT,
  appt_date     DATE,
  appt_time     TEXT,
  menu_name     TEXT,
  age_group     TEXT,
  customer_type TEXT,
  phone         TEXT,
  email         TEXT,
  notes         TEXT,
  visit_count   INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_email TEXT;
BEGIN
  SELECT au.email INTO caller_email FROM auth.users au WHERE au.id = auth.uid();
  IF caller_email IS DISTINCT FROM 'buo7064kazuya@gmail.com' THEN
    RAISE EXCEPTION 'Unauthorized: admin access only';
  END IF;

  RETURN QUERY
  SELECT
    c.name::TEXT,
    a.date::DATE                                                      AS appt_date,
    a.time::TEXT                                                      AS appt_time,
    COALESCE(m.name, '')::TEXT                                        AS menu_name,
    COALESCE(c.age_group, '')::TEXT                                   AS age_group,
    CASE WHEN c.visit_count <= 1 THEN '新規' ELSE '継続' END::TEXT   AS customer_type,
    COALESCE(c.phone, '')::TEXT,
    COALESCE(c.email, '')::TEXT,
    COALESCE(c.notes, '')::TEXT,
    c.visit_count::INT
  FROM appointments a
  JOIN customers c ON a.customer_id = c.id AND c.salon_id = p_salon_id
  LEFT JOIN menus m ON a.menu_id = m.id
  WHERE a.salon_id = p_salon_id
    AND a.status != 'cancelled'
  ORDER BY a.date DESC, a.time DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_salon_customers(UUID) TO authenticated;
