import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import AvatarView, { type AvatarConfig } from '../../components/AvatarView'
import ThemeToggle from '../../components/ThemeToggle'
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

const STATUS_BADGE: Record<QuestStatus, { icon: string; text: string; cls: string }> = {
  not_started: { icon: '🗺️', text: 'belum mulai', cls: 'bg-surface2 text-dim' },
  in_progress: { icon: '⚔️', text: 'sedang dikerjakan', cls: 'bg-sky-100 text-sky-700' },
  submitted: { icon: '📤', text: 'terkumpul', cls: 'bg-indigo-100 text-indigo-700' },
  waiting_review: { icon: '🛡️', text: 'menunggu review', cls: 'bg-amber-100 text-amber-700' },
  passed: { icon: '✅', text: 'lolos', cls: 'bg-emerald-100 text-emerald-700' },
  failed: { icon: '🔁', text: 'coba lagi', cls: 'bg-red-100 text-red-600' },
}

/**
 * Beranda siswa — bergaya game (feedback user: UI harus menarik, bukan
 * administratif): hero gradien + level ring, peta quest dengan ikon status,
 * achievement sebagai medali. Layout lebar untuk browser desktop.
 */
export default function StudentHome() {
  const { state, dataClient, logout } = useAuth()
  const [profile, setProfile] = useState<{
    name: string
    total_xp: number
    level: number
    gold: number
  } | null>(null)
  const [avatar, setAvatar] = useState<AvatarConfig>({})
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
      .select('name, total_xp, level, gold')
      .eq('id', studentId)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data)
      })
    dataClient
      .from('student_avatar')
      .select('*')
      .maybeSingle()
      .then(({ data }) => {
        if (data) setAvatar(data as AvatarConfig)
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
    <main className="min-h-screen bg-canvas">
      <header className="bg-surface border-b border-line">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl text-game">⚔️ CodeQuest</span>
            <span className="text-xs font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700 rounded-full px-2.5 py-1">
              Siswa
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={logout}
              className="rounded-lg border border-line px-3 py-1.5 text-sm text-dim hover:bg-surface2"
            >
              Keluar
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Hero: profil & progres level */}
        <section className="rounded-3xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white shadow-lg p-8">
          <div className="flex items-center gap-6 flex-wrap">
            <Link to="/siswa/toko" title="Dandani karaktermu di Toko">
              <AvatarView
                config={avatar}
                size={110}
                className="drop-shadow-xl hover:scale-105 transition"
              />
            </Link>
            <div className="flex-1 min-w-52">
              <h1 className="text-3xl font-extrabold">{name}</h1>
              <p className="text-indigo-200 font-semibold">
                ⚡ {totalXp} XP
                <span className="ml-3">🪙 {profile?.gold ?? 0} Gold</span>
              </p>
              <div className="mt-3 h-4 rounded-full bg-white/20 overflow-hidden max-w-xl">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-300 to-yellow-400 transition-all"
                  style={{ width: `${Math.max(4, Math.round(progress.fraction * 100))}%` }}
                />
              </div>
              <p className="text-xs text-indigo-200 mt-1.5 font-semibold">
                {progress.currentLevelXp} / {progress.neededXp} XP menuju Level{' '}
                {progress.level + 1}
              </p>
            </div>
            <div className="flex items-center gap-5">
              <div className="w-24 h-24 rounded-full bg-white/15 border-4 border-amber-300 flex flex-col items-center justify-center shadow-lg">
                <span className="text-[10px] uppercase tracking-widest text-amber-200 font-bold">
                  Level
                </span>
                <span className="text-4xl font-extrabold leading-none">{progress.level}</span>
              </div>
              <Link
                to="/siswa/toko"
                className="rounded-2xl bg-white/15 hover:bg-white/25 border-2 border-white/30 px-5 py-4 text-center font-extrabold transition"
              >
                🛍️
                <br />
                Toko
              </Link>
            </div>
          </div>
        </section>

        <div className="grid lg:grid-cols-3 gap-6 items-start">
          {/* Peta quest */}
          <section className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-extrabold text-ink">Petualanganmu 🗺️</h2>
            {chapters === null && <p className="text-sm text-faint">Memuat…</p>}
            {chapters !== null && chapters.length === 0 && (
              <p className="text-sm text-faint bg-surface rounded-2xl p-6">
                Belum ada chapter dari gurumu.
              </p>
            )}
            {chapters?.map((ch) => {
              const chQuests = quests.filter((q) => q.chapter_id === ch.id)
              const doneCount = chQuests.filter((q) => statusByQuest[q.id] === 'passed').length
              const pct = chQuests.length > 0 ? Math.round((doneCount / chQuests.length) * 100) : 0
              return (
                <div key={ch.id} className="bg-surface rounded-2xl shadow-sm p-6 border border-line/60">
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <h3 className="font-extrabold text-ink text-lg">
                      <span className="text-faint mr-1">{ch.order_index}.</span>
                      {ch.title}
                    </h3>
                    <span className="text-xs font-bold text-dim whitespace-nowrap">
                      {doneCount}/{chQuests.length} ⭐
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-line overflow-hidden mb-3">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {ch.description && (
                    <p className="text-sm text-dim mb-3 whitespace-pre-wrap">{ch.description}</p>
                  )}
                  <ul className="space-y-2">
                    {chQuests.map((q) => {
                      const status = statusByQuest[q.id] ?? 'not_started'
                      const badge = STATUS_BADGE[status]
                      return (
                        <li key={q.id}>
                          <Link
                            to={`/siswa/quest/${q.id}`}
                            className={
                              'flex items-center gap-3 rounded-xl border px-4 py-3 transition hover:-translate-y-0.5 hover:shadow-md ' +
                              (q.is_boss
                                ? 'border-rose-300/60 bg-gradient-to-r from-rose-500/10 to-orange-500/10'
                                : 'border-line hover:border-indigo-300')
                            }
                          >
                            <span className="text-2xl">{q.is_boss ? '👑' : badge.icon}</span>
                            <span className="flex-1 font-bold text-ink">
                              {q.title}
                              {q.is_boss && (
                                <span className="ml-2 text-xs font-extrabold bg-rose-100 text-rose-700 rounded-full px-2 py-0.5">
                                  BOSS
                                </span>
                              )}
                            </span>
                            <span className="text-xs font-bold bg-indigo-50 text-indigo-600 rounded-full px-2.5 py-1">
                              ⚡ {q.reward_xp} XP
                            </span>
                            <span
                              className={`text-xs font-bold rounded-full px-2.5 py-1 ${badge.cls}`}
                            >
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

          {/* Achievement — medali */}
          <section className="bg-surface rounded-2xl shadow-sm p-6 border border-line/60">
            <h2 className="text-xl font-extrabold text-ink mb-4">Achievement 🏆</h2>
            {achievements === null && <p className="text-sm text-faint">Memuat…</p>}
            {achievements !== null && achievements.length === 0 && (
              <p className="text-sm text-faint">
                Belum ada — selesaikan quest pertamamu untuk membuka achievement!
              </p>
            )}
            <ul className="space-y-2">
              {achievements?.map((a) => (
                <li
                  key={a.achievement?.code ?? a.earned_at}
                  className="flex items-center gap-3 rounded-xl border border-amber-300/60 bg-gradient-to-r from-amber-500/10 to-yellow-500/10 px-4 py-3"
                >
                  <span className="text-3xl">🏅</span>
                  <div>
                    <p className="font-extrabold text-ink">{a.achievement?.name}</p>
                    {a.achievement?.description && (
                      <p className="text-xs text-dim">{a.achievement.description}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </main>
  )
}
