import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useOnlineStudents } from '../../hooks/useClassPresence'
import { TeacherShell, subtleButton } from '../../components/teacher/shared'

interface ChapterRow {
  id: string
  title: string
  order_index: number
}

interface QuestRow {
  id: string
  chapter_id: string
  title: string
  order_index: number
  is_boss: boolean
  grading_mode: 'auto' | 'manual'
}

interface StudentRow {
  id: string
  name: string
}

interface SubRow {
  student_id: string
  status: string
  help_requested: boolean
}

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  not_started: { text: 'belum mulai', cls: 'bg-surface2 text-dim' },
  in_progress: { text: 'mengerjakan', cls: 'bg-sky-100 text-sky-700' },
  submitted: { text: 'submit', cls: 'bg-indigo-100 text-indigo-700' },
  waiting_review: { text: 'menunggu review', cls: 'bg-amber-100 text-amber-700' },
  passed: { text: 'lolos ✓', cls: 'bg-emerald-100 text-emerald-700' },
  failed: { text: 'belum lolos', cls: 'bg-red-100 text-red-600' },
}

/**
 * Live Progress dashboard (PRD §7.1) — layar guru SAAT mengajar.
 * Realtime (perubahan submission) + polling cadangan 10 detik, status online
 * via presence, Random Student Picker, klik kartu -> Presentation Mode.
 */
