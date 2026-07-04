import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { studentChangePassword } from '../../lib/studentApi'

/**
 * Wajib ganti password pertama kali (student.must_change_password, DataModel §3).
 * Password awal dibuat otomatis saat impor Excel; layar ini memaksa siswa
 * menggantinya sebelum masuk dashboard.
 */
export default function ChangePasswordPage() {
  const { state, markPasswordChanged } = useAuth()
  const navigate = useNavigate()

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (state.status !== 'student') return null
  const { student } = state.session

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (state.status !== 'student') return
    setError(null)
    if (newPassword.length < 6) {
      setError('Password baru minimal 6 karakter.')
      return
    }
    if (newPassword !== confirm) {
      setError('Konfirmasi password tidak sama.')
      return
    }
    setBusy(true)
    try {
      await studentChangePassword(state.session.access_token, oldPassword, newPassword)
      markPasswordChanged()
      navigate('/siswa', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengganti password')
    } finally {
      setBusy(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-line px-3 py-2 ' +
    'focus:outline-none focus:ring-2 focus:ring-indigo-500'

  return (
    <main className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface rounded-2xl shadow-lg p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-ink">Buat Password Baru</h1>
          <p className="text-sm text-dim mt-1">
            Halo, <span className="font-semibold">{student.name}</span>! Demi keamanan, ganti
            password awalmu sebelum melanjutkan.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dim mb-1">
              Password lama (dari guru)
            </label>
            <input
              type="password"
              className={inputClass}
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-dim mb-1">Password baru</label>
            <input
              type="password"
              className={inputClass}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-dim mb-1">
              Ulangi password baru
            </label>
            <input
              type="password"
              className={inputClass}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={6}
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 text-white font-semibold py-2.5 hover:bg-indigo-700 disabled:opacity-50"
            disabled={busy}
          >
            {busy ? 'Menyimpan…' : 'Simpan & Lanjut'}
          </button>
        </form>
      </div>
    </main>
  )
}
