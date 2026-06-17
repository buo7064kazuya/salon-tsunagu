-- ============================================================
-- サロンつなぐ — 公開予約機能用 RLS ポリシーと RPC 関数
-- rls.sql を実行した後にこのファイルを実行してください
-- Supabase ダッシュボード > SQL Editor に貼り付けて実行
-- ============================================================

-- ==============================
-- 1. PUBLIC READ POLICIES
-- ==============================

-- メニュー: 予約ページから誰でも読み取り可（公開情報）
DROP POLICY IF EXISTS "menus_public_read" ON menus;
CREATE POLICY "menus_public_read" ON menus
  FOR SELECT USING (true);

-- スタッフ: 予約ページから誰でも読み取り可（公開情報）
DROP POLICY IF EXISTS "staff_public_read" ON staff;
CREATE POLICY "staff_public_read" ON staff
  FOR SELECT USING (true);

-- 予約: 空き枠確認のために読み取り可（JS側で salon_id + 必要な列のみ取得）
DROP POLICY IF EXISTS "appointments_public_read" ON appointments;
CREATE POLICY "appointments_public_read" ON appointments
  FOR SELECT USING (true);

-- 定期ブロック: 予約ページから読み取り可
DROP POLICY IF EXISTS "weekly_blocks_public_read" ON weekly_blocks;
CREATE POLICY "weekly_blocks_public_read" ON weekly_blocks
  FOR SELECT USING (true);

-- ==============================
-- 2. 年代計算ヘルパー関数
-- ==============================

CREATE OR REPLACE FUNCTION calc_age_group(p_birthdate DATE)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  v_age INTEGER;
BEGIN
  IF p_birthdate IS NULL THEN RETURN NULL; END IF;
  v_age := EXTRACT(YEAR FROM age(CURRENT_DATE, p_birthdate))::INTEGER;
  IF v_age < 0 OR v_age > 120 THEN RETURN NULL; END IF;
  IF v_age < 10 THEN RETURN '10歳未満'; END IF;
  IF v_age >= 70 THEN RETURN '70代以上'; END IF;
  RETURN (FLOOR(v_age / 10.0) * 10)::TEXT || '代';
END;
$$;

-- ==============================
-- 3. 予約作成（匿名ユーザー用）
-- サロン・スタッフ・メニューの所属を検証してから INSERT
-- ==============================

CREATE OR REPLACE FUNCTION create_public_booking(
  p_salon_id  UUID,
  p_name      TEXT,
  p_phone     TEXT,
  p_email     TEXT,
  p_notes     TEXT,
  p_birthdate DATE,
  p_menu_id   BIGINT,
  p_staff_id  BIGINT,
  p_date      DATE,
  p_time      TEXT,
  p_duration  INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id BIGINT;
  v_appt_id     BIGINT;
  v_public_id   UUID;
BEGIN
  -- サロンの存在確認
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_salon_id) THEN
    RAISE EXCEPTION '指定されたサロンが存在しません';
  END IF;

  -- スタッフの所属確認
  IF NOT EXISTS (SELECT 1 FROM staff WHERE id = p_staff_id AND salon_id = p_salon_id) THEN
    RAISE EXCEPTION '指定されたスタッフはこのサロンに存在しません';
  END IF;

  -- メニューの所属確認
  IF NOT EXISTS (SELECT 1 FROM menus WHERE id = p_menu_id AND salon_id = p_salon_id) THEN
    RAISE EXCEPTION '指定されたメニューはこのサロンに存在しません';
  END IF;

  -- 顧客登録
  INSERT INTO customers (salon_id, name, phone, email, notes, visit_count, birthdate, age_group)
  VALUES (
    p_salon_id,
    p_name,
    p_phone,
    COALESCE(p_email, ''),
    COALESCE(p_notes, ''),
    0,
    p_birthdate,
    calc_age_group(p_birthdate)
  )
  RETURNING id INTO v_customer_id;

  -- 予約登録
  INSERT INTO appointments (salon_id, customer_id, staff_id, menu_id, date, time, duration, notes, status)
  VALUES (
    p_salon_id,
    v_customer_id,
    p_staff_id,
    p_menu_id,
    p_date,
    p_time,
    p_duration,
    COALESCE(p_notes, ''),
    'pending'
  )
  RETURNING id, public_id INTO v_appt_id, v_public_id;

  RETURN json_build_object('id', v_appt_id, 'public_id', v_public_id);
END;
$$;

GRANT EXECUTE ON FUNCTION create_public_booking TO anon;

-- ==============================
-- 4. 予約確認取得（public_id で）
-- ==============================

CREATE OR REPLACE FUNCTION get_public_booking(p_public_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'id',          a.id,
    'public_id',   a.public_id,
    'date',        a.date,
    'time',        a.time,
    'duration',    a.duration,
    'status',      a.status,
    'notes',       a.notes,
    'customer_id', a.customer_id,
    'menu_id',     a.menu_id,
    'staff_id',    a.staff_id,
    'customers',   json_build_object('name', c.name, 'phone', c.phone, 'email', c.email),
    'menus',       json_build_object('name', m.name, 'price', m.price, 'duration', m.duration),
    'staff',       json_build_object('name', s.name, 'color', s.color)
  )
  INTO v_result
  FROM appointments a
  JOIN customers c ON c.id = a.customer_id
  JOIN menus     m ON m.id = a.menu_id
  JOIN staff     s ON s.id = a.staff_id
  WHERE a.public_id = p_public_id;

  IF v_result IS NULL THEN
    RAISE EXCEPTION '予約が見つかりません';
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_booking TO anon;

-- ==============================
-- 5. 予約キャンセル（public_id で）
-- ==============================

CREATE OR REPLACE FUNCTION cancel_public_booking(p_public_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE appointments
  SET status = 'cancelled'
  WHERE public_id = p_public_id
    AND status IN ('pending', 'confirmed');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'キャンセルできる予約が見つかりません';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION cancel_public_booking TO anon;

-- ============================================================
-- ※ Realtime の設定（ダッシュボードで手動設定が必要）
-- Supabase ダッシュボード > Database > Replication >
-- supabase_realtime の Tables に `appointments` を追加してください
-- （予約完了画面・予約確認ページのリアルタイム更新に必要）
-- ============================================================
