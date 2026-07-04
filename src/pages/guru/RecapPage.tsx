import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { Card, TeacherShell } from '../../components/teacher/shared'

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
  rubric: { key: string; max: number }[] | null
}
interface StudentRow {
  id: string
  name: string
  level: number
  total_xp: number
}
interface SubRow {
  student_id: string
  quest_id: string
  status: string
}
interface ReviewRow {
  scores: Record<string, number> | null
  attempt: { submission: { student_id: string; quest_id: string } | null } | null
}

const CELL: Record<string, { text: string; cls: string }> = {
  passed: { text: '✓', cls: 'bg-emerald-100 text-emerald-700' },
  failed: { text: '✗', cls: 'bg-red-100 text-red-600' },
  waiting_review: { text: '…', cls: 'bg-amber-100 text-amber-700' },
  in_progress: { text: '⌛', cls: 'bg-sky-100 text-sky-600' },
}

/** Rekap nilai per kelas di layar (MVP-Scope §3.7; export Excel = Fase 2). */
export default function RecapPage() {
  const { classId } = useParams<{ classId: string }>()
  const { dataClient } = useAuth()

  const [className, setClassName] = useState('')
  const [chapters, setChapters] = useState<ChapterRow[]>([])
  const [quests, setQuests] = useState<QuestRow[]>([])
  const [students, setStudents] = useState<StudentRow[]>([])
  const [subs, setSubs] = useState<SubRow[]>([])
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [chapterId, setChapterId] = useState('')

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
          .select('id, chapter_id, title, order_index, is_boss, grading_mode, rubric')
          .order('order_index'),
        dataClient
          .from('student')
          .select('id, name, level, total_xp')
          .eq('class_id', classId)
          .order('name'),
      ])
      if (cls) setClassName(cls.name)
      const chapterRows = (chs as ChapterRow[]) ?? []
      setChapters(chapterRows)
      setQuests(((qs as QuestRow[]) ?? []).filter((q) => chapterRows.some((c) => c.id === q.chapter_id)))
      setStudents((sts as StudentRow[]) ?? [])
      if (chapterRows.length > 0) setChapterId(chapterRows[0].id)

      const questIds = ((qs as QuestRow[]) ?? [])
        .filter((q) => chapterRows.some((c) => c.id === q.chapter_id))
        .map((q) => q.id)
      if (questIds.length > 0) {
        const [{ data: subRows }, { data: reviewRows }] = await Promise.all([
          dataClient.from('submission').select('student_id, quest_id, status').in('quest_id', questIds),
          dataClient
            .from('review')
            .select('scores, attempt:attempt_id(submission:submission_id(student_id, quest_id))'),
        ])
        setSubs((subRows as SubRow[]) ?? [])
        setReviews((reviewRows as unknown as ReviewRow[]) ?? [])
      }
    }
    load()
  }, [dataClient, classId])

  const chapterQuests = useMemo(
    () => quests.filter((q) => q.chapter_id === chapterId),
    [quests, chapterId],
  )

  const statusMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of subs) m.set(`${s.student_id}:${s.quest_id}`, s.status)
    return m
  }, [subs])

  /** Skor review terakhir per siswa+quest: "3+2" bila ada rubrik. */
  const scoreMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of reviews) {
      const sub = r.attempt?.submission
      if (!sub || !r.scores) continue
      const total = Object.values(r.scores).reduce((a, b) => a + (Number(b) || 0), 0)
      m.set(`${sub.student_id}:${sub.quest_id}`, String(total))
    }
    return m
  }, [reviews])

  return (
    <TeacherShell
      crumbs={[
        { label: 'Tahun Ajaran', to: '/guru' },
        { label: `Kelas ${className}`, to: `/guru/kelas/${classId}` },
        { label: 'Rekap Nilai' },
      ]}
    >
      <Card
        title={`Rekap — Kelas ${className}`}
        subtitle="✓ lolos · ✗ belum lolos · … menunggu review · ⌛ sedang dikerjakan. Angka = total skor rubrik. Export Excel menyusul di Fase 2."
      >
        <div className="mb-4">
          <select
            className="rounded-lg border border-slate-300 px-3 py-2"
            value={chapterId}
            onChange={(e) => setChapterId(e.target.value)}
          >
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.order_index}. {c.title}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-3 font-semibold">Siswa</th>
                <th className="py-2 pr-3 font-semibold">Lv</th>
                <th className="py-2 pr-3 font-semibold">XP</th>
                {chapterQuests.map((q) => (
                  <th key={q.id} className="py-2 px-2 font-semibold text-center whitespace-nowrap">
                    {q.title}
                    {q.is_boss ? ' 👑' : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-medium text-slate-700 whitespace-nowrap">{s.name}</td>
                  <td className="py-2 pr-3 text-slate-500">{s.level}</td>
                  <td className="py-2 pr-3 text-slate-500">{s.total_xp}</td>
                  {chapterQuests.map((q) => {
                    const status = statusMap.get(`${s.id}:${q.id}`)
                    const cell = status ? CELL[status] : undefined
                    const score = scoreMap.get(`${s.id}:${q.id}`)
                    return (
                      <td key={q.id} className="py-2 px-2 text-center">
                        {cell ? (
                          <span
                            className={`inline-block min-w-8 rounded-full px-2 py-0.5 font-bold ${cell.cls}`}
                            title={status}
                          >
                            {cell.text}
                            {score ? ` ${score}` : ''}
                          </span>
                        ) : (
                          <span className="text-slate-300">·</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {students.length === 0 && (
            <p className="text-sm text-slate-400 py-4">Belum ada siswa di kelas ini.</p>
          )}
        </div>
      </Card>
    </TeacherShell>
  )
}
