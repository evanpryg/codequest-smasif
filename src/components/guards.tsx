import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

/** Layar tunggu singkat saat sesi sedang dipulihkan dari penyimpanan. */
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400">
      Memuat…
    </div>
  )
}

/** Hanya untuk guru; selain itu dialihkan ke /login. */
export function RequireTeacher() {
  const { state } = useAuth()
  if (state.status === 'loading') return <LoadingScreen />
  if (state.status !== 'teacher') return <Navigate to="/login" replace />
  return <Outlet />
}

/**
 * Hanya untuk siswa. Siswa yang masih wajib ganti password pertama kali
 * dipaksa ke layar ganti password sebelum bisa ke mana pun (DataModel §3).
 */
export function RequireStudent() {
  const { state } = useAuth()
  const location = useLocation()
  if (state.status === 'loading') return <LoadingScreen />
  if (state.status !== 'student') return <Navigate to="/login" replace />
  if (
    state.session.student.must_change_password &&
    location.pathname !== '/siswa/ganti-password'
  ) {
    return <Navigate to="/siswa/ganti-password" replace />
  }
  return <Outlet />
}
