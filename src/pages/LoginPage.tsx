import { Swords } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import ThemeToggle from '../components/ThemeToggle'
import {
  fetchClassOptions,
  fetchStudentNames,
  type ClassOption,
} from '../lib/studentApi'

type Tab = 'siswa' | 'guru'

/**
 * Halaman login untuk kedua peran (PRD §5).
 * Siswa: pilih Kelas -> pilih Nama -> Password (dropdown diambil dari Edge
 * Function karena RLS menutup akses anon). Guru: email + password.
 */
export default function LoginPage() {
  const { state } = useAuth()
  const [tab, setTab] = useState<Tab>('siswa')

  // Sudah login? Langsung ke area masing-masing.
  if (state.status === 'teacher') return <Navigate to="/guru" replace />
  if (state.status === 'student') return <Navigate to="/siswa" replace />

  return (
    <main className="relative min-h-screen bg-canvas flex items-center justify-center p-4 overflow-hidden">
      {/* Latar dekoratif bergaya game */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-indigo-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-fuchsia-500/20 blur-3xl" />
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="flex items-center justify-center gap-3">
            <span className="rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white p-3 shadow-lg inline-flex">
              <Swords className="w-9 h-9" strokeWidth={2.5} />
            </span>
            <span className="text-5xl text-game">CodeQuest</span>
          </h1>
          <p className="text-dim mt-2 font-semibold">
            Pendamping belajar coding di kelas
          </p>
        </div>

        <div className="bg-surface rounded-3xl shadow-xl border border-line/60 overflow-hidden">
          <div className="grid grid-cols-2 text-center text-sm font-semibold">
            <button
              className={
                tab === 'siswa'
                  ? 'py-3 bg-indigo-600 text-white'
                  : 'py-3 bg-surface2 text-dim hover:bg-surface2'
              }
              onClick={() => setTab('siswa')}
            >
              Siswa
            </button>
            <button
              className={
                tab === 'guru'
                  ? 'py-3 bg-indigo-600 text-white'
                  : 'py-3 bg-surface2 text-dim hover:bg-surface2'
              }
              onClick={() => setTab('guru')}
            >
              Guru
            </button>
          </div>
          <div className="p-6">{tab === 'siswa' ? <StudentForm /> : <TeacherForm />}</div>
        </div>
      </div>
    </main>
  )
}

function FieldError({ message }: { message: string | null }) {
  if (!message) return null
  return <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{message}</p>
}

const inputClass =
  'w-full rounded-lg border border-line px-3 py-2 text-ink ' +
  'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-surface2'

const buttonClass =
  'w-full rounded-lg bg-indigo-600 text-white font-semibold py-2.5 ' +
  'hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed'

function StudentForm() {
  const { loginStudent } = useAuth()
  const navigate = useNavigate()

  const [classes, setClasses] = useState<ClassOption[] | null>(null)
  const [names, setNames] = useState<string[]>([])
  const [classId, setClassId] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetchClassOptions()
      .then((r) => setClasses(r.classes))
      .catch(() => setError('Gagal memuat daftar kelas. Coba muat ulang halaman.'))
  }, [])

  useEffect(() => {
    setName('')
    setNames([])
    if (!classId) return
    fetchStudentNames(classId)
      .then((r) => setNames(r.students))
      .catch(() => setError('Gagal memuat daftar nama.'))
  }, [classId])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const student = await loginStudent(classId, name, password)
      navigate(student.must_change_password ? '/siswa/ganti-password' : '/siswa', {
        replace: true,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-dim mb-1">Kelas</label>
        <select
          className={inputClass}
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          disabled={classes === null}
          required
        >
          <option value="">{classes === null ? 'Memuat…' : '— Pilih kelas —'}</option>
          {classes?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.year ? ` · ${c.year}${c.semester ? ` ${c.semester}` : ''}` : ''}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-dim mb-1">Nama</label>
        <select
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={!classId}
          required
        >
          <option value="">{classId ? '— Pilih nama —' : 'Pilih kelas dulu'}</option>
          {names.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-dim mb-1">Password</label>
        <input
          type="password"
          className={inputClass}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
        />
      </div>

      <FieldError message={error} />

      <button type="submit" className={buttonClass} disabled={busy || !classId || !name}>
        {busy ? 'Masuk…' : 'Masuk'}
      </button>
    </form>
  )
}

function TeacherForm() {
  const { loginTeacher } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await loginTeacher(email, password)
      navigate('/guru', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-dim mb-1">Email</label>
        <input
          type="email"
          className={inputClass}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="guru@sekolah.sch.id"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-dim mb-1">Password</label>
        <input
          type="password"
          className={inputClass}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
        />
      </div>

      <FieldError message={error} />

      <button type="submit" className={buttonClass} disabled={busy}>
        {busy ? 'Masuk…' : 'Masuk'}
      </button>

      <p className="text-xs text-faint text-center">
        Akun guru dibuat oleh admin — tidak ada pendaftaran mandiri.
      </p>
    </form>
  )
}
