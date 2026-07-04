# Data Model — CodeQuest
Versi: 0.1 (Draf)
Rujukan: PRD.md, MVP-Scope.md
Basis data: PostgreSQL (via Supabase)

Dokumen ini mendefinisikan skema data untuk MVP. Fokus utama: **isolasi data yang benar sejak awal** — antar guru dan antar siswa — karena memperbaiki ini setelah data terlanjur mengalir jauh lebih sulit.

---

## 1. Prinsip Pemodelan

1. **Hierarki kepemilikan berujung ke guru.** Setiap Tahun Ajaran → Semester → Kelas → Chapter → Quest dimiliki oleh satu guru. Ini yang membuat guru A tidak bisa melihat data guru B.
2. **Isolasi siswa di level baris.** Siswa hanya bisa membaca/menulis data miliknya sendiri. Ini ditegakkan lewat RLS di database, bukan hanya disembunyikan di UI.
3. **Data siswa minimal.** Hanya nama & kelas. Tidak menyimpan NISN, tanggal lahir, atau data sensitif lain.
4. **Quest terpadu.** Quest biasa dan Boss Quest satu tabel, dibedakan flag `is_boss`.
5. **Riwayat dipertahankan.** Tiap percobaan submit disimpan (bukan hanya hasil akhir), sesuai kebutuhan guru melihat proses berpikir siswa.

## 2. Diagram Relasi (ringkas)

```mermaid
erDiagram
    teacher ||--o{ academic_year : owns
    academic_year ||--o{ semester : has
    semester ||--o{ class : has
    class ||--o{ student : enrolls
    class ||--o{ chapter : contains
    chapter ||--o{ quest : contains
    quest ||--o{ test_case : has
    student ||--o{ submission : makes
    quest ||--o{ submission : receives
    submission ||--o{ submission_attempt : logs
    submission_attempt ||--o| review : reviewed_by
    student ||--o{ xp_log : earns
    student ||--o{ student_achievement : unlocks
    achievement ||--o{ student_achievement : defines
```

## 3. Tabel Inti (Core)

### teacher
Profil guru. Autentikasi ditangani Supabase Auth; tabel ini menyimpan profil tambahan yang mereferensikan `auth.users`.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | Sama dengan `auth.users.id` |
| name | text | Nama guru |
| email | text | Untuk login |
| created_at | timestamptz | |

### academic_year (Tahun Ajaran)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| teacher_id | uuid (FK → teacher) | **Pemilik** |
| label | text | Contoh: "2025/2026" |
| created_at | timestamptz | |

### semester
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| academic_year_id | uuid (FK → academic_year) | |
| name | text | "Ganjil" / "Genap" |
| created_at | timestamptz | |

### class (Kelas)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| semester_id | uuid (FK → semester) | |
| name | text | Contoh: "X-1" |
| created_at | timestamptz | |

### student
Login siswa: pilih Kelas → pilih Nama → Password. Karena itu keunikan nama cukup di dalam satu kelas.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| class_id | uuid (FK → class) | |
| name | text | Nama siswa |
| password_hash | text | Password awal dibuat otomatis saat impor Excel |
| must_change_password | bool | Default true; memaksa ganti password pertama kali |
| total_xp | int | Default 0 |
| level | int | Default 1; diturunkan dari `total_xp` (lihat §6) |
| created_at | timestamptz | |

> Keunikan: `unique(class_id, name)` — dua siswa bernama sama boleh ada di kelas berbeda, tapi tidak dalam satu kelas.

## 4. Tabel Pembelajaran (Learning)

### chapter (Pertemuan / Bab)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| class_id | uuid (FK → class) | |
| title | text | Judul chapter |
| description | text | Materi/pengantar (diisi guru) |
| order_index | int | Urutan tampil |
| created_at | timestamptz | |

> Saat guru membuat chapter baru, sistem otomatis membuat **3 quest latihan kecil + 1 quest latihan besar (boss)** sebagai template. Semua bisa diedit/dihapus guru.