export default function LiveClassPage() {
  const { classId } = useParams<{ classId: string }>()
  const { dataClient } = useAuth()
  const navigate = useNavigate()

  const [className, setClassName] = useState('')
  const [chapters, setChapters] = useState<ChapterRow[]>([])
  const [quests, setQuests] = useState<QuestRow[]>([])
  const [students, setStudents] = useState<StudentRow[]>([])
  const [chapterId, setChapterId] = useState<string>('')
  const [questId, setQuestId] = useState<string>('')
  const [subs, setSubs] = useState<Record<string, SubRow>>({})
  const [picked, setPicked] = useState<StudentRow | null>(null)
  const [picking, setPicking] = useState(false)
  const pickTimer = useRef<number | undefined>(undefined)

  const online = useOnlineStudents(dataClient, classId ?? null)

  // Ingat kelas ini agar Beranda menampilkan tombol "Lanjutkan mengajar".
  useEffect(() => {
    if (classId) localStorage.setItem('codequest_last_class_id', classId)
  }, [classId])

  // --- Muat kerangka kelas sekali ---
  useEffect(() => {
    async function load() {
      const [{ data: cls }, { data: chs }, { data: qs }, { data: sts }] = await Promise.all([
        dataClient.from('class').select('name').eq('id', classId).single(),
        dataClient
          .from('chapter')
          .select('id, title, order_index')
          .eq('class_id', classId)
          .order('order_index'),
        dataClient
          .from('quest')
          .select('id, chapter_id, title, order_index, is_boss, grading_mode')
          .order('order_index'),
        dataClient.from('student').select('id, name').eq('class_id', classId).order('name'),
      ])
      if (cls) setClassName(cls.name)
      const chapterRows = (chs as ChapterRow[]) ?? []
      setChapters(chapterRows)
      setQuests(((qs as QuestRow[]) ?? []).filter((q) => chapterRows.some((c) => c.id === q.chapter_id)))
      setStudents((sts as StudentRow[]) ?? [])
      // Default: chapter terakhir (pertemuan terbaru) + quest pertamanya.
      if (chapterRows.length > 0) {
        const last = chapterRows[chapterRows.length - 1]
        setChapterId(last.id)
      }
    }
    load()
  }, [dataClient, classId])

  const chapterQuests = useMemo(
    () => quests.filter((q) => q.chapter_id === chapterId),
    [quests, chapterId],
  )

  useEffect(() => {
    if (chapterQuests.length > 0 && !chapterQuests.some((q) => q.id === questId)) {
      setQuestId(chapterQuests[0].id)
    }
  }, [chapterQuests, questId])

  // --- Status submission quest terpilih: muat + Realtime + polling cadangan ---
  const loadSubs = useCallback(async () => {
    if (!questId) return
    const { data } = await dataClient
      .from('submission')
      .select('student_id, status, help_requested')
      .eq('quest_id', questId)
    const map: Record<string, SubRow> = {}
    for (const row of (data as SubRow[]) ?? []) map[row.student_id] = row
    setSubs(map)
  }, [dataClient, questId])

  useEffect(() => {
    loadSubs()
    if (!questId) return

    // Realtime: butuh `alter publication supabase_realtime add table submission`
    // (migrasi 0005). Polling 10 dtk tetap berjalan sebagai cadangan.
    const channel = dataClient
      .channel(`live-quest-${questId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'submission', filter: `quest_id=eq.${questId}` },
        () => loadSubs(),
      )
      .subscribe()
    const poll = window.setInterval(loadSubs, 10_000)

    return () => {
      channel.unsubscribe()
      window.clearInterval(poll)
    }
  }, [dataClient, questId, loadSubs])

  // --- Random Student Picker ---
  function pickRandom() {
    if (students.length === 0 || picking) return
    setPicking(true)
    let ticks = 0
    const spin = () => {
      setPicked(students[Math.floor(Math.random() * students.length)])
      ticks++
      if (ticks < 14) {
        pickTimer.current = window.setTimeout(spin, 60 + ticks * 25) // melambat
      } else {
        setPicking(false)
      }
    }
    spin()
  }
  useEffect(() => () => window.clearTimeout(pickTimer.current), [])

  // --- Agregat (PRD §7.1) ---
  const counts = useMemo(() => {
    let mengerjakan = 0
    let submit = 0
    let bantuan = 0
    for (const s of students) {
      const sub = subs[s.id]
      if (!sub || sub.status === 'not_started') continue
      if (sub.status === 'in_progress') mengerjakan++
      else submit++
      if (sub.help_requested) bantuan++
    }
    return {
      online: online.size,
      mengerjakan,
      submit,
      belum: students.length - mengerjakan - submit,
      bantuan,
    }
  }, [students, subs, online])

  const selectedQuest = chapterQuests.find((q) => q.id === questId)

  return (
    <TeacherShell
      crumbs={[
        { label: 'Beranda', to: '/guru' },
        { label: `Kelas ${className}`, to: `/guru/kelas/${classId}` },
        { label: 'Live' },
      ]}
    >
      {/* Pilihan pertemuan & quest */}
      <section className="bg-surface rounded-2xl shadow-sm p-4 flex flex-wrap items-center gap-3">
        <select
          className="rounded-lg border border-line px-3 py-2"
          value={chapterId}
          onChange={(e) => setChapterId(e.target.value)}
        >
          {chapters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.order_index}. {c.title}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-2">
          {chapterQuests.map((q) => (
            <button
              key={q.id}
              onClick={() => setQuestId(q.id)}
              className={
                q.id === questId
                  ? 'rounded-full bg-indigo-600 text-white text-sm font-semibold px-4 py-1.5'
                  : 'rounded-full border border-line text-dim text-sm px-4 py-1.5 hover:bg-surface2'
              }
            >
              {q.title}
              {q.is_boss ? ' 👑' : ''}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <button
            onClick={pickRandom}
            disabled={students.length === 0}
            className="rounded-lg bg-violet-600 text-white font-semibold px-4 py-2 hover:bg-violet-700 disabled:opacity-50"
          >
            🎲 Pilih Acak
          </button>
        </div>
      </section>

      {/* Hasil pilih acak */}
      {picked && (
        <section
          className={
            'rounded-2xl p-6 text-center text-white shadow-lg ' +
            (picking ? 'bg-slate-400' : 'bg-gradient-to-r from-violet-600 to-fuchsia-600')
          }
        >
          <p className="text-sm uppercase tracking-widest opacity-80">
            {picking ? 'Mengacak…' : 'Terpilih untuk presentasi'}
          </p>
          <p className="text-4xl font-extrabold mt-1">{picked.name}</p>
          {!picking && selectedQuest && (
            <button
              className="mt-4 rounded-lg bg-surface/20 hover:bg-surface/30 font-semibold px-4 py-2"
              onClick={() => navigate(`/guru/presentasi/${selectedQuest.id}/${picked.id}`)}
            >
              Buka Presentation Mode →
            </button>
          )}
        </section>
      )}

      {/* Agregat */}
      <section className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Online', value: counts.online, cls: 'text-emerald-600' },
          { label: 'Mengerjakan', value: counts.mengerjakan, cls: 'text-sky-600' },
          { label: 'Sudah submit', value: counts.submit, cls: 'text-indigo-600' },
          { label: 'Belum mulai', value: counts.belum, cls: 'text-dim' },
          { label: '🙋 Butuh bantuan', value: counts.bantuan, cls: 'text-amber-600' },
        ].map((c) => (
          <div key={c.label} className="bg-surface rounded-xl shadow-sm p-4 text-center">
            <p className={`text-3xl font-extrabold ${c.cls}`}>{c.value}</p>
            <p className="text-xs text-dim mt-1">{c.label}</p>
          </div>
        ))}
      </section>

      {/* Kartu siswa */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {students.map((s) => {
          const sub = subs[s.id]
          const status = sub?.status ?? 'not_started'
          const badge = STATUS_LABEL[status] ?? STATUS_LABEL.not_started
          const needHelp = sub?.help_requested
          return (
            <Link
              key={s.id}
              to={selectedQuest ? `/guru/presentasi/${selectedQuest.id}/${s.id}` : '#'}
              className={
                'rounded-xl bg-surface shadow-sm p-4 border-2 transition hover:border-indigo-300 ' +
                (needHelp ? 'border-amber-400 ring-2 ring-amber-200' : 'border-transparent')
              }
            >
              <div className="flex items-center gap-2">
                <span
                  className={
                    'w-2.5 h-2.5 rounded-full ' + (online.has(s.id) ? 'bg-emerald-500' : 'bg-slate-300')
                  }
                  title={online.has(s.id) ? 'online' : 'offline'}
                />
                <span className="font-semibold text-ink flex-1 truncate">{s.name}</span>
                {needHelp && <span title="butuh bantuan">🙋</span>}
              </div>
              <span
                className={`inline-block mt-2 text-xs font-semibold rounded-full px-2 py-0.5 ${badge.cls}`}
              >
                {badge.text}
              </span>
            </Link>
          )
        })}
        {students.length === 0 && (
          <p className="text-sm text-faint bg-surface rounded-xl p-6 sm:col-span-3">
            Belum ada siswa di kelas ini.{' '}
            <Link to={`/guru/kelas/${classId}`} className="text-indigo-600 underline">
              Impor siswa dulu
            </Link>
            .
          </p>
        )}
      </section>

      <p className="text-xs text-faint">
        Status diperbarui otomatis (Realtime + penyegaran berkala).{' '}
        <button className={subtleButton + ' !py-0.5 !px-2 text-xs'} onClick={loadSubs}>
          Segarkan sekarang
        </button>
      </p>
    </TeacherShell>
  )
}
