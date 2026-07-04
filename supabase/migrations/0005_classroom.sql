-- =============================================================================
-- CodeQuest — Migrasi 0005: Dukungan Layar Kelas (Milestone 4)
-- Rujukan: MVP-Scope §3.3 (Live Progress), §3.5 (Manual Review), PRD §7.1–7.3
--
-- Dua hal:
--  (1) Guru boleh MEMBERI XP & achievement kepada siswa MILIKNYA — dibutuhkan
--      saat guru meluluskan quest manual lewat review rubrik. (Sebelumnya
--      hanya siswa yang bisa menulis xp_log/student_achievement miliknya,
--      untuk jalur auto-check.)
--  (2) Aktifkan Realtime untuk tabel submission — dashboard Live Progress
--      berlangganan perubahan status & tombol "Butuh Bantuan" tanpa polling.
--      (RLS tetap berlaku pada event Realtime: guru hanya menerima perubahan
--      submission di hierarki miliknya.)
-- =============================================================================

-- (1) Pemberian reward oleh guru — hanya untuk siswa di kelas miliknya.
create policy xp_log_teacher_insert on xp_log
  for insert to authenticated
  with check (auth_owns_student(student_id));

create policy student_ach_teacher_insert on student_achievement
  for insert to authenticated
  with check (auth_owns_student(student_id));

-- (2) Realtime: tambahkan submission ke publication bawaan Supabase.
alter publication supabase_realtime add table submission;
