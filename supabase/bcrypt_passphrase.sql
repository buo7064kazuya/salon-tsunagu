-- ============================================================
-- あいことばをbcryptでハッシュ化する移行SQL
-- salon_settings.sql の実行後にこのファイルを実行してください
-- ============================================================

-- pgcrypto 拡張を有効化（bcrypt に必要）
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 既存のあいことばをすべてクリア（平文データを削除）
-- ※ オーナーに再設定をお願いしてください
UPDATE salon_settings SET passphrase = '' WHERE true;

-- ============================================================
-- あいことば検証（bcrypt対応版）
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
  IF stored_pass IS NULL OR stored_pass = '' THEN RETURN FALSE; END IF;
  -- bcryptで照合
  RETURN crypt(p_passphrase, stored_pass) = stored_pass;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_verify_passphrase(UUID, TEXT) TO authenticated;

-- ============================================================
-- あいことばを設定（bcrypt対応版・管理者）
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
  VALUES (p_salon_id, crypt(p_passphrase, gen_salt('bf')), NOW())
  ON CONFLICT (salon_id)
  DO UPDATE SET passphrase = crypt(EXCLUDED.passphrase, gen_salt('bf')), updated_at = NOW();
END;
$$;
GRANT EXECUTE ON FUNCTION admin_set_passphrase(UUID, TEXT) TO authenticated;

-- ============================================================
-- あいことばを設定（bcrypt対応版・オーナー）
-- ============================================================
CREATE OR REPLACE FUNCTION owner_set_passphrase(p_passphrase TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO salon_settings (salon_id, passphrase, updated_at)
  VALUES (auth.uid(), crypt(p_passphrase, gen_salt('bf')), NOW())
  ON CONFLICT (salon_id)
  DO UPDATE SET passphrase = crypt(EXCLUDED.passphrase, gen_salt('bf')), updated_at = NOW();
END;
$$;
GRANT EXECUTE ON FUNCTION owner_set_passphrase(TEXT) TO authenticated;

-- ============================================================
-- あいことばの設定有無を確認（ハッシュ化後は内容を返せないため boolean に変更）
-- ============================================================
CREATE OR REPLACE FUNCTION owner_get_passphrase()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_pass TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT passphrase INTO stored_pass FROM salon_settings WHERE salon_id = auth.uid();
  RETURN stored_pass IS NOT NULL AND stored_pass != '';
END;
$$;
GRANT EXECUTE ON FUNCTION owner_get_passphrase() TO authenticated;
