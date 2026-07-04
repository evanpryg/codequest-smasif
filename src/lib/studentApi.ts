import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase'

/**
 * Pemanggil Edge Function `student-login` (auth siswa + data layar login).
 * Lihat supabase/functions/student-login/index.ts untuk kontraknya.
 */

export interface ClassOption {
  id: string
  name: string
  semester: string | null
  year: string | null
}

export interface StudentInfo {
  id: string
  class_id: string
  name: string
  must_change_password: boolean
  total_xp: number
  level: number
}

export interface StudentLoginResult {
  access_token: string
  expires_in: number
  student: StudentInfo
}

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/student-login`

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(
      typeof data?.error === 'string' ? data.error : `Permintaan gagal (${res.status})`,
    )
  }
  return data as T
}

/** Daftar kelas untuk dropdown layar login siswa. */
export function fetchClassOptions(): Promise<{ classes: ClassOption[] }> {
  return call({ action: 'options' })
}

/** Daftar nama siswa dalam satu kelas. */
export function fetchStudentNames(classId: string): Promise<{ students: string[] }> {
  return call({ action: 'options', class_id: classId })
}

/** Login siswa: Kelas -> Nama -> Password. */
export function studentLogin(
  classId: string,
  name: string,
  password: string,
): Promise<StudentLoginResult> {
  return call({ action: 'login', class_id: classId, name, password })
}

/** Wajib ganti password pertama kali (student.must_change_password). */
export function studentChangePassword(
  token: string,
  oldPassword: string,
  newPassword: string,
): Promise<{ ok: true }> {
  return call({
    action: 'change_password',
    token,
    old_password: oldPassword,
    new_password: newPassword,
  })
}
