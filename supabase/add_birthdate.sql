-- ============================================================
-- customers テーブルに生年月日カラムを追加
-- Supabase ダッシュボード > SQL Editor に貼り付けて実行してください
-- ============================================================

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS birthdate DATE;
