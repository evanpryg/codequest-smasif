import bcrypt from 'bcryptjs'

/**
 * Password awal siswa dibuat otomatis saat impor (MVP-Scope §3.1) dan saat
 * guru mereset password. Hash bcrypt dibuat DI BROWSER guru, sehingga
 * plaintext hanya tampil sekali ke guru untuk dibagikan — database hanya
 * menyimpan hash (dicocokkan oleh Edge Function student-login).
 */

// Tanpa karakter ambigu (0/O, 1/l/I) — dibaca anak SMA dari kertas/papan.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

export function generatePassword(length = 8): string {
  const bytes = new Uint32Array(length)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out
}

/** Hash bcrypt (async agar UI tidak beku saat impor puluhan siswa). */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10)
}