### quest
Satu tabel untuk latihan kecil dan latihan besar (boss).

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| chapter_id | uuid (FK → chapter) | |
| title | text | |
| description | text | Soal/instruksi |
| order_index | int | Urutan dalam chapter |
| is_boss | bool | true = latihan besar (Boss Quest) |
| grading_mode | text (enum) | `auto` / `manual` |
| reward_xp | int | XP saat quest selesai |
| ignore_output_order | bool | Untuk auto check; default false |
| float_tolerance | numeric | Toleransi floating point; default 0.001 |
| rubric | jsonb | Daftar kriteria untuk manual review (lihat §5) |
| created_at | timestamptz | |

> Reward Gold tidak ada di MVP (ditunda ke Fase 2). Kolom `reward_gold` bisa ditambahkan nanti tanpa mengubah struktur.

### test_case
Hanya relevan untuk quest `grading_mode = auto`.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| quest_id | uuid (FK → quest) | |
| stdin | text | Input yang disuplai ke program (bukan diketik interaktif) |
| expected_output | text | Output yang diharapkan |
| is_hidden | bool | true = tidak ditampilkan ke siswa (mencegah hard-code jawaban) |
| order_index | int | |

## 5. Tabel Pengumpulan & Penilaian (Submission & Grading)

### submission
Menyimpan **status terkini** satu siswa untuk satu quest. Draft autosave juga disimpan di sini.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| student_id | uuid (FK → student) | |
| quest_id | uuid (FK → quest) | |
| status | text (enum) | `not_started` / `in_progress` / `submitted` / `waiting_review` / `passed` / `failed` |
| draft_code | text | Autosave kode yang sedang dikerjakan |
| draft_updated_at | timestamptz | |
| help_requested | bool | Tombol "Butuh Bantuan"; muncul di dashboard guru |
| help_requested_at | timestamptz | |
| updated_at | timestamptz | |

> Keunikan: `unique(student_id, quest_id)` — satu baris status per siswa per quest.

### submission_attempt
Riwayat tiap kali siswa menekan Submit. Inilah yang menyimpan proses, bukan hanya hasil akhir.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| submission_id | uuid (FK → submission) | |
| source_code | text | Kode yang disubmit saat itu |
| auto_result | jsonb | Hasil per test case (lolos/gagal, output aktual) |
| passed | bool | Ringkasan: lolos semua test case atau tidak |
| created_at | timestamptz | Waktu submit |

### review
Penilaian manual oleh guru untuk quest `grading_mode = manual`. Terhubung ke attempt tertentu.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| attempt_id | uuid (FK → submission_attempt) | |
| reviewer_teacher_id | uuid (FK → teacher) | |
| scores | jsonb | Nilai per kriteria rubrik |
| comment | text | Komentar guru |
| created_at | timestamptz | |

**Contoh isi `quest.rubric` dan `review.scores`:**
```json
// quest.rubric
[
  { "key": "logika",   "label": "Kebenaran logika", "max": 4 },
  { "key": "gaya_kode","label": "Gaya penulisan kode", "max": 2 }
]

// review.scores
{ "logika": 4, "gaya_kode": 1 }
```

## 6. Tabel Gamifikasi (versi MVP)

Hanya XP, Level, dan Achievement. Gold, Shop, Avatar, Inventory, Title ditunda ke Fase 2.

### xp_log
Riwayat perolehan XP (untuk transparansi & audit).

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| student_id | uuid (FK → student) | |
| amount | int | XP yang diberikan |
| reason | text | Contoh: "Quest selesai" |
| source_quest_id | uuid (FK → quest, nullable) | |
| created_at | timestamptz | |

> `student.total_xp` = jumlah seluruh `xp_log.amount`. `student.level` diturunkan dari `total_xp` (lihat formula §6.1).

### 6.1 Formula Level dari XP

Prinsip: naik level terasa cepat di awal (motivasi), makin berat di level tinggi.

**XP untuk naik dari level L ke L+1** = `100 × L`
- Level 1 → 2: 100 XP
- Level 2 → 3: 200 XP
- Level 3 → 4: 300 XP, dst.

**Total XP kumulatif untuk mencapai level N** = `50 × N × (N − 1)`

| Level | Total XP dibutuhkan |
|---|---|
| 1 | 0 |
| 2 | 100 |
| 3 | 300 |
| 4 | 600 |
| 5 | 1.000 |
| 6 | 1.500 |
| 10 | 4.500 |

