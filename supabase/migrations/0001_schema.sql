-- =============================================================================
-- CodeQuest — Migrasi 0001: Skema Inti
-- Rujukan: DataModel.md §3–§6
--
-- Prinsip: hierarki kepemilikan berujung ke guru (teacher), data siswa minimal
-- (nama & kelas saja), quest terpadu (flag is_boss), dan riwayat submit
-- dipertahankan. Isolasi (RLS) ditambahkan terpisah di 0003_rls.sql.
--
-- CATATAN SCOPE MVP: kolom untuk fitur Fase 2 (Gold, Shop, Avatar, Inventory,
-- Title) SENGAJA tidak ditambahkan (MVP-Scope §4). Bisa menyusul tanpa
-- mengubah struktur yang ada.
-- =============================================================================

create extension if not exists pgcrypto;  -- gen_random_uuid()

-- --- Tipe enum ---------------------------------------------------------------
create type grading_mode as enum ('auto', 'manual');

create type submission_status as enum (
  'not_started',
  'in_progress',
  'submitted',
  'waiting_review',
  'passed',
  'failed'
);

-- =============================================================================
-- 1. CORE
-- =============================================================================

-- teacher — profil guru; id = auth.users.id (Supabase Auth menangani autentikasi)
create table teacher (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text,
  email      text,
  created_at timestamptz not null default now()
);

-- academic_year (Tahun Ajaran) — PEMILIK: teacher
create table academic_year (
  id         uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teacher (id) on delete cascade,
  label      text not null,                    -- contoh: "2025/2026"
  created_at timestamptz not null default now()
);

create table semester (
  id               uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references academic_year (id) on delete cascade,
  name             text not null,              -- "Ganjil" / "Genap"
  created_at       timestamptz not null default now()
);

create table class (
  id          uuid primary key default gen_random_uuid(),
  semester_id uuid not null references semester (id) on delete cascade,
  name        text not null,                   -- contoh: "X-1"
  created_at  timestamptz not null default now()
);

-- student — login: pilih Kelas -> pilih Nama -> Password.
-- Data siswa MINIMAL: hanya nama & kelas (MVP-Scope §6, DataModel §3).
create table student (
  id                   uuid primary key default gen_random_uuid(),
  class_id             uuid not null references class (id) on delete cascade,
  name                 text not null,
  password_hash        text not null,          -- password awal dibuat otomatis saat impor Excel
  must_change_password boolean not null default true,
  total_xp             integer not null default 0,
  level                integer not null default 1,  -- diturunkan dari total_xp (trigger di 0002)
  created_at           timestamptz not null default now(),
  -- dua siswa bernama sama boleh di kelas berbeda, tidak dalam satu kelas
  constraint student_unique_name_per_class unique (class_id, name)
);

-- =============================================================================
-- 2. LEARNING
-- =============================================================================

create table chapter (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references class (id) on delete cascade,
  title       text not null,
  description text,                            -- materi/pengantar (diisi guru)
  order_index integer not null default 0,
  created_at  timestamptz not null default now()
);

-- quest — satu tabel untuk latihan kecil & latihan besar (boss), dibedakan is_boss.
create table quest (
  id                  uuid primary key default gen_random_uuid(),
  chapter_id          uuid not null references chapter (id) on delete cascade,
  title               text not null,
  description         text,                    -- soal/instruksi
  order_index         integer not null default 0,
  is_boss             boolean not null default false,
  grading_mode        grading_mode not null default 'auto',
  reward_xp           integer not null default 25,
  ignore_output_order boolean not null default false,      -- untuk auto check
  float_tolerance     numeric not null default 0.001,      -- toleransi floating point
  rubric              jsonb,                   -- kriteria manual review (lihat DataModel §5)
  created_at          timestamptz not null default now()
);

-- test_case — hanya relevan untuk quest grading_mode = 'auto'.
create table test_case (
  id              uuid primary key default gen_random_uuid(),
  quest_id        uuid not null references quest (id) on delete cascade,
  stdin           text not null default '',    -- input disuplai ke program (bukan interaktif)
  expected_output text not null default '',
  is_hidden       boolean not null default false,  -- true = tidak ditampilkan di UI daftar siswa
  order_index     integer not null default 0
);

-- =============================================================================
-- 3. SUBMISSION & GRADING
-- =============================================================================

-- submission — STATUS TERKINI satu siswa untuk satu quest; draft autosave di sini.
create table submission (
  id                uuid primary key default gen_random_uuid(),
  student_id        uuid not null references student (id) on delete cascade,
  quest_id          uuid not null references quest (id) on delete cascade,
  status            submission_status not null default 'not_started',
  draft_code        text,                      -- autosave kode yang sedang dikerjakan
  draft_updated_at  timestamptz,
  help_requested    boolean not null default false,   -- tombol "Butuh Bantuan"
  help_requested_at timestamptz,
  updated_at        timestamptz not null default now(),
  -- satu baris status per siswa per quest
  constraint submission_unique_student_quest unique (student_id, quest_id)
);

-- submission_attempt — riwayat tiap kali siswa menekan Submit (menyimpan proses).
create table submission_attempt (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submission (id) on delete cascade,
  source_code   text not null,
  auto_result   jsonb,                         -- hasil per test case (lolos/gagal, output aktual)
  passed        boolean,                       -- ringkasan: lolos semua test case atau tidak
  created_at    timestamptz not null default now()
);

-- review — penilaian manual guru untuk quest grading_mode = 'manual'.
create table review (
  id                  uuid primary key default gen_random_uuid(),
  attempt_id          uuid not null references submission_attempt (id) on delete cascade,
  reviewer_teacher_id uuid not null references teacher (id) on delete cascade,
  scores              jsonb,                   -- nilai per kriteria rubrik
  comment             text,
  created_at          timestamptz not null default now()
);

-- =============================================================================
-- 4. GAMIFIKASI (versi MVP: XP, Level, Achievement)
-- =============================================================================

-- xp_log — riwayat perolehan XP (transparansi & audit).
create table xp_log (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references student (id) on delete cascade,
  amount          integer not null,
  reason          text,                        -- contoh: "Quest selesai"
  source_quest_id uuid references quest (id) on delete set null,
  created_at      timestamptz not null default now()
);

-- achievement — definisi global (dipakai semua guru untuk MVP).
create table achievement (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,            -- contoh: "first_quest"
  name        text not null,
  description text,
  icon        text
);

-- student_achievement — achievement yang sudah didapat siswa.
create table student_achievement (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references student (id) on delete cascade,
  achievement_id uuid not null references achievement (id) on delete cascade,
  earned_at      timestamptz not null default now(),
  -- satu achievement hanya bisa didapat sekali per siswa
  constraint student_achievement_unique unique (student_id, achievement_id)
);

-- --- Index bantu untuk penelusuran hierarki & query dashboard -----------------
create index idx_academic_year_teacher   on academic_year (teacher_id);
create index idx_semester_year           on semester (academic_year_id);
create index idx_class_semester          on class (semester_id);
create index idx_student_class           on student (class_id);
create index idx_chapter_class           on chapter (class_id);
create index idx_quest_chapter           on quest (chapter_id);
create index idx_test_case_quest         on test_case (quest_id);
create index idx_submission_student      on submission (student_id);
create index idx_submission_quest        on submission (quest_id);
create index idx_attempt_submission      on submission_attempt (submission_id);
create index idx_review_attempt          on review (attempt_id);
create index idx_xp_log_student          on xp_log (student_id);
create index idx_student_achievement_stu on student_achievement (student_id);
