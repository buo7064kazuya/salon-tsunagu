-- ============================================================
-- サロンつなぐ — サロン設定管理（管理者用）
-- Supabase ダッシュボード > SQL Editor に貼り付けて実行してください
-- ============================================================

-- 1. salon_settings テーブル（あいことば管理）
CREATE TABLE IF NOT EXISTS salon_settings (
  salon_id   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  passphrase TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE salon_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "salon_settings_owner" ON salon_settings;
CREATE POLICY "salon_settings_owner" ON salon_settings
  USING (salon_id = auth.uid())
  WITH CHECK (salon_id = auth.uid());

-- ============================================================
-- 2. あいことば検証（管理者のみ）
-- ============================================================
CREATE OR REPLACE FUNCTION admin_verify_passphrase(p_salon_id UUID, p_passphrase TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_email TEXT;
  stored_pass  TEXT;
BEGIN
  SELECT email INTO caller_email FROM auth.users WHERE id = auth.uid();
  IF caller_email IS DISTINCT FROM 'buo7064kazuya@gmail.com' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT passphrase INTO stored_pass FROM salon_settings WHERE salon_id = p_salon_id;
  IF stored_pass IS NULL THEN RETURN FALSE; END IF;
  RETURN stored_pass = p_passphrase;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_verify_passphrase(UUID, TEXT) TO authenticated;

-- ============================================================
-- 3. あいことばを設定（管理者のみ）
-- ============================================================
CREATE OR REPLACE FUNCTION admin_set_passphrase(p_salon_id UUID, p_passphrase TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_email TEXT;
BEGIN
  SELECT email INTO caller_email FROM auth.users WHERE id = auth.uid();
  IF caller_email IS DISTINCT FROM 'buo7064kazuya@gmail.com' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO salon_settings (salon_id, passphrase, updated_at)
  VALUES (p_salon_id, p_passphrase, NOW())
  ON CONFLICT (salon_id)
  DO UPDATE SET passphrase = EXCLUDED.passphrase, updated_at = NOW();
END;
$$;
GRANT EXECUTE ON FUNCTION admin_set_passphrase(UUID, TEXT) TO authenticated;

-- ============================================================
-- 4. サロンのメニュー取得（管理者のみ）
-- ============================================================
CREATE OR REPLACE FUNCTION admin_get_salon_menus(p_salon_id UUID)
RETURNS TABLE(id BIGINT, name TEXT, price INTEGER, duration INTEGER, category TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_email TEXT;
BEGIN
  SELECT email INTO caller_email FROM auth.users WHERE id = auth.uid();
  IF caller_email IS DISTINCT FROM 'buo7064kazuya@gmail.com' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT m.id::BIGINT, m.name::TEXT, m.price::INTEGER, m.duration::INTEGER,
         COALESCE(m.category, '')::TEXT
  FROM menus m
  WHERE m.salon_id = p_salon_id
  ORDER BY m.category, m.id;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_get_salon_menus(UUID) TO authenticated;

-- ============================================================
-- 5. サロンのスタッフ取得（管理者のみ）
-- ============================================================
CREATE OR REPLACE FUNCTION admin_get_salon_staff(p_salon_id UUID)
RETURNS TABLE(id BIGINT, name TEXT, role TEXT, color TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_email TEXT;
BEGIN
  SELECT email INTO caller_email FROM auth.users WHERE id = auth.uid();
  IF caller_email IS DISTINCT FROM 'buo7064kazuya@gmail.com' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT s.id::BIGINT, s.name::TEXT,
         COALESCE(s.role, '')::TEXT, COALESCE(s.color, '#C9A96E')::TEXT
  FROM staff s
  WHERE s.salon_id = p_salon_id
  ORDER BY s.id;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_get_salon_staff(UUID) TO authenticated;

-- ============================================================
-- 6. メニューの追加・更新（管理者のみ）
-- ============================================================
CREATE OR REPLACE FUNCTION admin_upsert_menu(
  p_salon_id UUID,
  p_menu_id  BIGINT,  -- NULL なら INSERT
  p_name     TEXT,
  p_price    INTEGER,
  p_duration INTEGER,
  p_category TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_email TEXT;
  result_id    BIGINT;
BEGIN
  SELECT email INTO caller_email FROM auth.users WHERE id = auth.uid();
  IF caller_email IS DISTINCT FROM 'buo7064kazuya@gmail.com' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_menu_id IS NULL THEN
    INSERT INTO menus (salon_id, name, price, duration, category)
    VALUES (p_salon_id, p_name, p_price, p_duration, p_category)
    RETURNING id INTO result_id;
  ELSE
    UPDATE menus
    SET name = p_name, price = p_price, duration = p_duration, category = p_category
    WHERE id = p_menu_id AND salon_id = p_salon_id;
    result_id := p_menu_id;
  END IF;

  RETURN result_id;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_upsert_menu(UUID, BIGINT, TEXT, INTEGER, INTEGER, TEXT) TO authenticated;

-- ============================================================
-- 7. メニュー削除（管理者のみ）
-- ============================================================
CREATE OR REPLACE FUNCTION admin_delete_menu(p_salon_id UUID, p_menu_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_email TEXT;
BEGIN
  SELECT email INTO caller_email FROM auth.users WHERE id = auth.uid();
  IF caller_email IS DISTINCT FROM 'buo7064kazuya@gmail.com' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM menus WHERE id = p_menu_id AND salon_id = p_salon_id;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_delete_menu(UUID, BIGINT) TO authenticated;

-- ============================================================
-- 8. スタッフの追加・更新（管理者のみ）
-- ============================================================
CREATE OR REPLACE FUNCTION admin_upsert_staff(
  p_salon_id UUID,
  p_staff_id BIGINT,  -- NULL なら INSERT
  p_name     TEXT,
  p_role     TEXT,
  p_color    TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_email TEXT;
  result_id    BIGINT;
BEGIN
  SELECT email INTO caller_email FROM auth.users WHERE id = auth.uid();
  IF caller_email IS DISTINCT FROM 'buo7064kazuya@gmail.com' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_staff_id IS NULL THEN
    INSERT INTO staff (salon_id, name, role, color)
    VALUES (p_salon_id, p_name, p_role, p_color)
    RETURNING id INTO result_id;
  ELSE
    UPDATE staff
    SET name = p_name, role = p_role, color = p_color
    WHERE id = p_staff_id AND salon_id = p_salon_id;
    result_id := p_staff_id;
  END IF;

  RETURN result_id;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_upsert_staff(UUID, BIGINT, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================
-- 9. スタッフ削除（管理者のみ）
-- ============================================================
CREATE OR REPLACE FUNCTION admin_delete_staff(p_salon_id UUID, p_staff_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_email TEXT;
BEGIN
  SELECT email INTO caller_email FROM auth.users WHERE id = auth.uid();
  IF caller_email IS DISTINCT FROM 'buo7064kazuya@gmail.com' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM staff WHERE id = p_staff_id AND salon_id = p_salon_id;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_delete_staff(UUID, BIGINT) TO authenticated;
