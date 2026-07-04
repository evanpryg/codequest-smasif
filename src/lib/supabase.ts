import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Klien Supabase untuk frontend.
 *
 * Memakai anon key (aman untuk browser). Seluruh isolasi data — antar guru
 * dan antar siswa — ditegakkan oleh Row Level Security di PostgreSQL
 * (lihat supabase/migrations/0003_rls.sql), bukan oleh frontend.
 *
 * Dua jenis sesi:
 *  - GURU  : Supabase Auth (email/password) → pakai klien default `supabase`.
 *  - SISWA : JWT dari Edge Function `student-login` (klaim `student_id`) →
 *            pakai `createStudentClient(token)` yang menyisipkan token itu
 *            sebagai Authorization header di setiap request.
 */
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? ''
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Tidak melempar error agar kerangka app tetap termuat saat env belum diisi.
  console.warn(
    '[CodeQuest] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY belum di-set. ' +
      'Salin .env.example ke .env dan isi kredensial project Supabase Anda.',
  )
}

/** Klien default — dipakai sesi guru (Supabase Auth mengelola tokennya). */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/**
 * Klien untuk sesi siswa: setiap request memakai JWT siswa sehingga policy
 * RLS `student_id = current_student_id()` berlaku di server.
 */
export function createStudentClient(accessToken: string): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
