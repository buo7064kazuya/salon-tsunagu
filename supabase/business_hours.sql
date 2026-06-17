-- ============================================================
-- サロンつなぐ — 営業時間設定
-- Supabase ダッシュボード > SQL Editor に貼り付けて実行してください
-- ============================================================

CREATE TABLE IF NOT EXISTS business_hours (
  salon_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_open     BOOLEAN NOT NULL DEFAULT true,
  open_time   TEXT NOT NULL DEFAULT '09:00',
  close_time  TEXT NOT NULL DEFAULT '19:00',
  PRIMARY KEY (salon_id, day_of_week)
);

ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;

-- オーナー自身の読み書き
DROP POLICY IF EXISTS "bh_owner" ON business_hours;
CREATE POLICY "bh_owner" ON business_hours
  USING (salon_id = auth.uid())
  WITH CHECK (salon_id = auth.uid());

-- 予約ページ（匿名）からの閲覧
DROP POLICY IF EXISTS "bh_public_read" ON business_hours;
CREATE POLICY "bh_public_read" ON business_hours
  FOR SELECT USING (true);
