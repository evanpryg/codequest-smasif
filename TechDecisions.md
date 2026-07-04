# Technical Decisions — CodeQuest
Versi: 0.1 (Draf)
Rujukan: PRD.md, MVP-Scope.md, DataModel.md

Dokumen ini mencatat **pilihan teknologi beserta alasannya**, termasuk alternatif yang dipertimbangkan dan ditolak. Tujuannya agar keputusan tidak berubah-ubah antar sesi dan mudah dijelaskan ke orang lain (termasuk guru kedua).

---

## 1. Ringkasan Stack

| Lapisan | Pilihan | Alasan singkat |
|---|---|---|
| Frontend | React + Vite + TypeScript | Ekosistem matang, cepat, tipe data aman |
| Styling | Tailwind CSS | Cepat untuk membangun UI konsisten; Presentation Mode butuh tampilan bersih |
| Backend & DB | Supabase (PostgreSQL) | Online-first, sudah diputuskan; sekaligus Auth, Realtime, Storage |
| Auth guru | Supabase Auth (email/password) | Standar, aman, siap pakai |
| Auth siswa | Custom via Edge Function | Siswa tidak punya email; login = Kelas → Nama → Password |
| Eksekusi kode | Pyodide (Python di WebAssembly) | Sandbox alami, tanpa server eksekusi, hemat & aman |
| Impor Excel | SheetJS (xlsx) | Baca daftar siswa langsung di browser |
| Live Progress | Supabase Realtime | Pantau status siswa real-time tanpa polling |
| Hosting frontend | Vercel / Netlify | Deploy mudah, gratis untuk skala kecil |

## 2. Keputusan Kunci & Alasannya

### 2.1 Eksekusi Kode — Pyodide (WebAssembly), bukan sandbox server

**Pilihan:** Menjalankan kode Python siswa memakai **Pyodide** — Python yang dikompilasi ke WebAssembly dan berjalan di dalam browser.

**Mengapa ini pilihan terbaik untuk CodeQuest:**
- **Aman secara alami.** Kode berjalan di dalam sandbox browser (WASM), yang secara desain tidak punya akses ke sistem operasi, jaringan, atau filesystem. Ini persis batasan keamanan yang kita inginkan (lihat MVP-Scope §6) — tanpa harus membangun dan menjaga sandbox server sendiri.
- **Tanpa infrastruktur eksekusi.** Tidak perlu server khusus untuk menjalankan kode, tidak perlu mengurus Docker/container, tidak ada biaya server eksekusi. Ini sangat menyederhanakan MVP.
- **Membantu mode LAN nanti.** Karena eksekusi terjadi di sisi klien (browser siswa/guru), saat mode LAN dibangun di fase berikutnya tidak perlu menyiapkan server eksekusi di jaringan sekolah.
- **Cukup untuk materi SMA.** Materi kelas X (variabel, percabangan, perulangan, fungsi, list, dictionary, error handling) sepenuhnya didukung Pyodide.

**Batas waktu & memori** (timeout 5 detik, ~128 MB dari MVP-Scope §6) diterapkan di sisi klien dengan menjalankan Pyodide di dalam **Web Worker** dan menghentikannya (terminate) jika melewati batas — ini menangani kasus infinite loop siswa.

