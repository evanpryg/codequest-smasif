# Panduan Guru — CodeQuest

Alamat aplikasi: **https://codequest-smasif.vercel.app**

Panduan ini untuk guru yang baru mulai memakai CodeQuest: membuat akun guru,
menyiapkan kelas, membagikan akun siswa, sampai alur mengajar harian.

---

## 1. Menambah Akun Guru

Akun guru sengaja **tidak bisa daftar sendiri** dari halaman login (agar orang luar
tidak bisa masuk sebagai guru). Akun dibuat lewat dashboard Supabase:

1. Buka **https://supabase.com/dashboard** → pilih project CodeQuest.
2. Menu kiri: **Authentication** → **Users** → klik **Add user** → **Create new user**.
3. Isi **email** dan **password** guru.
4. **Centang "Auto Confirm User"** (penting — tanpa ini guru tidak bisa login).
5. Klik **Create user**. Selesai — profil guru dibuat otomatis oleh sistem.

Guru langsung bisa login di situs lewat tab **Guru** dengan email & password itu.
Ulangi langkah yang sama untuk guru kedua. Data antar guru otomatis terpisah —
guru A tidak bisa melihat kelas/konten guru B.

> Ganti password guru: dashboard Supabase → Authentication → Users → klik user →
> menu ⋮ → Reset password / Update password.

## 2. Menyiapkan Semester (sekali per semester)

1. Login sebagai guru → di **Beranda**, klik **Kelola Tahun Ajaran & Semester**.
2. Buat **Tahun Ajaran** (contoh: `2026/2027`) → klik namanya.
3. Klik **+ Ganjil** (atau + Genap) → klik semesternya.
4. Buat **Kelas** (contoh: `X-1`). Ulangi untuk semua kelas yang diajar.
5. Kembali ke **Beranda** — semua kelas kini tampil dengan tombol
   **Mengajar / Kelola / Rekap**.

## 3. Menambah Siswa & Membagikan Akun (pertama kali)

### Menambah siswa

1. Dari Beranda, klik **Kelola** pada kelas yang dituju.
2. Di bagian **Siswa**, pilih salah satu:
   - **Dari file Excel/CSV** — siapkan file dengan **daftar nama di kolom pertama**
     (baris judul "Nama" boleh ada, otomatis dilewati), lalu pilih filenya; atau
   - **Tempel daftar nama** — copy kolom nama dari Excel, paste (satu nama per
     baris), klik **Baca daftar**.
3. Periksa pratinjau nama → klik **Impor sekarang**.

### Membagikan akun — PENTING, hanya tampil sekali

Setelah impor, muncul tabel hijau **"Password baru — catat/bagikan SEKARANG"**.
Password awal setiap siswa **hanya ditampilkan sekali ini** (sistem hanya
menyimpan versi terenkripsi — guru pun tidak bisa melihatnya lagi).

1. Klik **Salin semua** → paste ke Excel/Word (format: nama ⇥ password per baris).
2. Cetak lalu gunting per siswa, atau bagikan satu-satu — **jangan tempel daftar
   lengkap di layar proyektor/grup kelas**.
3. Minta siswa login di **https://codequest-smasif.vercel.app** tab **Siswa**:
   **pilih Kelas → pilih Nama → ketik password** dari kertas.
4. Saat pertama masuk, siswa **wajib membuat password baru sendiri**
   (minimal 6 karakter). Setelah itu password awal tidak berlaku lagi.

### Siswa lupa password

Buka **Kelola** kelas → baris siswa → **Reset password** → password baru muncul
sekali → bagikan ke siswa → siswa akan diminta membuat password baru lagi.

## 4. Menyiapkan Materi

1. Di halaman **Kelola** kelas, buat **Chapter** (satu chapter = satu pertemuan).
   Chapter baru otomatis berisi **3 latihan kecil + 1 Boss Quest** (bisa
   diubah/hapus/tambah).
2. Klik quest untuk mengedit: judul, soal, XP & Gold, cara penilaian:
   - **Auto check**: tambahkan **test case** (input + output yang diharapkan;
     centang *tersembunyi* agar tidak dilihat siswa) — dinilai otomatis.
   - **Review guru**: isi **rubrik** (kriteria + nilai maksimal) — Anda menilai
     manual dari Presentation Mode.

## 5. Alur Mengajar Harian

1. Login → klik banner **"Lanjutkan mengajar"** (atau **Mengajar** pada kelas).
2. Pilih pertemuan & quest yang sedang dikerjakan.
3. Pantau kartu siswa: online, mengerjakan, submit, **butuh bantuan** (kartu
   kuning = hampiri siswa itu).
4. **Pilih Acak** untuk memilih presenter, atau klik kartu siswa → **Presentation
   Mode**: kode siswa tampil besar untuk proyektor, jalankan dengan **Run**, ganti
   input untuk menguji, beri nilai (untuk quest review guru).
5. Lihat **Rekap** kapan saja untuk status & skor seluruh kelas.

## 6. Catatan

- Gamifikasi (XP, Level, Gold, Toko, karakter) **tidak memengaruhi nilai** —
  murni motivasi. Nilai akademik diambil dari rekap status & skor rubrik.
- Data siswa yang disimpan hanya **nama dan kelas** — tanpa NISN/data pribadi lain.
- Menghapus kelas/chapter/siswa ikut menghapus seluruh pekerjaan di dalamnya —
  baca dialog konfirmasi dengan teliti.
