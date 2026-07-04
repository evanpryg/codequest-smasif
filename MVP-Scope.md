# MVP Scope — CodeQuest
Versi: 0.1 (Draf)
Rujukan: PRD.md

Tujuan dokumen ini: menentukan batas jelas apa yang **dibangun di Fase 1 (MVP)** dan apa yang **ditunda ke fase berikutnya**, agar pengembangan tidak melebar sebelum fondasi inti stabil.

---

## 1. Prinsip Penentuan Scope

- MVP harus bisa dipakai untuk **satu kelas, satu guru, satu mode jaringan** dengan alur belajar lengkap dari awal sampai akhir pertemuan.
- Fitur yang murni "penyempurna pengalaman" (kosmetik lanjutan, analitik mendalam) ditunda.
- Keamanan dasar (isolasi data antar siswa, sandbox aman) **tidak boleh** ditunda — ini bagian dari fondasi, bukan penyempurna.

## 2. Keputusan Fondasi Arsitektur

| Keputusan | Pilihan MVP | Alasan |
|---|---|---|
| Mode jaringan awal | **Online dulu (Supabase)**, LAN menyusul | Online lebih cepat dibangun (tak perlu urus distribusi server lokal & jaringan sekolah di awal), cocok untuk validasi konsep; LAN ditambahkan setelah alur inti terbukti |
| Gamifikasi | XP + Level + Achievement dasar | Shop, pet, emote, tema profil butuh sistem inventory & ekonomi virtual yang lebih kompleks |
| Quest vs Boss Quest | Digabung sebagai satu sistem quest dengan flag `is_boss` | Beda utama saat ini hanya kesulitan & reward; belum ada mekanisme unik yang membutuhkan sistem terpisah |
| Deteksi kecurangan | Isolasi akses (lihat §4), bukan deteksi kemiripan kode | Kemiripan kode adalah hal normal dalam tugas coding; deteksi otomatis berisiko salah tuduh |
| Multi-guru | **Masuk MVP** (2 guru aktif) | Aplikasi dipakai lebih dari satu guru sejak awal; tiap guru mengelola kelas & konten miliknya sendiri |
| Konten materi/latihan | **Custom oleh guru**, sistem hanya sediakan struktur | Beda guru bisa menugaskan latihan berbeda; sistem tidak memuat isi materi bawaan |

## 3. Fitur MVP (Fase 1)

### 3.1 Core
- [x] Authentication guru & siswa
- [x] Multi-guru: tiap guru mengelola kelas & konten miliknya sendiri; konten guru satu tidak tercampur dengan guru lain
- [x] Manajemen Tahun Ajaran, Semester, Kelas
- [x] Impor daftar siswa dari Excel + password awal otomatis (data siswa: **nama & kelas saja**)
- [x] Manajemen Chapter dengan template default: **3 latihan kecil + 1 latihan besar** per chapter (guru bisa ubah)

### 3.2 Learning
- [x] Quest (termasuk Boss Quest via flag)
- [x] Auto Check dengan test case sederhana (exact match output)
- [x] Manual Review dengan rubrik dasar (lihat §3.5)
- [x] Submission via upload `.py` atau paste kode
- [x] Autosave draft submission

### 3.3 Classroom
- [x] Live Progress (dashboard guru: online / mengerjakan / submit / belum mulai)
- [x] Tombol "Butuh Bantuan" dari siswa
- [x] Random Student Picker
- [x] Presentation Mode (tampilan bersih untuk proyektor)
- [x] Code Runner sandbox dengan batas waktu eksekusi (timeout)

### 3.4 Gamification (versi dasar)
- [x] XP & Level
- [x] Achievement dasar (misal: "quest pertama selesai", "5 quest beruntun")
- [ ] ~~Gold & Shop~~ → Fase 2
- [ ] ~~Avatar & Inventory~~ → Fase 2
- [ ] ~~Pet, Emote, Tema Profil~~ → Fase 2/3

### 3.5 Grading
- [x] Rubrik manual review sederhana (skala/kriteria dasar: logika benar, gaya kode)
- [x] Riwayat percobaan submission per siswa per quest

### 3.6 Keamanan & Isolasi Data (wajib MVP, tidak bisa ditunda)
- [x] Siswa tidak dapat mengakses submission siswa lain lewat jalur apa pun (UI maupun API)
- [x] Otorisasi backend memvalidasi kepemilikan data pada setiap request submission
- [x] Sandbox eksekusi kode dengan resource & time limit untuk mencegah infinite loop/kode berbahaya

### 3.7 Analytics (versi dasar)
- [x] Rekap nilai per kelas (lihat di layar, belum wajib export)

## 4. Ditunda ke Fase 2+

| Fitur | Alasan ditunda |
|---|---|
| Mode LAN (server lokal) | Online (Supabase) dibangun dulu sebagai fondasi; LAN menyusul setelah alur inti terbukti stabil |
| Gold, Shop, Avatar, Inventory, Pet, Emote | Butuh sistem ekonomi virtual & aset kosmetik terpisah |
| Title (gelar) | Perluasan dari sistem Achievement, bisa menyusul |
| Export rekap nilai ke Excel | Bisa manual dulu di MVP; ditambahkan begitu volume data guru meningkat |
| Analitik butir soal (quest paling sering gagal) | Butuh data historis yang cukup dulu untuk bermakna |
| Statistik & rekap semester lanjutan | Fase 2, setelah data satu semester penuh terkumpul dari MVP |

## 5. Definisi "Selesai" untuk MVP

MVP dianggap selesai jika:
1. Satu guru dapat menjalankan **satu pertemuan penuh** dari membuka chapter sampai menutup quest terakhir, tanpa berpindah aplikasi selain VS Code milik siswa.
2. Siswa dapat login, mengerjakan, submit, dan melihat hasil (XP/Level/Achievement dasar) miliknya sendiri — dan **tidak dapat** mengakses data siswa lain dengan cara apa pun.
3. Guru dapat menampilkan kode siswa di Presentation Mode dan menjalankannya lewat Code Runner dengan input berbeda, tanpa HDMI.
4. Sistem berjalan stabil dalam mode Online (Supabase) untuk satu kelas penuh.

## 6. Keputusan Teknis (Sudah Ditetapkan)

**Auto Check — normalisasi output:**
- Whitespace: trim spasi di akhir tiap baris dan baris kosong di akhir output; spasi di tengah baris tetap dihitung
- Floating point: dibandingkan dengan toleransi 0.001 (guru menandai quest yang outputnya desimal)
- Urutan output: diperhatikan secara default; ada opsi per-quest "abaikan urutan" untuk soal berurutan bebas

**Sandbox:**
- Timeout eksekusi: 5 detik
- Batas memori: 128 MB
- Tanpa akses jaringan & filesystem
- Input disuplai lebih dulu dari test case (bukan diketik interaktif saat run), karena banyak latihan pemula memakai `input()`

**Data & privasi:**
- Data siswa yang disimpan: **nama & kelas saja** (tidak menyimpan NISN, tanggal lahir, atau data sensitif lain)
- Kepemilikan data: dipegang oleh developer; perlu kebijakan singkat tertulis untuk ditunjukkan ke sekolah

**Struktur konten:**
- Sistem tidak memuat isi materi bawaan; guru mengisi sendiri
- Template default tiap chapter: 3 latihan kecil + 1 latihan besar (dapat diubah guru)
