-- ============================================================
-- サロンつなぐ — RLS（Row Level Security）設定
-- Supabase ダッシュボード > SQL Editor に貼り付けて実行してください
-- ============================================================

-- 1. salon_id カラムを追加（auth.uid() をデフォルト値に設定）
--    INSERT 時に自動でログインユーザーの ID が入ります

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS salon_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();

ALTER TABLE menus
  ADD COLUMN IF NOT EXISTS salon_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS salon_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS salon_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();

-- 2. RLS を有効化

ALTER TABLE staff       ENABLE ROW LEVEL SECURITY;
ALTER TABLE menus       ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- 3. 既存のポリシーを削除（再実行時の重複エラー防止）

DROP POLICY IF EXISTS "staff_owner"        ON staff;
DROP POLICY IF EXISTS "menus_owner"        ON menus;
DROP POLICY IF EXISTS "customers_owner"    ON customers;
DROP POLICY IF EXISTS "appointments_owner" ON appointments;

-- 4. ポリシーを作成
--    salon_id = auth.uid() の行のみ SELECT / INSERT / UPDATE / DELETE を許可

CREATE POLICY "staff_owner" ON staff
  USING (salon_id = auth.uid())
  WITH CHECK (salon_id = auth.uid());

CREATE POLICY "menus_owner" ON menus
  USING (salon_id = auth.uid())
  WITH CHECK (salon_id = auth.uid());

CREATE POLICY "customers_owner" ON customers
  USING (salon_id = auth.uid())
  WITH CHECK (salon_id = auth.uid());

CREATE POLICY "appointments_owner" ON appointments
  USING (salon_id = auth.uid())
  WITH CHECK (salon_id = auth.uid());

-- ============================================================
-- 既存データの salon_id を更新する場合（初回のみ）
-- ※ 特定のユーザーに紐づけたい場合は UUID を書き換えてください
-- ============================================================
-- UPDATE staff        SET salon_id = '<your-user-uuid>' WHERE salon_id IS NULL;
-- UPDATE menus        SET salon_id = '<your-user-uuid>' WHERE salon_id IS NULL;
-- UPDATE customers    SET salon_id = '<your-user-uuid>' WHERE salon_id IS NULL;
-- UPDATE appointments SET salon_id = '<your-user-uuid>' WHERE salon_id IS NULL;
