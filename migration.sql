-- ════════════════════════════════════════════════════════════
-- PHASE 1 マイグレーション
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
