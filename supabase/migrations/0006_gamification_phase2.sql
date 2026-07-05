-- =============================================================================
-- CodeQuest — Migrasi 0006: Gamifikasi Fase 2 (Gold, Shop, Karakter/Avatar)
-- Rujukan: PRD §7.4, MVP-Scope §4 (fitur Fase 2), DataModel §4 (reward_gold)
--
-- Prinsip tetap: gamifikasi TIDAK memengaruhi nilai akademik (PRD prinsip #3).
-- Pola sama dengan XP: gold_log = riwayat, student.gold = saldo cache via
-- trigger. PEMBELIAN lewat fungsi SECURITY DEFINER yang atomik (cek saldo &
-- kepemilikan di server) sehingga saldo tak bisa minus / item dobel.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Gold pada siswa & quest
-- ---------------------------------------------------------------------------
alter table student
  add column gold integer not null default 0 check (gold >= 0);

-- Default reward: latihan kecil 10, boss 40 (guru bisa ubah per quest).
alter table quest
  add column reward_gold integer not null default 10;

update quest set reward_gold = 40 where is_boss;

-- Template chapter kini menyertakan reward_gold.
create or replace function create_default_quests()
returns trigger
language plpgsql
as $$
begin
  insert into public.quest
    (chapter_id, title, order_index, is_boss, grading_mode, reward_xp, reward_gold)
  values
    (new.id, 'Latihan 1', 1, false, 'auto',   25,  10),
    (new.id, 'Latihan 2', 2, false, 'auto',   25,  10),
    (new.id, 'Latihan 3', 3, false, 'auto',   25,  10),
    (new.id, 'Boss Quest', 4, true, 'manual', 100, 40);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Riwayat gold + trigger saldo (cermin dari xp_log)
-- ---------------------------------------------------------------------------
create table gold_log (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references student (id) on delete cascade,
  amount          integer not null,          -- positif = dapat, negatif = belanja
  reason          text,
  source_quest_id uuid references quest (id) on delete set null,
  created_at      timestamptz not null default now()
);
create index idx_gold_log_student on gold_log (student_id);

create or replace function apply_gold_to_student()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Constraint check (gold >= 0) menolak saldo minus secara otomatis.
  update public.student set gold = gold + new.amount where id = new.student_id;
  return new;
end;
$$;

create trigger on_gold_log_insert
  after insert on gold_log
  for each row execute function apply_gold_to_student();

-- ---------------------------------------------------------------------------
-- 3. Katalog toko, inventory, dan avatar terpasang
-- ---------------------------------------------------------------------------
create table shop_item (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,   -- dirender komponen AvatarView di frontend
  name        text not null,
  category    text not null check (category in ('background', 'hair', 'outfit', 'hat', 'frame')),
  price       integer not null check (price >= 0),
  sort_index  integer not null default 0
);

create table student_item (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references student (id) on delete cascade,
  item_id     uuid not null references shop_item (id) on delete cascade,
  acquired_at timestamptz not null default now(),
  constraint student_item_unique unique (student_id, item_id)
);
create index idx_student_item_student on student_item (student_id);

-- Bagian yang sedang DIPAKAI siswa (null = default bawaan).
create table student_avatar (
  student_id uuid primary key references student (id) on delete cascade,
  background text,
  hair       text,
  outfit     text,
  hat        text,
  frame      text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
alter table gold_log       enable row level security;
alter table shop_item      enable row level security;
alter table student_item   enable row level security;
alter table student_avatar enable row level security;

-- gold_log — cermin kebijakan xp_log.
create policy gold_log_student_select on gold_log
  for select to authenticated using (student_id = current_student_id());
create policy gold_log_student_insert on gold_log
  for insert to authenticated with check (student_id = current_student_id());
create policy gold_log_teacher_select on gold_log
  for select to authenticated using (auth_owns_student(student_id));
create policy gold_log_teacher_insert on gold_log
  for insert to authenticated with check (auth_owns_student(student_id));

-- Katalog toko: semua sesi boleh baca; isi dikelola lewat migrasi/seed.
create policy shop_item_read_all on shop_item
  for select to authenticated using (true);

-- Inventory: baca milik sendiri / siswa milik guru. TANPA policy insert —
-- pembelian hanya lewat fungsi buy_shop_item (SECURITY DEFINER) di bawah.
create policy student_item_student_select on student_item
  for select to authenticated using (student_id = current_student_id());
create policy student_item_teacher_select on student_item
  for select to authenticated using (auth_owns_student(student_id));

-- Avatar terpasang: siswa kelola miliknya; guru boleh lihat (untuk dashboard).
create policy student_avatar_student_all on student_avatar
  for all to authenticated
  using (student_id = current_student_id())
  with check (student_id = current_student_id());
create policy student_avatar_teacher_select on student_avatar
  for select to authenticated using (auth_owns_student(student_id));

-- ---------------------------------------------------------------------------
-- 5. Pembelian atomik (anti saldo minus & anti beli dobel)
-- ---------------------------------------------------------------------------
create or replace function buy_shop_item(p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_student uuid := current_student_id();
  v_item shop_item%rowtype;
  v_gold integer;
begin
  if v_student is null then
    raise exception 'Hanya siswa yang bisa membeli item';
  end if;

  select * into v_item from shop_item where id = p_item_id;
  if not found then
    raise exception 'Item tidak ditemukan';
  end if;

  if exists (
    select 1 from student_item
    where student_id = v_student and item_id = p_item_id
  ) then
    raise exception 'Item ini sudah kamu miliki';
  end if;

  -- Kunci baris siswa: dua pembelian bersamaan tidak bisa saling menyalip.
  select gold into v_gold from student where id = v_student for update;
  if v_gold < v_item.price then
    raise exception 'Gold belum cukup (butuh %, punya %)', v_item.price, v_gold;
  end if;

  insert into gold_log (student_id, amount, reason)
  values (v_student, -v_item.price, 'Beli: ' || v_item.name);

  insert into student_item (student_id, item_id)
  values (v_student, p_item_id);

  return jsonb_build_object('ok', true, 'gold', v_gold - v_item.price);
end;
$$;

grant execute on function buy_shop_item(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Seed katalog toko (kode dirender AvatarView di frontend)
-- ---------------------------------------------------------------------------
insert into shop_item (code, name, category, price, sort_index) values
  -- Latar
  ('bg_sunset',        'Senja',            'background',  60, 1),
  ('bg_forest',        'Hutan',            'background',  60, 2),
  ('bg_ocean',         'Samudra',          'background',  60, 3),
  ('bg_space',         'Luar Angkasa',     'background', 120, 4),
  ('bg_candy',         'Permen',           'background', 120, 5),
  -- Rambut
  ('hair_spiky',       'Rambut Jabrik',    'hair',        50, 1),
  ('hair_bob',         'Rambut Bob',       'hair',        50, 2),
  ('hair_long',        'Rambut Panjang',   'hair',        60, 3),
  ('hair_curly',       'Rambut Keriting',  'hair',        60, 4),
  ('hair_mohawk',      'Mohawk',           'hair',        80, 5),
  -- Baju
  ('outfit_hoodie_red',   'Hoodie Merah',  'outfit',      80, 1),
  ('outfit_jacket_blue',  'Jaket Biru',    'outfit',      80, 2),
  ('outfit_tee_star',     'Kaos Bintang',  'outfit',      70, 3),
  ('outfit_robe_purple',  'Jubah Penyihir','outfit',     100, 4),
  -- Topi
  ('hat_cap',          'Topi Kece',        'hat',         80, 1),
  ('hat_headphones',   'Headphone',        'hat',        120, 2),
  ('hat_wizard',       'Topi Penyihir',    'hat',        150, 3),
  ('hat_halo',         'Halo Malaikat',    'hat',        200, 4),
  ('hat_crown',        'Mahkota Raja',     'hat',        300, 5),
  -- Bingkai
  ('frame_bronze',     'Bingkai Perunggu', 'frame',      100, 1),
  ('frame_silver',     'Bingkai Perak',    'frame',      180, 2),
  ('frame_gold',       'Bingkai Emas',     'frame',      260, 3),
  ('frame_rainbow',    'Bingkai Pelangi',  'frame',      400, 4)
on conflict (code) do nothing;
