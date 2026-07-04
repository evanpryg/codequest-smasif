-- =============================================================================
-- CodeQuest — Migrasi 0003: Row Level Security (INTI KEAMANAN)
-- Rujukan: DataModel.md §7, MVP-Scope.md §3.6
--
-- Dua aturan isolasi (wajib, tidak bisa ditunda):
--   A. Isolasi antar guru  — guru hanya mengakses data di bawah hierarki
--      miliknya (rantai berujung ke academic_year.teacher_id = auth.uid()).
--   B. Isolasi antar siswa — siswa hanya membaca/menulis baris miliknya sendiri
--      (student_id = current_student_id(), dari klaim JWT sesi siswa).
--
-- Pemisahan peran terjadi secara alami:
--   * Sesi GURU  : auth.uid() = id guru; current_student_id() = NULL.
--   * Sesi SISWA : klaim student_id terisi; sub token bukan pemilik hierarki
--                  mana pun, sehingga policy guru selalu false untuknya.
--
-- Role `anon` tidak diberi policy apa pun => tertolak total. Daftar kelas & nama
-- untuk layar login siswa TIDAK diekspos via anon; disajikan lewat Edge Function
-- (service role) agar roster kelas tidak bocor. Lihat README.
-- =============================================================================

-- Aktifkan (dan paksa) RLS pada seluruh tabel domain.
alter table teacher             enable row level security;
alter table academic_year       enable row level security;
alter table semester            enable row level security;
alter table class               enable row level security;
alter table student             enable row level security;
alter table chapter             enable row level security;
alter table quest               enable row level security;
alter table test_case           enable row level security;
alter table submission          enable row level security;
alter table submission_attempt  enable row level security;
alter table review              enable row level security;
alter table xp_log              enable row level security;
alter table achievement         enable row level security;
alter table student_achievement enable row level security;

-- CATATAN: sengaja TIDAK memakai FORCE ROW LEVEL SECURITY. Akses pengguna selalu
-- lewat role `authenticated`/`anon` (PostgREST), yang bukan pemilik tabel
-- sehingga tetap tunduk pada RLS. Membiarkan pemilik tabel (postgres) bebas RLS
-- membuat helper SECURITY DEFINER menelusuri rantai kepemilikan tanpa rekursi
-- policy — tanpa bergantung pada atribut BYPASSRLS.

-- Beri privilege dasar ke `authenticated` agar RLS menjadi SATU-SATUNYA gerbang
-- (tanpa ini, penolakan bisa datang dari kurang privilege, bukan dari policy).
-- Supabase umumnya sudah mengatur ini via default privileges; dinyatakan
-- eksplisit di sini agar repo tidak bergantung pada konfigurasi tersebut.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- =============================================================================
-- A. ISOLASI GURU — hierarki kepemilikan
-- =============================================================================

-- teacher: guru hanya baca/ubah profil sendiri. (INSERT ditangani trigger
-- handle_new_teacher SECURITY DEFINER, jadi tidak perlu policy insert.)
create policy teacher_select_self on teacher
  for select to authenticated using (id = auth.uid());
create policy teacher_update_self on teacher
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- academic_year: pemilik langsung.
create policy ay_teacher_all on academic_year
  for all to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

-- semester: via academic_year.
create policy semester_teacher_all on semester
  for all to authenticated
  using (auth_owns_academic_year(academic_year_id))
  with check (auth_owns_academic_year(academic_year_id));

-- class: via semester (guru). Siswa: baca kelasnya sendiri (read-only) — di bawah.
create policy class_teacher_all on class
  for all to authenticated
  using (auth_owns_semester(semester_id))
  with check (auth_owns_semester(semester_id));

-- student: via class (guru kelola: impor, dsb).
create policy student_teacher_all on student
  for all to authenticated
  using (auth_owns_class(class_id))
  with check (auth_owns_class(class_id));

-- chapter: via class.
create policy chapter_teacher_all on chapter
  for all to authenticated
  using (auth_owns_class(class_id))
  with check (auth_owns_class(class_id));

-- quest: via chapter.
create policy quest_teacher_all on quest
  for all to authenticated
  using (auth_owns_chapter(chapter_id))
  with check (auth_owns_chapter(chapter_id));

-- test_case: via quest.
create policy test_case_teacher_all on test_case
  for all to authenticated
  using (auth_owns_quest(quest_id))
  with check (auth_owns_quest(quest_id));