**Menghitung level dari total_xp** (untuk implementasi):
```
level = floor( (1 + sqrt(1 + 0.08 × total_xp)) / 2 )
```

**Reward XP default per quest** (guru bisa ubah di `quest.reward_xp`):
- Latihan kecil: **25 XP**
- Latihan besar (boss): **100 XP**

Dengan default ini, satu chapter (3 kecil + 1 boss) ≈ 175 XP, cukup untuk naik ~2 level di awal dan melambat wajar di level tinggi.

### 6.2 Daftar Achievement Awal (seed MVP)

Semua dapat dihitung dari data yang sudah ada (`submission_attempt`, `student_achievement`, `total_xp`).

| code | Nama | Syarat |
|---|---|---|
| `first_quest` | Langkah Pertama | Menyelesaikan quest pertama |
| `first_boss` | Penakluk Boss | Menyelesaikan boss quest pertama |
| `chapter_clear` | Bab Tuntas | Menyelesaikan semua quest dalam satu chapter |
| `quests_10` | Rajin Ngoding | Menyelesaikan 10 quest |
| `quests_25` | Kutu Kode | Menyelesaikan 25 quest |
| `level_5` | Naik Kelas | Mencapai Level 5 |
| `flawless` | Sekali Jalan | Lolos quest auto pada percobaan pertama |
| `persistence` | Pantang Menyerah | Lolos quest auto setelah 5+ percobaan |
| `full_chapter_boss` | Sang Juara | Menuntaskan seluruh chapter beserta boss-nya |

### achievement (definisi)
Daftar achievement yang tersedia. Untuk MVP bersifat sistem/global (dipakai semua guru).

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| code | text | Kode unik, contoh: `first_quest` |
| name | text | Nama tampil |
| description | text | |
| icon | text | Nama/ikon |

### student_achievement
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| student_id | uuid (FK → student) | |
| achievement_id | uuid (FK → achievement) | |
| earned_at | timestamptz | |

> Keunikan: `unique(student_id, achievement_id)` — satu achievement hanya bisa didapat sekali.

## 7. Isolasi Data (Row Level Security)

Dua aturan isolasi ini adalah inti keamanan CodeQuest dan ditegakkan di database, bukan hanya di UI.

**A. Isolasi antar guru.** Guru hanya bisa mengakses data di bawah hierarki miliknya. Ditelusuri lewat rantai kepemilikan: `submission` → `quest` → `chapter` → `class` → `semester` → `academic_year` → `teacher_id = auth.uid()`. Guru A tidak bisa membaca/mengubah apa pun milik guru B.

**B. Isolasi antar siswa.** Siswa hanya bisa membaca/menulis baris yang `student_id`-nya = dirinya sendiri, berlaku untuk `submission`, `submission_attempt`, `xp_log`, `student_achievement`. Akibatnya, **tidak ada jalur apa pun** bagi siswa untuk membaca submission siswa lain — bahkan jika UI dimanipulasi, database menolak.

**Pengecualian terkontrol.** Presentation Mode & Code Runner menampilkan kode siswa ke kelas, tetapi ini dijalankan atas nama **guru** (yang memang berhak atas data siswa di kelasnya), bukan akses langsung antar siswa.

## 8. Catatan Runtime (bukan tabel)

- **Code Runner / sandbox**: eksekusi kode bersifat sementara (ephemeral), tidak perlu tabel khusus. Kode yang dijalankan berasal dari `submission_attempt.source_code` atau `submission.draft_code`.
- **Live Progress dashboard**: dibangun dari query agregat atas `submission.status` dan `submission.help_requested` untuk kelas yang sedang aktif.
- **Status "online"** siswa: paling praktis via Supabase Realtime/presence, tidak perlu kolom permanen.

## 9. Isu Terbuka untuk Diputuskan

1. ~~Siswa lintas guru~~ — **Selesai.** Dua guru mengajar kelas berbeda (tidak ada siswa yang sama), jadi model kepemilikan per-guru sudah cukup; tidak perlu konsep "siswa sekolah" bersama.
2. ~~Formula Level dari XP~~ — **Selesai.** Lihat §6.1.
3. ~~Definisi achievement awal~~ — **Selesai.** Lihat §6.2.

Tidak ada isu terbuka tersisa pada model data.