**Catatan integritas (jujur soal kelemahan):** Karena auto-check berjalan di sisi klien, siswa yang sangat teknis secara teori bisa memalsukan status "lolos". **Namun risikonya rendah dan dapat diterima untuk MVP**, karena:
1. XP/gamifikasi **tidak memengaruhi nilai akademik** (PRD prinsip #3) — memalsukan lolos hanya menipu diri sendiri dan mendapat XP palsu.
2. Nilai akademik sebenarnya lewat **manual review** oleh guru, bukan auto-check.
3. Guru tetap bisa memverifikasi lewat **Presentation Mode + Code Runner** kapan saja.

**Jalur peningkatan (Fase 2):** Bila integritas auto-check kelak jadi penting, tambahkan **verifikasi eksekusi di sisi server** memakai mesin eksekusi teruji seperti **Judge0** atau **Piston** (self-hosted). Struktur `test_case` dan `submission_attempt` di DataModel sudah siap untuk ini tanpa perubahan skema.

**Alternatif yang ditolak untuk MVP:**
- *Sandbox server Docker/gVisor sendiri* — paling fleksibel tapi paling berat dirawat dan berisiko keamanan bila salah konfigurasi. Berlebihan untuk MVP.
- *Judge0/Piston sejak awal* — solid, tapi menambah infrastruktur & biaya yang belum perlu di tahap validasi konsep.

### 2.2 Autentikasi Siswa — Custom via Edge Function

**Masalah:** Supabase Auth berbasis email, sedangkan siswa login dengan Kelas → Nama → Password dan tidak punya email.

**Pilihan:** Login siswa lewat **Supabase Edge Function** yang:
1. Menerima `class_id`, `name`, `password`.
2. Memverifikasi terhadap tabel `student` (`password_hash`).
3. Mengembalikan token sesi dengan klaim khusus `student_id`.

RLS untuk siswa kemudian mengunci akses berdasarkan klaim `student_id` ini (lihat DataModel §7). Guru tetap memakai Supabase Auth biasa.

**Alasan:** Menjaga alur login siswa yang sederhana (sesuai PRD) sambil tetap menegakkan isolasi data di level database.

### 2.3 Pengumpulan File `.py`

**Pilihan:** File `.py` yang diupload **dibaca sebagai teks di browser**, lalu isinya disimpan langsung ke kolom teks (`draft_code` / `source_code`). Tidak memakai Supabase Storage.

**Alasan:** File `.py` hanyalah teks. Menyimpannya sebagai teks di database menyederhanakan segalanya (tak perlu mengelola bucket, URL, atau izin file terpisah) dan langsung cocok dengan Code Runner yang butuh source code sebagai teks.

### 2.4 Impor Daftar Siswa dari Excel

**Pilihan:** Parsing file Excel di browser memakai **SheetJS (xlsx)**, lalu buat baris `student` massal. Password awal dibuat otomatis (acak) dan `must_change_password = true`.

### 2.5 Live Progress — Supabase Realtime

**Pilihan:** Dashboard guru memantau perubahan `submission.status` dan `submission.help_requested` secara real-time lewat **Supabase Realtime** (langganan perubahan tabel). Status "online" siswa memakai fitur **presence** Realtime.

**Alasan:** Menghindari polling berulang; dashboard adalah layar yang paling sering dipakai guru (PRD §7.1) sehingga responsivitasnya penting.

## 3. Arsitektur Tingkat Tinggi

```
┌─────────────────────────────┐         ┌──────────────────────────┐
│      Browser Siswa          │         │      Browser Guru        │
│  React UI                   │         │  React UI                │
│  Pyodide (Web Worker)       │         │  Pyodide (Code Runner)   │
│   - self-test kode          │         │   - jalankan kode siswa  │
│   - auto-check test case     │         │  Presentation Mode       │
└──────────────┬──────────────┘         └────────────┬─────────────┘
               │                                      │
               │        Supabase                      │
               └──────────────┬───────────────────────┘
                              ▼
        ┌───────────────────────────────────────────┐
        │  PostgreSQL + Row Level Security            │
        │  Auth (guru)  |  Edge Function (auth siswa) │
        │  Realtime (live progress)                   │
        └───────────────────────────────────────────┘
```

Semua isolasi antar guru dan antar siswa ditegakkan oleh **RLS di PostgreSQL** (DataModel §7), bukan hanya di frontend.

## 4. Yang Ditunda ke Fase Berikutnya

| Item | Kapan | Catatan |
|---|---|---|
| Mode LAN | Fase 2 | Eksekusi sudah client-side (Pyodide), jadi tinggal urus penyimpanan lokal & sinkronisasi |
| Eksekusi server (Judge0/Piston) | Fase 2 (opsional) | Hanya jika integritas auto-check jadi kebutuhan |
| Export Excel rekap nilai | Fase 2 | SheetJS sudah tersedia, tinggal arah sebaliknya |
| Gold, Shop, Avatar, Inventory | Fase 2 | Skema tinggal ditambah, tidak mengubah yang ada |

## 5. Isu Terbuka

1. ~~Formula Level dari XP~~ — **Selesai** (DataModel §6.1).
2. ~~Daftar achievement awal~~ — **Selesai** (DataModel §6.2).
3. **Ukuran unduhan Pyodide** — Pyodide cukup besar saat pertama dimuat; perlu strategi caching agar tidak memberatkan koneksi sekolah pada pemuatan pertama. (Bukan penghalang, hanya perlu diperhatikan saat implementasi.)
4. **Draf kebijakan privasi** untuk sekolah (dokumen terpisah, belum dibuat — tidak menghalangi pembangunan MVP).
