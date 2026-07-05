import { BarChart3, BookOpen, GraduationCap, School, Settings, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { TeacherShell } from '../../components/teacher/shared'

/** Kunci localStorage: kelas terakhir yang dibuka di mode mengajar. */
export const LAST_CLASS_KEY = 'codequest_last_class_id'

interface ClassCard {
  id: string
  name: string
  semester: { name: string; academic_year: { label: string } | null } | null
}

/**
 * Beranda guru — dipakai hampir tiap hari selama satu semester, jadi kelas
 * dan tombol "Mengajar" harus SATU KLIK dari sini (feedback user: alur
 * Tahun Ajaran → Semester → Kelas terlalu panjang untuk pemakaian harian).
 * Manajemen struktur (tahun ajaran/semester) dipindah ke /guru/struktur.
 */
export default function TeacherDashboard() {
  const { dataClient } = useAuth()
  const [classes, setClasses] = useState<ClassCard[] | null>(null)
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({})
  const [lastClassId] = useState<string | null>(() => localStorage.getItem(LAST_CLASS_KEY))

  useEffect(() => {
    async function load() {
      const [{ data: cls }, { data: students }] = await Promise.all([
        dataClient
          .from('class')
          .select('id, name, semester:semester_id(name, academic_year:academic_year_id(label))')
          .order('created_at', { ascending: false }),
        dataClient.from('student').select('class_id'),
      ])
      setClasses((cls as unknown as ClassCard[]) ?? [])
      const counts: Record<string, number> = {}
      for (const s of students ?? []) counts[s.class_id] = (counts[s.class_id] ?? 0) + 1
      setStudentCounts(counts)
    }
    load()
  }, [dataClient])

  const lastClass = classes?.find((c) => c.id === lastClassId) ?? null

  return (
    <TeacherShell crumbs={[{ label: 'Beranda' }]}>
      {/* Lanjutkan mengajar — jalur tercepat untuk pemakaian harian */}
      {lastClass && (
        <Link
          to={`/guru/kelas/${lastClass.id}/live`}
          className="block rounded-3xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white p-8 shadow-lg hover:shadow-xl hover:scale-[1.01] transition"
        >
          <p className="text-sm uppercase tracking-widest text-indigo-200">
            Lanjutkan mengajar
          </p>
          <p className="text-4xl font-extrabold mt-1">Kelas {lastClass.name} →</p>
          <p className="text-indigo-200 mt-1">
            {lastClass.semester?.academic_year?.label}
            {lastClass.semester ? ` · Semester ${lastClass.semester.name}` : ''} · langsung ke
            live dashboard
          </p>
        </Link>
      )}

      <section>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-extrabold text-ink">Kelas Saya</h1>
          <Link
            to="/guru/struktur"
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-dim hover:bg-surface2"
          >
            <Settings className="w-4 h-4 inline -mt-0.5 mr-1" />
            Kelola Tahun Ajaran & Semester
          </Link>
        </div>

        {classes === null && <p className="text-sm text-faint">Memuat…</p>}
        {classes !== null && classes.length === 0 && (
          <div className="bg-surface rounded-2xl shadow-sm p-8 text-center space-y-2">
            <School className="w-10 h-10 mx-auto text-faint" />
            <p className="font-semibold text-ink">Belum ada kelas</p>
            <p className="text-sm text-dim">
              Mulai dari{' '}
              <Link to="/guru/struktur" className="text-indigo-500 underline">
                Kelola Tahun Ajaran & Semester
              </Link>{' '}
              untuk membuat tahun ajaran, semester, lalu kelas.
            </p>
          </div>
        )}

        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {classes?.map((c) => (
            <div
              key={c.id}
              className="bg-surface rounded-2xl shadow-sm p-5 border border-line/60 hover:border-indigo-300 transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-2xl font-extrabold text-ink">{c.name}</p>
                  <p className="text-sm text-dim">
                    {c.semester?.academic_year?.label ?? '—'}
                    {c.semester ? ` · ${c.semester.name}` : ''}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-bold bg-surface2 text-dim rounded-full px-2.5 py-1">
                  <Users className="w-3.5 h-3.5" /> {studentCounts[c.id] ?? 0}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4 text-sm font-semibold text-center">
                <Link
                  to={`/guru/kelas/${c.id}/live`}
                  className="rounded-xl bg-indigo-600 text-white py-2.5 hover:bg-indigo-500"
                >
                  <span className="inline-flex items-center justify-center gap-1.5">
                    <GraduationCap className="w-4 h-4" /> Mengajar
                  </span>
                </Link>
                <Link
                  to={`/guru/kelas/${c.id}`}
                  className="rounded-xl border border-line text-dim py-2.5 hover:bg-surface2"
                >
                  <span className="inline-flex items-center justify-center gap-1.5">
                    <BookOpen className="w-4 h-4" /> Kelola
                  </span>
                </Link>
                <Link
                  to={`/guru/kelas/${c.id}/rekap`}
                  className="rounded-xl border border-line text-dim py-2.5 hover:bg-surface2"
                >
                  <span className="inline-flex items-center justify-center gap-1.5">
                    <BarChart3 className="w-4 h-4" /> Rekap
                  </span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </TeacherShell>
  )
}
