-- =============================================================================
-- CodeQuest — Tes RLS (pgTAP)
-- Jalankan: supabase test db
--
-- Membuktikan dua aturan isolasi inti (DataModel §7):
--   A. Guru A tidak bisa membaca/mengubah data Guru B.
--   B. Siswa X tidak bisa membaca/mengubah data Siswa Y (walau sekelas).
-- Sekaligus memverifikasi trigger template chapter & trigger XP -> level,
-- serta pengecualian terkontrol (guru boleh membaca submission siswanya).
--
-- Teknik: fixture dibuat sebagai `postgres` (bypass RLS). Peran disimulasikan
-- dengan `set local role authenticated` + `set local request.jwt.claims`.
-- =============================================================================

begin;
select plan(23);

-- --- ID tetap agar deterministik -------------------------------------------
-- Guru A = 111.., Guru B = 222.. ; Siswa X = 555.., Siswa Y = 666..
\set teacherA '11111111-1111-1111-1111-111111111111'
\set teacherB '22222222-2222-2222-2222-222222222222'
\set classA   '33333333-3333-3333-3333-333333333333'
\set chapterA '44444444-4444-4444-4444-444444444444'
\set classB   '3b333333-3333-3333-3333-333333333333'
\set chapterB '4b444444-4444-4444-4444-444444444444'
\set studentX '55555555-5555-5555-5555-555555555555'
\set studentY '66666666-6666-6666-6666-666666666666'

-- =============================================================================
-- FIXTURE (sebagai postgres — bypass RLS)
-- =============================================================================

-- Guru (via auth.users; trigger handle_new_teacher membuat baris teacher).
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', :'teacherA', 'authenticated',
   'authenticated', 'guruA@example.com', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', :'teacherB', 'authenticated',
   'authenticated', 'guruB@example.com', '', now(), now(), now());

-- Hierarki Guru A: academic_year -> semester -> class -> chapter (+ students).
with ay as (
  insert into academic_year (id, teacher_id, label)
  values ('a1111111-0000-0000-0000-000000000000', :'teacherA', '2025/2026')
  returning id
), sem as (
  insert into semester (id, academic_year_id, name)
  values ('a1112222-0000-0000-0000-000000000000',
          'a1111111-0000-0000-0000-000000000000', 'Ganjil')
  returning id
)
insert into class (id, semester_id, name)
values (:'classA', 'a1112222-0000-0000-0000-000000000000', 'X-1');

-- chapter A: pemicu template 3 quest kecil + 1 boss.
insert into chapter (id, class_id, title, order_index)
values (:'chapterA', :'classA', 'Bab 1', 1);

-- Dua siswa di kelas yang SAMA (untuk uji isolasi antar siswa sekelas).
insert into student (id, class_id, name, password_hash)
values
  (:'studentX', :'classA', 'Budi',  'x'),
  (:'studentY', :'classA', 'Sinta', 'x');

-- Hierarki Guru B (terpisah penuh).
with ay as (
  insert into academic_year (id, teacher_id, label)
  values ('b1111111-0000-0000-0000-000000000000', :'teacherB', '2025/2026')
  returning id
), sem as (
  insert into semester (id, academic_year_id, name)
  values ('b1112222-0000-0000-0000-000000000000',
          'b1111111-0000-0000-0000-000000000000', 'Ganjil')
  returning id
)
insert into class (id, semester_id, name)
values (:'classB', 'b1112222-0000-0000-0000-000000000000', 'XI-2');

insert into chapter (id, class_id, title, order_index)
values (:'chapterB', :'classB', 'Bab B', 1);

-- Submission milik Siswa X pada quest pertama (kecil) di chapter A.
insert into submission (id, student_id, quest_id, status)
values (
  '5a000000-0000-0000-0000-000000000000',
  :'studentX',
  (select id from quest where chapter_id = :'chapterA' and is_boss = false
     order by order_index limit 1),
  'in_progress'
);

-- =============================================================================
-- TRIGGER: template chapter
-- =============================================================================
select is(
  (select count(*)::int from quest where chapter_id = :'chapterA'),
  4, 'chapter A otomatis membuat 4 quest (3 kecil + 1 boss)');
select is(
  (select count(*)::int from quest where chapter_id = :'chapterA' and is_boss),
  1, 'tepat 1 boss quest di chapter A');

-- =============================================================================
-- A. ISOLASI GURU
-- =============================================================================
reset role;
set local role authenticated;
set local request.jwt.claims to
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is(
  (select count(*)::int from class where id = :'classA'), 1,
  'Guru A melihat kelasnya sendiri');
select is(
  (select count(*)::int from class where id = :'classB'), 0,
  'Guru A TIDAK melihat kelas Guru B');
