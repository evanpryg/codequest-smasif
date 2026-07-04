-- =============================================================================
-- CodeQuest — Migrasi 0002: Fungsi & Trigger
-- Rujukan: DataModel.md §3, §4 (template chapter), §6.1 (formula level)
--
-- Berisi:
--   (a) Trigger profil guru otomatis saat signup Supabase Auth.
--   (b) Trigger template chapter (3 latihan kecil + 1 boss).
--   (c) Trigger XP -> total_xp & level.
--   (d) Helper kepemilikan (SECURITY DEFINER) untuk dipakai policy RLS di 0003.
--   (e) Helper current_student_id() membaca klaim JWT siswa.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- (a) Profil guru otomatis. teacher.id = auth.users.id (DataModel §3).
-- -----------------------------------------------------------------------------
create or replace function handle_new_teacher()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.teacher (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_teacher();

-- -----------------------------------------------------------------------------
-- (b) Template chapter: 3 latihan kecil + 1 latihan besar (boss) (DataModel §4).
--     Reward default (§6.1): kecil 25 XP, boss 100 XP. Semua bisa diedit/dihapus.
-- -----------------------------------------------------------------------------
create or replace function create_default_quests()
returns trigger
language plpgsql
as $$
begin
  insert into public.quest (chapter_id, title, order_index, is_boss, grading_mode, reward_xp)
  values
    (new.id, 'Latihan 1', 1, false, 'auto',   25),
    (new.id, 'Latihan 2', 2, false, 'auto',   25),
    (new.id, 'Latihan 3', 3, false, 'auto',   25),
    (new.id, 'Boss Quest', 4, true, 'manual', 100);
  return new;
end;
$$;

create trigger on_chapter_created
  after insert on chapter
  for each row execute function create_default_quests();

-- -----------------------------------------------------------------------------
-- (c) XP -> total_xp & level.
--     total_xp = jumlah seluruh xp_log.amount.
--     level = floor( (1 + sqrt(1 + 0.08 * total_xp)) / 2 )   (DataModel §6.1)
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER: trigger memelihara total_xp & level tanpa perlu memberi
-- siswa hak UPDATE langsung ke tabel student (mencegah manipulasi nilai kolom
-- ini secara langsung; XP tetap hanya bertambah lewat baris xp_log).
create or replace function apply_xp_to_student()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_total integer;
begin
  update public.student
     set total_xp = total_xp + new.amount
   where id = new.student_id
   returning total_xp into new_total;

  update public.student
     set level = greatest(1, floor((1 + sqrt(1 + 0.08 * new_total)) / 2))
   where id = new.student_id;

  return new;
end;
$$;

create trigger on_xp_log_insert
  after insert on xp_log
  for each row execute function apply_xp_to_student();

-- =============================================================================
-- Helper untuk RLS (dipakai di 0003_rls.sql)
-- SECURITY DEFINER + dimiliki role migrasi (postgres) => query di dalamnya
-- mem-bypass RLS, sehingga tidak terjadi rekursi policy saat menelusuri
-- rantai kepemilikan. Setiap fungsi STABLE dan search_path dikunci.
-- =============================================================================

-- student_id dari klaim JWT sesi siswa (diterbitkan Edge Function student-login).
create or replace function current_student_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'student_id', '')::uuid;
$$;

-- Rantai kepemilikan berujung ke teacher_id = auth.uid() (DataModel §7.A).

create or replace function auth_owns_academic_year(p_year_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from academic_year ay
    where ay.id = p_year_id and ay.teacher_id = auth.uid()
  );
$$;

create or replace function auth_owns_semester(p_semester_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from semester s
    join academic_year ay on ay.id = s.academic_year_id
    where s.id = p_semester_id and ay.teacher_id = auth.uid()
  );
$$;

create or replace function auth_owns_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from class c
    join semester s       on s.id = c.semester_id
    join academic_year ay on ay.id = s.academic_year_id
    where c.id = p_class_id and ay.teacher_id = auth.uid()
  );
$$;

create or replace function auth_owns_chapter(p_chapter_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from chapter ch
    join class c          on c.id = ch.class_id
    join semester s       on s.id = c.semester_id
    join academic_year ay on ay.id = s.academic_year_id
    where ch.id = p_chapter_id and ay.teacher_id = auth.uid()
  );
$$;

create or replace function auth_owns_quest(p_quest_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from quest q
    join chapter ch       on ch.id = q.chapter_id
    join class c          on c.id = ch.class_id
    join semester s       on s.id = c.semester_id
    join academic_year ay on ay.id = s.academic_year_id
    where q.id = p_quest_id and ay.teacher_id = auth.uid()
  );
$$;

create or replace function auth_owns_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from student st
    join class c          on c.id = st.class_id
    join semester s       on s.id = c.semester_id
    join academic_year ay on ay.id = s.academic_year_id
    where st.id = p_student_id and ay.teacher_id = auth.uid()
  );
$$;

create or replace function auth_owns_submission(p_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from submission sub
    join quest q          on q.id = sub.quest_id
    join chapter ch       on ch.id = q.chapter_id
    join class c          on c.id = ch.class_id
    join semester s       on s.id = c.semester_id
    join academic_year ay on ay.id = s.academic_year_id
    where sub.id = p_submission_id and ay.teacher_id = auth.uid()
  );
$$;

-- Kelas tempat siswa saat ini terdaftar (untuk policy baca konten oleh siswa).
create or replace function current_student_class_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select st.class_id from student st where st.id = current_student_id();
$$;

-- Apakah submission ini milik siswa yang sedang login (untuk policy attempt).
create or replace function student_owns_submission(p_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from submission sub
    where sub.id = p_submission_id
      and sub.student_id = current_student_id()
  );
$$;

-- Apakah quest ini berada di kelas siswa yang sedang login (baca konten & test_case).
create or replace function student_can_see_quest(p_quest_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from quest q
    join chapter ch on ch.id = q.chapter_id
    where q.id = p_quest_id
      and ch.class_id = current_student_class_id()
  );
$$;
