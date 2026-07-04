# CodeQuest

Pendamping proses belajar coding di kelas (bukan editor kode). Siswa tetap menulis program di
VS Code/IDLE; CodeQuest mengelola alur pembelajaran, pengumpulan tugas, pemantauan progres,
presentasi kode, dan gamifikasi.

Sumber kebenaran: [`PRD.md`](PRD.md), [`MVP-Scope.md`](MVP-Scope.md),
[`DataModel.md`](DataModel.md), [`TechDecisions.md`](TechDecisions.md).

## Status: Milestone 1 — Fondasi

Milestone ini membangun **fondasi data & keamanan**, belum UI fitur:

- Skema database lengkap sesuai `DataModel.md` (`supabase/migrations/0001_schema.sql`).
- Fungsi & trigger: profil guru otomatis, template chapter (3 kecil + 1 boss),
  XP → level (`0002_functions_triggers.sql`).
- **Row Level Security** — isolasi antar guru & antar siswa (`0003_rls.sql`). Ini fondasi keamanan
  wajib (MVP-Scope §3.6, DataModel §7), ditegakkan di database, bukan hanya di UI.
- Seed 9 achievement (`0004_seed_achievements.sql`).
- Auth siswa via Edge Function (`supabase/functions/student-login/`).
- Tes RLS pgTAP membuktikan isolasi (`supabase/tests/rls_test.sql`).
- Kerangka frontend React + Vite + TS + Tailwind (belum ada fitur).

UI modul (Core/Learning/Classroom/Gamification) menyusul di milestone berikutnya.

## Stack

React + Vite + TypeScript, Tailwind CSS, Supabase (PostgreSQL + Auth + Edge Functions + Realtime),
Pyodide untuk eksekusi kode (dipakai di milestone UI). Detail & alasan: `TechDecisions.md`.

## Prasyarat

- Node.js 18+ dan npm
- [Supabase CLI](https://supabase.com/docs/guides/cli) + Docker (untuk pengembangan lokal)

## Setup

```bash
# 1. Dependencies frontend
npm install

# 2. Environment frontend
cp .env.example .env
#   Isi VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY dari dashboard Supabase
#   (Project Settings > API). Untuk lokal, nilainya dicetak oleh `supabase start`.

# 3. Database lokal (menjalankan migrasi 0001–0004 + seed)
supabase start
supabase db reset
```

> Belum ada project Supabase? Buat di https://supabase.com lalu `supabase link --project-ref <ref>`,
> atau cukup pakai `supabase start` untuk instance lokal.

## Verifikasi

```bash
# Frontend termuat (cek env terbaca)
npm run dev

# Tes RLS — membuktikan isolasi guru & siswa
supabase test db
```

`supabase test db` menjalankan `supabase/tests/rls_test.sql` (23 assertion). Yang dibuktikan:

- Guru A tidak bisa membaca/mengubah kelas, quest, atau submission Guru B.
- Siswa tidak bisa membaca/menulis submission, XP, atau baris siswa lain — **bahkan di kelas yang
  sama**, bahkan bila UI/klien dimanipulasi (database menolak).
- Guru (pemilik kelas) tetap bisa membaca submission siswanya — dasar Presentation Mode/Code Runner.
- Trigger template chapter menghasilkan 3 quest kecil + 1 boss.
- Trigger XP → level menghitung level sesuai formula `DataModel §6.1`.

### Auth siswa (Edge Function)

```bash
supabase functions serve student-login          # lokal
# atau deploy:
supabase functions deploy student-login
```

Uji: `POST { "class_id", "name", "password" }` → mengembalikan `access_token` (JWT berisi klaim
`student_id`) bila benar; `401` bila salah. Frontend memasang token ini sebagai sesi Supabase
sehingga RLS siswa berlaku. Guru memakai Supabase Auth email/password (bukan fungsi ini).

## Catatan Penting Keamanan / Desain

- **Daftar kelas & nama untuk layar login siswa tidak diekspos ke `anon`.** RLS menolak akses
  anonim ke tabel `student`/`class` agar roster kelas tidak bocor. Layar login (milestone UI)
  akan mengambil daftar pilihan lewat Edge Function (service role), bukan query langsung.
- **`test_case.is_hidden` = penyembunyian di UI, bukan kriptografis.** Auto-check berjalan
  client-side (Pyodide, `TechDecisions §2.1`), sehingga klien tetap menerima input/expected test
  case tersembunyi untuk menjalankannya; `is_hidden` hanya menyembunyikannya dari daftar yang
  ditampilkan ke siswa. Ini konsisten dengan risiko client-side yang sudah diterima di
  `TechDecisions §2.1`. Penyembunyian sejati menuntut eksekusi sisi server (Judge0/Piston),
  yang ditunda ke Fase 2.
- **Integritas auto-check bersifat client-side (risiko diterima untuk MVP).** XP/gamifikasi tidak
  memengaruhi nilai akademik; nilai akademik lewat manual review guru (`TechDecisions §2.1`).

## Di Luar Scope MVP (Fase 2+)

Sesuai `MVP-Scope §4`, TIDAK dibangun (termasuk di skema): Gold, Shop, Avatar, Inventory, Pet,
Emote, Tema Profil, Title, Mode LAN, Export Excel rekap nilai, dan analitik butir soal.

## Struktur

```
src/                     Frontend React (kerangka M1)
  lib/supabase.ts        Klien Supabase (anon key; isolasi via RLS)
supabase/
  config.toml            Konfigurasi Supabase CLI
  migrations/            0001 skema · 0002 fungsi/trigger · 0003 RLS · 0004 seed
  functions/student-login/   Auth siswa (Edge Function)
  tests/rls_test.sql     Tes RLS pgTAP
```
