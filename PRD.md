# PRD — CodeQuest
**Product Requirements Document**
Versi: 0.1 (Draf)
Status: Diskusi awal, belum final

---

## 1. Latar Belakang & Masalah

Pembelajaran pemrograman di kelas menghadapi beberapa masalah operasional yang berulang:

- Guru harus berpindah-pindah aplikasi (spreadsheet nilai, proyektor/HDMI untuk presentasi kode siswa, aplikasi chat untuk pengumpulan tugas) sehingga alur mengajar terpecah.
- Guru sulit memantau progres real-time: siapa yang sedang mengerjakan, siapa yang stuck, siapa yang sudah selesai.
- Presentasi kode siswa ke depan kelas biasanya bergantung pada HDMI/kabel, memakan waktu transisi.
- Menjalankan dan menguji kode siswa dengan input berbeda-beda secara langsung di depan kelas merepotkan tanpa alat bantu.
- Motivasi belajar coding cenderung menurun tanpa elemen permainan/gamifikasi yang sesuai usia.
- Sekolah dengan koneksi internet tidak stabil membutuhkan alternatif mode operasi tanpa bergantung pada cloud.

## 2. Visi Produk

CodeQuest adalah **pendamping proses belajar coding di kelas**, bukan editor kode. Siswa tetap menulis program di VS Code/IDLE; CodeQuest mengelola alur pembelajaran, pengumpulan tugas, pemantauan progres, presentasi kode, dan motivasi melalui gamifikasi — semuanya dari satu aplikasi web, tanpa guru perlu berpindah alat.

## 3. Target Pengguna

| Peran | Deskripsi |
|---|---|
| Guru | Mengelola kelas, materi, quest, penilaian, dan sesi presentasi |
| Siswa | Mengerjakan quest, submit kode, melihat progres & gamifikasi milik sendiri |

Catatan: siswa adalah anak di bawah umur (usia SMA, ~15–18 tahun). Semua desain fitur harus mempertimbangkan privasi dan keamanan data siswa.

## 4. Prinsip Desain

1. **Bukan editor kode.** Penulisan kode tetap terjadi di VS Code/IDLE.
2. **Satu aplikasi, tanpa berpindah tab/alat** selama sesi mengajar berlangsung.
3. **Gamifikasi tidak memengaruhi nilai akademik** — murni motivasi.
4. **Isolasi data antar siswa.** Siswa tidak dapat mengakses, melihat, atau menyalin hasil pekerjaan siswa lain dalam bentuk apa pun (lihat §8.1).
5. **Tidak menghakimi kemiripan kode.** Karena tugas coding sekolah secara alami sering menghasilkan solusi yang identik/mirip (semua siswa mengerjakan soal yang sama untuk melatih pola pikir yang sama), sistem **tidak** melakukan deteksi plagiarisme berbasis kemiripan kode. Pencegahan contek-mencontek dilakukan lewat kontrol akses, bukan lewat menuduh berdasarkan kemiripan hasil.
6. **Mendukung mode Online dan LAN** tanpa mengubah pengalaman pengguna.

## 5. Alur Pengguna

### 5.1 Alur Guru

**Sebelum semester:**
1. Login
2. Membuat Tahun Ajaran → Semester → Kelas
3. Impor daftar siswa dari Excel (password awal dibuat otomatis)
4. Menyiapkan Chapter, Quest, dan Boss Quest
5. Menentukan reward (XP & Gold) dan test case otomatis

**Saat pembelajaran:**
1. Memilih Tahun Ajaran → Semester → Kelas → Pertemuan (Chapter)
2. Menjelaskan materi, membuka Quest
3. Memantau siapa sedang mengerjakan / sudah submit
4. Memilih siswa (acak atau manual) untuk presentasi
5. Menampilkan & menjalankan kode siswa lewat sandbox (tanpa HDMI)
6. Mengubah input untuk menguji kondisi berbeda, mendiskusikan bersama kelas
7. Membuka quest berikutnya jika mayoritas siap

### 5.2 Alur Siswa

1. Login: Pilih Kelas → Pilih Nama → Password
2. Masuk dashboard: chapter aktif, quest terbuka, progres, XP, Gold, Level, Achievement, Avatar, Inventory
3. Memilih quest, mengerjakan kode di VS Code
4. Submit (upload `.py` atau paste source code)
5. Jika quest otomatis → sistem cek dengan test case → jika lolos: XP/Gold naik, achievement dicek, progres update
6. Jika quest manual → status "Menunggu Review Guru"

## 6. Modul Aplikasi

- **Core**: Authentication, Manajemen Guru/Siswa/Kelas, Tahun Ajaran & Semester
- **Learning**: Chapter, Quest, Boss Quest, Auto Check, Manual Review
- **Classroom**: Live Progress, Random Student Picker, Presentation Mode, Code Runner
- **Gamification**: XP, Level, Gold, Shop, Avatar, Inventory, Achievement, Title
- **Analytics**: Progres siswa, riwayat nilai, statistik kelas, rekap semester

(Detail tiap modul mengikuti breakdown pada dokumen konsep awal.)

## 7. Fitur Kunci

