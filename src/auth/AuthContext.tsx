import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { createStudentClient, supabase } from '../lib/supabase'
import { studentLogin, type StudentInfo } from '../lib/studentApi'

/**
 * Satu context untuk dua jenis sesi (guru & siswa).
 *
 * - GURU  : Supabase Auth; supabase-js sendiri yang menyimpan & me-refresh token.
 * - SISWA : JWT dari Edge Function; disimpan di localStorage dengan waktu
 *           kedaluwarsa (12 jam), diperiksa saat app dimuat.
 *
 * Satu browser hanya memegang SATU peran pada satu waktu — login sebagai satu
 * peran menghapus sesi peran lainnya (perangkat sekolah sering bergantian).
 */

const STUDENT_SESSION_KEY = 'codequest_student_session'

export interface StudentSession {
  access_token: string
  expires_at: number // epoch detik
  student: StudentInfo
}

type AuthState =
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'teacher'; session: Session }
  | { status: 'student'; session: StudentSession }

interface AuthContextValue {
  state: AuthState
  /** Klien Supabase yang sesuai peran aktif (RLS berlaku di server). */
  dataClient: SupabaseClient
  loginTeacher: (email: string, password: string) => Promise<void>
  loginStudent: (classId: string, name: string, password: string) => Promise<StudentInfo>
  /** Dipanggil setelah siswa sukses ganti password pertama kali. */
  markPasswordChanged: () => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readStoredStudentSession(): StudentSession | null {
  try {
    const raw = localStorage.getItem(STUDENT_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StudentSession
    if (!parsed.access_token || !parsed.expires_at || !parsed.student) return null
    if (parsed.expires_at * 1000 <= Date.now()) {
      localStorage.removeItem(STUDENT_SESSION_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  // Pulihkan sesi saat app dimuat: cek guru (Supabase Auth) dulu, lalu siswa.
  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      if (data.session) {
        setState({ status: 'teacher', session: data.session })
        return
      }
      const studentSession = readStoredStudentSession()
      setState(studentSession ? { status: 'student', session: studentSession } : { status: 'none' })
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return
      setState((prev) => {
        if (session) return { status: 'teacher', session }
        // Sesi guru berakhir; jangan menimpa sesi siswa yang sedang aktif.
        return prev.status === 'student' ? prev : { status: 'none' }
      })
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  const loginTeacher = useCallback(async (email: string, password: string) => {
    localStorage.removeItem(STUDENT_SESSION_KEY) // satu peran per browser
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error('Email atau password salah')
    // onAuthStateChange akan meng-update state.
  }, [])

  const loginStudent = useCallback(async (classId: string, name: string, password: string) => {
    await supabase.auth.signOut().catch(() => {}) // satu peran per browser
    const result = await studentLogin(classId, name, password)
    const session: StudentSession = {
      access_token: result.access_token,
      expires_at: Math.floor(Date.now() / 1000) + result.expires_in,
      student: result.student,
    }
    localStorage.setItem(STUDENT_SESSION_KEY, JSON.stringify(session))
    setState({ status: 'student', session })
    return result.student
  }, [])

  const markPasswordChanged = useCallback(() => {
    setState((prev) => {
      if (prev.status !== 'student') return prev
      const session: StudentSession = {
        ...prev.session,
        student: { ...prev.session.student, must_change_password: false },
      }
      localStorage.setItem(STUDENT_SESSION_KEY, JSON.stringify(session))
      return { status: 'student', session }
    })
  }, [])

  const logout = useCallback(async () => {
    localStorage.removeItem(STUDENT_SESSION_KEY)
    await supabase.auth.signOut().catch(() => {})
    setState({ status: 'none' })
  }, [])

  // Klien data mengikuti peran: token siswa disisipkan agar RLS siswa berlaku.
  const dataClient = useMemo(() => {
    if (state.status === 'student') return createStudentClient(state.session.access_token)
    return supabase
  }, [state])

  const value = useMemo(
    () => ({ state, dataClient, loginTeacher, loginStudent, markPasswordChanged, logout }),
    [state, dataClient, loginTeacher, loginStudent, markPasswordChanged, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>')
  return ctx
}
