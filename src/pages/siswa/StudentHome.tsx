import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useTrackPresence } from '../../hooks/useClassPresence'
import { xpProgress } from '../../lib/xp'

interface EarnedAchievement {
  earned_at: string
  achievement: { code: string; name: string; description: string | null } | null
}

interface ChapterRow {
  id: string
  title: string
  description: string | null
  order_index: number
}

interface QuestRow {
  id: string
  chapter_id: string
  title: string
  order_index: number
  is_boss: boolean
  grading_mode: 'auto' | 'manual'
  reward_xp: number
}

/** Status pengerjaan per quest milik siswa ini (dari submission miliknya). */
type QuestStatus = 'not_started' | 'in_progress' | 'submitted' | 'waiting_review' | 'passed' | 'failed'

const STATUS_BADGE: Record<QuestStatus, { text: string; cls: string }> = {
  not_started: { text: 'belum mulai', cls: 'bg-slate-100 text-slate-500' },
  in_progress: { text: 'sedang dikerjakan', cls: 'bg-sky-100 text-sky-700' },
  submitted: { text: 'terkumpul', cls: 'bg-indigo-100 text-indigo-700' },
  waiting_review: { text: 'menunggu review', cls: 'bg-amber-100 text-amber-700' },
  passed: { text: 'lolos ✓', cls: 'bg-emerald-100 text-emerald-700' },
  failed: { text: 'coba lagi', cls: 'bg-red-100 text-red-600' },
}

/**
 * Beranda siswa: profil XP/level, achievement, dan daftar chapter + quest
 * kelasnya dengan status pengerjaan. RLS menjamin hanya konten kelas sendiri
 * dan status milik sendiri yang terlihat.
 */
export default function StudentHome() {
  const { state, dataClient, logout } = useAuth()
  const [profile, setProfile] = useState<{ name: string; total_xp: number; level: number } | null>(
    null,
  )
  const [achievements, setAchievements] = useState<EarnedAchievement[] | null>(null)
  const [chapters, setChapters] = useState<ChapterRow[] | null>(null)
  const [quests, setQuests] = useState<QuestRow[]>([])
  const [statusByQuest, setStatusByQuest] = useState<Record<string, QuestStatus>>({})

  const studentId = state.status === 'student' ? state.session.student.id : null
  const classId = state.status === 'student' ? state.session.student.class_id : null
  const studentName = state.status === 'student' ? state.session.student.name : ''

  // Tandai "online" untuk dashboard Live Progress guru.
  useTrackPresence(dataClient, classId, studentId, studentName)

  useEffect(() => {
    if (!studentId) return
    dataClient
      .from('student')
      .select('name, total_xp, level')
      .eq('id', studentId)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data)
      })
    dataClient
      .from('student_achievement')
      .select('earned_at, achievement:achievement_id(code, name, description)')
      .order('earned_at', { ascending: false })
      .then(({ data }) => {
        setAchievements((data as unknown as EarnedAchievement[]) ?? [])
      })
    dataClient
      .from('chapter')
      .select('id, title, description, order_index')
      .order('order_index')
      .then(({ data }) => setChapters((data as ChapterRow[]) ?? []))
    dataClient
      .from('quest')
      .select('id, chapter_id, title, order_index, is_boss, grading_mode, reward_xp')
      .order('order_index')
      .then(({ data }) => setQuests((data as QuestRow[]) ?? []))
    dataClient
      .from('submission')
      .select('quest_id, status')
      .then(({ data }) => {
        const map: Record<string, QuestStatus> = {}
        for (const row of data ?? []) map[row.quest_id] = row.status as QuestStatus
        setStatusByQuest(map)
      })
  }, [dataClient, studentId])

  if (state.status !== 'student') return null

  const name = profile?.name ?? state.session.student.name
  const totalXp = profile?.total_xp ?? state.session.student.total_xp
  const progress = xpProgress(totalXp)

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-extrabold text-indigo-700">CodeQuest</span>
            <span className="text-xs font-semibold uppercase tracking-wide bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">
              Siswa
            </span>
          </div>
          <button
            onClick={logout}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Keluar
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Kartu profil & progres level */}
        <section className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-slate-800">{name}</h1>
              <p className="text-sm text-slate-500">Total {totalXp} XP</p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xl font-extrabold">
                {progress.level}
              </div>
              <p className="text-xs text-slate-500 mt-1">Level</p>
            </div>
          </div>
          <div className="h-3 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-all"
              style={{ width: `${Math.round(progress.fraction * 100)}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {progress.currentLevelXp} / {progress.neededXp} XP menuju Level {progress.level + 1}
          </p>
        </section>

        {/* Chapter & quest */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-slate-800">Petualanganmu 🗺️</h2>
          {chapters === null && <p className="text-sm text-slate-400">Memuat…</p>}
          {chapters !== null && chapters.length === 0 && (
            <p className="text-sm text-slate-400 bg-white rounded-2xl p-6">
              Belum ada chapter dari gurumu.
            </p>
          )}
          {chapters?.map((ch) => {
            const chQuests = quests.filter((q) => q.chapter_id === ch.id)
            const doneCount = chQuests.filter((q) => statusByQuest[q.id] === 'passed').length
            return (
              <div key={ch.id} className="bg-white rounded-2xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-slate-800">
                    <span className="text-slate-400 mr-1">{ch.order_index}.</span>
                    {ch.title}
                  </h3>
                  <span className="text-xs font-semibold text-slate-500">
                    {doneCount}/{chQuests.length} selesai
                  </span>
                </div>
                {ch.description && (
                  <p className="text-sm text-slate-500 mb-3 whitespace-pre-wrap">{ch.description}</p>
                )}
                <ul className="space-y-2 mt-3">
                  {chQuests.map((q) => {
                    const status = statusByQuest[q.id] ?? 'not_started'
                    const badge = STATUS_BADGE[status]
                    return (
                      <li key={q.id}>
                        <Link
                          to={`/siswa/quest/${q.id}`}
                          className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-3 hover:border-indigo-300 hover:bg-indigo-50/40"
                        >
                          <span className="flex-1 font-medium text-slate-700">
                            {q.title}
                            {q.is_boss && (
                              <span className="ml-2 text-xs font-bold bg-rose-100 text-rose-700 rounded-full px-2 py-0.5">
                                BOSS
                              </span>
                            )}
                          </span>
                          <span className="text-xs font-semibold bg-indigo-50 text-indigo-600 rounded-full px-2 py-0.5">
                            {q.reward_xp} XP
                          </span>
                          <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${badge.cls}`}>
                            {badge.text}
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </section>

        {/* Achievement */}
        <section className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-3">Achievement</h2>
          {achievements === null && <p className="text-sm text-slate-400">Memuat…</p>}
          {achievements !== null && achievements.length === 0 && (
            <p className="text-sm text-slate-400">
              Belum ada — selesaikan quest pertamamu untuk membuka achievement! 🏆
            </p>
          )}
          <ul className="grid gap-2 sm:grid-cols-2">
            {achievements?.map((a) => (
              <li
                key={a.achievement?.code ?? a.earned_at}
                className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
              >
                <p className="font-semibold text-amber-800">🏅 {a.achievement?.name}</p>
                {a.achievement?.description && (
                  <p className="text-xs text-amber-700 mt-0.5">{a.achievement.description}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  )
}