### 7.1 Dashboard Guru
Layar paling sering digunakan: persentase progres kelas, jumlah siswa online/mengerjakan/submit/belum mulai, quest aktif, daftar siswa berbentuk kartu status (mengerjakan/submit/menunggu review).

### 7.2 Presentation Mode
Tampilan bersih untuk proyektor: nama siswa, source code, output, tombol Run, input pengujian, tombol Nilai, kolom komentar.

### 7.3 Code Runner (Sandbox)
Menjalankan kode siswa dari browser melalui sandbox aman (bukan langsung di OS guru). Guru dapat mengganti input, mencoba test case lain, melihat output, mendiskusikan kesalahan.

### 7.4 Gamifikasi
XP → naik level; Gold → beli kosmetik di Shop (rambut, pakaian, topi, frame, background, pet, emote, tema profil); Achievement & Title sebagai pencapaian. Tidak memengaruhi nilai akademik.

### 7.5 Sistem Jaringan Ganda
- **Mode Online**: penyimpanan cloud via Supabase
- **Mode LAN**: server lokal saat internet bermasalah, seluruh siswa tetap akses via jaringan sekolah

## 8. Fitur Tambahan Hasil Diskusi

### 8.1 Isolasi Submission Antar Siswa (Pengganti Deteksi Plagiarisme)
Karena kemiripan kode antar siswa adalah hal wajar dalam pembelajaran coding (bukan indikator valid dari mencontek), pendekatan yang dipakai adalah **pencegahan di level akses**, bukan deteksi di level konten:

- Siswa **tidak pernah** dapat melihat submission siswa lain — baik source code, output, maupun status nilai — melalui antarmuka apa pun yang tersedia untuk role siswa.
- Endpoint/API yang mengembalikan data submission harus divalidasi agar hanya pemilik submission atau guru yang dapat mengaksesnya (otorisasi di level backend, bukan hanya disembunyikan di UI).
- Presentation Mode dan Code Runner tetap dapat menampilkan kode siswa ke seluruh kelas, tetapi ini adalah aksi yang **dipicu dan dikontrol oleh guru**, bukan akses langsung antar siswa.
- Tidak ada fitur "lihat submission teman" atau leaderboard yang mengekspos source code.

### 8.2 Tombol "Butuh Bantuan"
Siswa dapat menandai dirinya sedang kesulitan; status ini muncul di kartu siswa pada Dashboard Guru sehingga guru tahu siapa yang perlu dihampiri, bukan hanya siapa yang belum submit.

### 8.3 Autosave / Draft Submission
Kode yang sedang dikerjakan (paste/upload) disimpan otomatis secara berkala agar tidak hilang saat koneksi terputus, khususnya relevan untuk mode LAN yang lebih rentan gangguan.

### 8.4 Rubrik Manual Review
Review manual oleh guru menggunakan kriteria terstruktur (misal: kebenaran logika, kesesuaian gaya penulisan kode), bukan sekadar keputusan lolos/tidak lolos.

### 8.5 Export Rekap Nilai
Guru dapat mengekspor rekap nilai per kelas/semester ke format Excel untuk kebutuhan administrasi/rapor.

### 8.6 Riwayat Percobaan Submission
Sistem menyimpan riwayat percobaan submit per siswa per quest (bukan hanya hasil akhir), agar guru dapat melihat proses berpikir siswa saat diperlukan.

### 8.7 Analitik Butir Soal
Statistik quest mana yang paling banyak gagal atau paling lama dikerjakan, sebagai umpan balik untuk desain materi.

## 9. Keputusan yang Sudah Ditetapkan

- **Mode jaringan**: Online (Supabase) dulu untuk MVP; mode LAN menyusul di fase berikutnya.
- **Quest vs Boss Quest**: digabung sebagai satu sistem quest dengan flag `is_boss`. Boss Quest = latihan besar (lebih menantang, reward lebih besar); tidak ada mekanisme terpisah untuk saat ini.
- **Multi-guru**: aplikasi dipakai 2 guru aktif. Tiap guru mengelola kelas & kontennya sendiri; konten antar guru tidak tercampur.
- **Struktur konten**: sistem tidak memuat isi materi bawaan — guru mengisi sendiri. Template default tiap chapter: 3 latihan kecil + 1 latihan besar (dapat diubah).
- **Data siswa**: hanya nama & kelas yang disimpan. Kepemilikan data dipegang developer; perlu kebijakan privasi singkat untuk sekolah.
- **Auto Check**: normalisasi whitespace, toleransi floating point 0.001, urutan output diperhatikan (dengan opsi abaikan urutan per-quest). Detail di MVP-Scope §6.
- **Sandbox**: timeout 5 detik, memori 128 MB, tanpa akses jaringan/filesystem, input disuplai dari test case. Detail di MVP-Scope §6.

## 9b. Isu yang Masih Terbuka

- Bentuk final kebijakan privasi tertulis untuk sekolah (draf akan disusun terpisah).
- Teknologi sandbox spesifik yang dipakai (ditentukan saat desain teknis).

## 10. Referensi
Dokumen ini disusun berdasarkan dokumen konsep awal "CodeQuest — Konsep Besar" dan hasil diskusi lanjutan mengenai prioritas fitur dan kebijakan integritas akademik.
