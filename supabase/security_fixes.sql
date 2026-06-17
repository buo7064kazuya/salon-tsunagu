-- ============================================================
-- セキュリティ修正
-- 1. appointments の公開読み取りを最小列の関数に置き換え
-- 2. create_public_booking にレート制限を追加
-- ============================================================

-- ==============================
-- 1. appointments_public_read を削除
--    → get_public_availability 関数で必要列のみ公開
-- ==============================

DROP POLICY IF EXISTS "appointments_public_read" ON appointments;

CREATE OR REPLACE FUNCTION get_public_availability(p_salon_id UUID, p_date DATE)
RETURNS TABLE(staff_id BIGINT, time TEXT, duration INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT a.staff_id, a.time, a.duration::INTEGER
  FROM appointments a
  WHERE a.salon_id = p_salon_id
    AND a.date = p_date
    AND a.status != 'cancelled';
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_availability(UUID, DATE) TO anon;

-- ==============================
-- 2. create_public_booking にレート制限を追加
--    同一電話番号で未来の予約が5件以上ある場合は拒否
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

  -- レート制限: 同一電話番号で未来の有効予約が5件以上なら拒否
  IF p_phone IS NOT NULL AND p_phone != '' THEN
    IF (
      SELECT COUNT(*)
      FROM appointments a
      JOIN customers c ON c.id = a.customer_id
      WHERE c.phone = p_phone
        AND a.date >= CURRENT_DATE
        AND a.status != 'cancelled'
    ) >= 5 THEN
      RAISE EXCEPTION '予約の上限に達しました。現在の予約をご確認の上、再度お試しください';
    END IF;
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
