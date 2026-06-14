-- ============================================================
-- サロンつなぐ — 定期ブロック設定（曜日・時間帯）
-- Supabase ダッシュボード > SQL Editor に貼り付けて実行してください
-- ============================================================

CREATE TABLE IF NOT EXISTS weekly_blocks (
  id           BIGSERIAL PRIMARY KEY,
  salon_id     UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  day_of_week  SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time   TIME,
  end_time     TIME,
  reason       TEXT
);

ALTER TABLE weekly_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "weekly_blocks_owner" ON weekly_blocks;
CREATE POLICY "weekly_blocks_owner" ON weekly_blocks
  FOR ALL
  USING (salon_id = auth.uid())
  WITH CHECK (salon_id = auth.uid());

DROP POLICY IF EXISTS "weekly_blocks_public_read" ON weekly_blocks;
CREATE POLICY "weekly_blocks_public_read" ON weekly_blocks
  FOR SELECT
  USING (true);
