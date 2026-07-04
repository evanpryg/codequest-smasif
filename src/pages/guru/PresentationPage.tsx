import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { awardPassRewards } from '../../lib/achievements'
import { pyodideRunner } from '../../lib/pyodideRunner'

interface QuestInfo {
  id: string
  chapter_id: string
  title: string
  grading_mode: 'auto' | 'manual'
  is_boss: boolean
  reward_xp: number
  rubric: { key: string; label: string; max: number }[] | null
}

interface TestCaseRow {
  id: string
  stdin: string
  order_index: number
}

interface AttemptRow {
  id: string
  source_code: string
  passed: boolean | null
  created_at: string
}

/**
 * Presentation Mode + Code Runner (PRD §7.2–7.3) — tampilan bersih untuk
 * proyektor, tanpa HDMI ke laptop siswa. Guru menjalankan kode siswa lewat
 * sandbox Pyodide, mengganti input untuk menguji kondisi berbeda, dan (untuk
 * quest manual) menilai dengan rubrik + komentar.
 */
export default function PresentationPage() {
  const { questId, studentId } = useParams<{ questId: string; studentId: string }>()
  const { state, dataClient } = useAuth()
  const teacherId = state.status === 'teacher' ? state.session.user.id : ''

  const [quest, setQuest] = useState<QuestInfo | null>(null)
  const [testCases, setTestCases] = useState<TestCaseRow[]>([])
  const [studentName, setStudentName] = useState('')
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [submissionStatus, setSubmissionStatus] = useState<string>('not_started')
  const [draftCode, setDraftCode] = useState<string | null>(null)
  const [attempts, setAttempts] = useState<AttemptRow[]>([])

  const [stdin, setStdin] = useState('')
  const [running, setRunning] = useState(false)
  const [output, setOutput] = useState<string | null>(null)

  const [scores, setScores] = useState<Record<string, number>>({})
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [reviewMsg, setReviewMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [{ data: q }, { data: tcs }, { data: st }, { data: sub }] = await Promise.all([
      dataClient
        .from('quest')
        .select('id, chapter_id, title, grading_mode, is_boss, reward_xp, rubric')
        .eq('id', questId)
        .single(),
      dataClient
        .from('test_case')
        .select('id, stdin, order_index')
        .eq('quest_id', questId)
        .order('order_index'),
      dataClient.from('student').select('name').eq('id', studentId).single(),
      dataClient
        .from('submission')
        .select('id, status, draft_code')
        .eq('quest_id', questId)
        .eq('student_id', studentId)
        .maybeSingle(),
    ])
    if (q) setQuest(q as QuestInfo)
    if (tcs) setTestCases(tcs as TestCaseRow[])
    if (st) setStudentName(st.name)
    if (sub) {
      setSubmissionId(sub.id)
      setSubmissionStatus(sub.status)
      setDraftCode(sub.draft_code)
      const { data: atts } = await dataClient
        .from('submission_attempt')
        .select('id, source_code, passed, created_at')
        .eq('submission_id', sub.id)
        .order('created_at', { ascending: false })
      if (atts) setAttempts(atts as AttemptRow[])
    }
  }, [dataClient, questId, studentId])

  useEffect(() => {
    load()
    pyodideRunner.preload()
  }, [load])

  const latestAttempt = attempts[0] ?? null
  // Kode yang ditampilkan: submit terakhir; bila belum pernah submit, draft.
  const code = latestAttempt?.source_code ?? draftCode ?? ''

  async function run() {
    if (!code.trim()) return
    setRunning(true)
    setOutput(null)
    try {
      const result = await pyodideRunner.run(code, stdin)
      setOutput(result.error ? `${result.stdout}\n${result.error}`.trim() : result.stdout || '(tidak ada output)')
    } finally {
      setRunning(false)
    }
  }

  async function saveReview(pass: boolean) {
    if (!quest || !latestAttempt || !submissionId) return
    setSaving(true)
    setReviewMsg(null)
    try {
      const { error: reviewError } = await dataClient.from('review').insert({
        attempt_id: latestAttempt.id,
        reviewer_teacher_id: teacherId,
        scores: Object.keys(scores).length > 0 ? scores : null,
        comment: comment.trim() || null,
      })
      if (reviewError) throw new Error('Gagal menyimpan penilaian')

      const wasAlreadyPassed =
        submissionStatus === 'passed' || attempts.some((a) => a.passed === true)

      await dataClient
        .from('submission')
        .update({ status: pass ? 'passed' : 'failed', updated_at: new Date().toISOString() })
        .eq('id', submissionId)
      // Tandai attempt yang direview agar riwayat siswa ikut jelas.
      await dataClient
        .from('submission_attempt')
        .update({ passed: pass })
        .eq('id', latestAttempt.id)
      setSubmissionStatus(pass ? 'passed' : 'failed')

      let msg = pass ? 'Dinilai: LOLOS ✓' : 'Dinilai: belum lolos'
      if (pass) {
        // XP & achievement atas nama guru (policy 0005). Gagal = tidak fatal.
        const rewards = await awardPassRewards(dataClient, {
          studentId: studentId!,
          questId: quest.id,
          chapterId: quest.chapter_id,
          isBoss: quest.is_boss,
          rewardXp: quest.reward_xp,
          attemptCount: attempts.length,
          wasAlreadyPassed,
        })
        if (rewards.xpAwarded > 0) msg += ` · +${rewards.xpAwarded} XP untuk ${studentName}`
        if (rewards.newAchievements.length > 0)
          msg += ` · 🏅 ${rewards.newAchievements.map((a) => a.name).join(', ')}`
      }
      setReviewMsg(msg)
      await load()
    } catch (err) {
      setReviewMsg(err instanceof Error ? err.message : 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  if (!quest) {
    return (
      <main className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400">
        Memuat…
      </main>
    )
  }

  return (
    // Latar gelap kontras tinggi — nyaman dibaca dari proyektor.
    <main className="min-h-screen bg-slate-900 text-slate-100">
      <header className="border-b border-slate-700">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400">{quest.title}</p>
            <h1 className="text-3xl font-extrabold">{studentName || '…'}</h1>
          </div>
          <button
            onClick={() => history.back()}
            className="rounded-lg border border-slate-600 px-4 py-2 text-slate-300 hover:bg-slate-800"
          >
            ← Kembali
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6 grid lg:grid-cols-2 gap-6">
        {/* Kode siswa */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-slate-300">Kode</h2>
            <span className="text-xs text-slate-400">
              {latestAttempt
                ? `submit ${new Date(latestAttempt.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                : draftCode
                  ? 'draft (belum submit)'
                  : 'belum ada kode'}
            </span>
          </div>
          <pre className="rounded-xl bg-slate-950 border border-slate-700 p-5 text-lg leading-relaxed overflow-auto min-h-64 max-h-[32rem] font-mono whitespace-pre-wrap">
            {code || '# (siswa belum menulis kode)'}
          </pre>
        </section>

        {/* Runner */}
        <section className="space-y-4">
          <div>
            <h2 className="font-bold text-slate-300 mb-2">Uji dengan input berbeda</h2>
            <textarea
              className="w-full h-24 rounded-xl bg-slate-950 border border-slate-700 p-4 font-mono text-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder={'Ketik input di sini (satu nilai per baris)…'}
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <button
                onClick={run}
                disabled={running || !code.trim()}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 font-bold px-6 py-2.5 text-lg"
              >
                {running ? 'Menjalankan…' : '▶ Run'}
              </button>
              {testCases.map((tc, i) => (
                <button
                  key={tc.id}
                  onClick={() => setStdin(tc.stdin)}
                  className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
                  title={tc.stdin || '(tanpa input)'}
                >
                  Test {i + 1}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-bold text-slate-300 mb-2">Output</h2>
            <pre className="rounded-xl bg-slate-950 border border-slate-700 p-5 text-lg min-h-32 max-h-64 overflow-auto font-mono whitespace-pre-wrap">
              {running ? '…' : output ?? ''}
            </pre>
          </div>

          {/* Panel nilai */}
          <div className="rounded-xl bg-slate-800 border border-slate-700 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-200">Nilai</h2>
              <span className="text-xs text-slate-400">
                status: {submissionStatus.replace('_', ' ')}
              </span>
            </div>

            {!latestAttempt && (
              <p className="text-sm text-slate-400">
                Belum ada submit dari siswa ini — penilaian aktif setelah siswa mengumpulkan.
              </p>
            )}

            {latestAttempt && (
              <>
                {(quest.rubric ?? []).map((r) => (
                  <div key={r.key} className="flex items-center gap-3">
                    <span className="flex-1 text-sm text-slate-300">{r.label}</span>
                    <input
                      type="number"
                      min={0}
                      max={r.max}
                      className="w-20 rounded-lg bg-slate-950 border border-slate-600 px-2 py-1 text-center"
                      value={scores[r.key] ?? ''}
                      placeholder={`0-${r.max}`}
                      onChange={(e) =>
                        setScores({
                          ...scores,
                          [r.key]: Math.max(0, Math.min(r.max, Number(e.target.value))),
                        })
                      }
                    />
                    <span className="text-xs text-slate-500">/ {r.max}</span>
                  </div>
                ))}
                <textarea
                  className="w-full h-16 rounded-lg bg-slate-950 border border-slate-600 p-3 text-sm"
                  placeholder="Komentar untuk siswa (opsional)…"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => saveReview(true)}
                    disabled={saving}
                    className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 font-bold py-2.5"
                  >
                    ✓ Luluskan
                  </button>
                  <button
                    onClick={() => saveReview(false)}
                    disabled={saving}
                    className="flex-1 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 font-bold py-2.5"
                  >
                    ✗ Belum lolos
                  </button>
                </div>
                {reviewMsg && <p className="text-sm text-amber-300">{reviewMsg}</p>}
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