-- submission: guru baca/ubah submission siswa di quest miliknya (dashboard,
-- pengecualian terkontrol untuk Presentation Mode / Code Runner — DataModel §7).
create policy submission_teacher_select on submission
  for select to authenticated using (auth_owns_quest(quest_id));
create policy submission_teacher_update on submission
  for update to authenticated
  using (auth_owns_quest(quest_id))
  with check (auth_owns_quest(quest_id));

-- submission_attempt: guru baca riwayat di submission miliknya.
create policy attempt_teacher_select on submission_attempt
  for select to authenticated using (auth_owns_submission(submission_id));

-- review: guru menilai attempt di submission miliknya, sebagai dirinya sendiri.
create policy review_teacher_all on review
  for all to authenticated
  using (
    reviewer_teacher_id = auth.uid()
    and exists (
      select 1 from submission_attempt sa
      where sa.id = review.attempt_id and auth_owns_submission(sa.submission_id)
    )
  )
  with check (
    reviewer_teacher_id = auth.uid()
    and exists (
      select 1 from submission_attempt sa
      where sa.id = review.attempt_id and auth_owns_submission(sa.submission_id)
    )
  );

-- xp_log: guru baca riwayat XP siswa miliknya (transparansi).
create policy xp_log_teacher_select on xp_log
  for select to authenticated using (auth_owns_student(student_id));

-- student_achievement: guru baca achievement siswa miliknya.
create policy student_ach_teacher_select on student_achievement
  for select to authenticated using (auth_owns_student(student_id));

-- =============================================================================
-- B. ISOLASI SISWA — hanya baris/konten miliknya
-- =============================================================================

-- Konten kelas (read-only untuk siswa di kelasnya sendiri).
create policy class_student_select on class
  for select to authenticated using (id = current_student_class_id());

create policy student_select_self on student
  for select to authenticated using (id = current_student_id());

create policy chapter_student_select on chapter
  for select to authenticated using (class_id = current_student_class_id());

create policy quest_student_select on quest
  for select to authenticated using (
    exists (
      select 1 from chapter ch
      where ch.id = quest.chapter_id and ch.class_id = current_student_class_id()
    )
  );

-- test_case: siswa boleh membaca test case quest di kelasnya (auto-check
-- client-side butuh input/expected). is_hidden = penyembunyian di UI, bukan
-- kriptografis (lihat catatan asumsi di plan/README; konsisten TechDecisions §2.1).
create policy test_case_student_select on test_case
  for select to authenticated using (student_can_see_quest(quest_id));

-- submission: siswa kelola penuh baris MILIKNYA (draft autosave, status,
-- tombol butuh bantuan). student_id dikunci ke dirinya sendiri.
create policy submission_student_all on submission
  for all to authenticated
  using (student_id = current_student_id())
  with check (student_id = current_student_id());

-- submission_attempt: siswa menambah & membaca riwayat submission miliknya.
-- Riwayat bersifat append-only (tanpa update/delete oleh siswa).
create policy attempt_student_select on submission_attempt
  for select to authenticated using (student_owns_submission(submission_id));
create policy attempt_student_insert on submission_attempt
  for insert to authenticated with check (student_owns_submission(submission_id));

-- review: siswa boleh MEMBACA penilaian atas attempt miliknya (lihat hasil).
create policy review_student_select on review
  for select to authenticated using (
    exists (
      select 1
      from submission_attempt sa
      join submission sub on sub.id = sa.submission_id
      where sa.id = review.attempt_id and sub.student_id = current_student_id()
    )
  );

-- xp_log: siswa baca & tambah XP miliknya (append-only; risiko client-side
-- diterima, XP tidak memengaruhi nilai akademik — TechDecisions §2.1).
create policy xp_log_student_select on xp_log
  for select to authenticated using (student_id = current_student_id());
create policy xp_log_student_insert on xp_log
  for insert to authenticated with check (student_id = current_student_id());

-- student_achievement: siswa baca & buka achievement miliknya (append-only).
create policy student_ach_student_select on student_achievement
  for select to authenticated using (student_id = current_student_id());
create policy student_ach_student_insert on student_achievement
  for insert to authenticated with check (student_id = current_student_id());

-- =============================================================================
-- GLOBAL
-- =============================================================================

-- achievement (definisi): boleh dibaca semua sesi (guru & siswa). Penulisan
-- hanya lewat migrasi/seed (sebagai postgres, mem-bypass RLS).
create policy achievement_read_all on achievement
  for select to authenticated using (true);
