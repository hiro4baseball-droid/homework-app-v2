-- ════════════════════════════════════════════════════════════
-- マイグレーション（PHASE 1 + PHASE 2）
-- Supabase SQL Editor で実行してください
-- https://supabase.com/dashboard/project/wagrqpqscxkviloqwlbb/sql/new
-- ════════════════════════════════════════════════════════════

-- 1. homework テーブルに課題範囲カラムを追加
ALTER TABLE homework ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT '';

-- 2. 生徒の課題メモテーブル
CREATE TABLE IF NOT EXISTS student_scope_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id UUID NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(homework_id, student_id)
);

-- 3. 写真提出テーブル
CREATE TABLE IF NOT EXISTS photo_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id UUID NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. RLS 有効化
ALTER TABLE student_scope_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_submissions ENABLE ROW LEVEL SECURITY;

-- 5. アクセスポリシー設定
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='student_scope_notes' AND policyname='allow_all') THEN
    CREATE POLICY "allow_all" ON student_scope_notes FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='photo_submissions' AND policyname='allow_all') THEN
    CREATE POLICY "allow_all" ON photo_submissions FOR ALL USING (true) WITH CHECK (true);
  END IF;
  -- Storage ポリシー（バケットは作成済み）
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='hw_photos_insert') THEN
    CREATE POLICY "hw_photos_insert" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'homework-photos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='hw_photos_select') THEN
    CREATE POLICY "hw_photos_select" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'homework-photos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='hw_photos_delete') THEN
    CREATE POLICY "hw_photos_delete" ON storage.objects FOR DELETE TO anon USING (bucket_id = 'homework-photos');
  END IF;
END
$do$;

-- ════════════════════════════════════════════════════════════
-- PHASE 2 マイグレーション
-- ════════════════════════════════════════════════════════════

-- 1. submissions テーブルに submitted_at カラムを追加
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. 生徒自身のタスクテーブル
CREATE TABLE IF NOT EXISTS student_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date DATE DEFAULT NULL,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS 有効化 + ポリシー
ALTER TABLE student_tasks ENABLE ROW LEVEL SECURITY;
DO $do2$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='student_tasks' AND policyname='allow_all') THEN
    CREATE POLICY "allow_all" ON student_tasks FOR ALL USING (true) WITH CHECK (true);
  END IF;
END
$do2$;

-- ════════════════════════════════════════════════════════════
-- PHASE 3 マイグレーション（AI機能）
-- ════════════════════════════════════════════════════════════

-- submissions テーブルに AI チェック用カラムを追加
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS ai_status TEXT DEFAULT 'unchecked';
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS ai_feedback TEXT DEFAULT NULL;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS needs_resubmit BOOLEAN DEFAULT FALSE;

-- students テーブルに PIN カラムを追加（未実行の場合）
ALTER TABLE students ADD COLUMN IF NOT EXISTS pin TEXT DEFAULT NULL;