select is(
  (select count(*)::int from quest where chapter_id = :'chapterA'), 4,
  'Guru A melihat quest miliknya');
select lives_ok($$
  insert into academic_year (teacher_id, label)
  values ('11111111-1111-1111-1111-111111111111', '2026/2027')
$$, 'Guru A boleh membuat academic_year miliknya');
select throws_ok($$
  insert into academic_year (teacher_id, label)
  values ('22222222-2222-2222-2222-222222222222', 'curang')
$$, '42501', null, 'Guru A TIDAK boleh membuat data atas nama Guru B');

reset role;
set local role authenticated;
set local request.jwt.claims to
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is(
  (select count(*)::int from class where id = :'classA'), 0,
  'Guru B TIDAK melihat kelas Guru A');
select is(
  (select count(*)::int from submission
     where id = '5a000000-0000-0000-0000-000000000000'), 0,
  'Guru B TIDAK melihat submission siswa Guru A');
-- Update lintas-guru tidak error tapi 0 baris (USING menyaring keluar).
select lives_ok($$
  update quest set title = 'HACKED' where chapter_id = '44444444-4444-4444-4444-444444444444'
$$, 'Update quest Guru A oleh Guru B dieksekusi tanpa error...');
reset role;
select is(
  (select count(*)::int from quest where title = 'HACKED'), 0,
  '...namun TIDAK mengubah satu baris pun milik Guru A');

-- =============================================================================
-- B. ISOLASI SISWA
-- =============================================================================
reset role;
set local role authenticated;
set local request.jwt.claims to
  '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated","student_id":"55555555-5555-5555-5555-555555555555"}';

select is(
  (select count(*)::int from submission where student_id = :'studentX'), 1,
  'Siswa X melihat submission miliknya');
select is(
  (select count(*)::int from submission where student_id = :'studentY'), 0,
  'Siswa X TIDAK melihat submission Siswa Y (sekelas)');
select is(
  (select count(*)::int from student where id = :'studentY'), 0,
  'Siswa X TIDAK melihat baris siswa lain');
select is(
  (select count(*)::int from student where id = :'studentX'), 1,
  'Siswa X melihat dirinya sendiri');
select is(
  (select count(*)::int from class where id = :'classA'), 1,
  'Siswa X melihat kelasnya (untuk konten)');

-- Siswa X membuat submission miliknya untuk quest lain -> boleh.
select lives_ok($$
  insert into submission (student_id, quest_id, status)
  values (
    '55555555-5555-5555-5555-555555555555',
    (select id from quest where chapter_id = '44444444-4444-4444-4444-444444444444'
       and is_boss = false order by order_index offset 1 limit 1),
    'in_progress')
$$, 'Siswa X boleh membuat submission miliknya');

-- Siswa X mencoba menulis atas nama Siswa Y -> ditolak RLS.
select throws_ok($$
  insert into submission (student_id, quest_id, status)
  values (
    '66666666-6666-6666-6666-666666666666',
    (select id from quest where chapter_id = '44444444-4444-4444-4444-444444444444'
       and is_boss = true limit 1),
    'in_progress')
$$, '42501', null, 'Siswa X TIDAK boleh membuat submission atas nama Siswa Y');

select throws_ok($$
  insert into xp_log (student_id, amount, reason)
  values ('66666666-6666-6666-6666-666666666666', 999, 'curang')
$$, '42501', null, 'Siswa X TIDAK boleh memberi XP ke Siswa Y');

-- Siswa X menambah XP miliknya -> trigger memperbarui total_xp & level.
select lives_ok($$
  insert into xp_log (student_id, amount, reason)
  values ('55555555-5555-5555-5555-555555555555', 100, 'Quest selesai')
$$, 'Siswa X boleh menambah XP miliknya');

reset role;
select is(
  (select level from student where id = :'studentX'), 2,
  'Trigger XP->level: 100 XP menaikkan Siswa X ke level 2');

-- Siswa Y tidak melihat submission Siswa X.
reset role;
set local role authenticated;
set local request.jwt.claims to
  '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated","student_id":"66666666-6666-6666-6666-666666666666"}';
select is(
  (select count(*)::int from submission where student_id = :'studentX'), 0,
  'Siswa Y TIDAK melihat submission Siswa X');

-- =============================================================================
-- PENGECUALIAN TERKONTROL: guru boleh membaca submission siswanya
-- =============================================================================
reset role;
set local role authenticated;
set local request.jwt.claims to
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select ok(
  (select count(*) from submission where student_id = :'studentX') > 0,
  'Guru A (pemilik kelas) boleh membaca submission siswanya');

select * from finish();
rollback;
