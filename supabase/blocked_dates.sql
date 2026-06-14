-- ============================================================
-- サロンつなぐ — 休業日・ブロック日設定
-- Supabase ダッシュボード > SQL Editor に貼り付けて実行してください
-- ============================================================

CREATE TABLE IF NOT EXISTS blocked_dates (
  id        BIGSERIAL PRIMARY KEY,
  salon_id  UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  date      DATE NOT NULL,
  reason    TEXT,
  UNIQUE(salon_id, date)
);

ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;

-- オーナーは自分の休業日のみ管理可能
DROP POLICY IF EXISTS "blocked_dates_owner" ON blocked_dates;
CREATE POLICY "blocked_dates_owner" ON blocked_dates
  FOR ALL
  USING (salon_id = auth.uid())
  WITH CHECK (salon_id = auth.uid());

-- 予約ページ（未ログイン）から読み取り可能
DROP POLICY IF EXISTS "blocked_dates_public_read" ON blocked_dates;
CREATE POLICY "blocked_dates_public_read" ON blocked_dates
  FOR SELECT
  USING (true);
