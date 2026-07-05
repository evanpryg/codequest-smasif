import { Coins, Hand, Medal, PartyPopper, Send, Zap } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import Logo from '../../components/Logo'
import ThemeToggle from '../../components/ThemeToggle'
import { useTrackPresence } from '../../hooks/useClassPresence'
import { compareOutput } from '../../lib/autocheck'
import { awardPassRewards, type PassRewards } from '../../lib/achievements'
import { pyodideRunner } from '../../lib/pyodideRunner'

interface QuestDetail {
  id: string
  chapter_id: string
  title: string
  description: string | null
  is_boss: boolean
  grading_mode: 'auto' | 'manual'
  reward_xp: number
  reward_gold: number
  ignore_output_order: boolean
  float_tolerance: number
}

interface TestCase {
  id: string
  stdin: string
  expected_output: string
  is_hidden: boolean
  order_index: number
}

interface SubmissionRow {
  id: string
  status: string
  draft_code: string | null
  help_requested: boolean
}

interface AttemptRow {
  id: string
  passed: boolean | null
  created_at: string
}

/** Hasil satu test case saat submit (disimpan ke submission_attempt.auto_result). */
interface CaseResult {
  test_case_id: string
  hidden: boolean
  passed: boolean
  detail: string | null
  actual: string
}

const inputClass =
  'w-full rounded-lg border border-line px-3 py-2 ' +
  'focus:outline-none focus:ring-2 focus:ring-indigo-500'

/**
 * Ruang kerja satu quest (alur siswa PRD §5.2):
 * baca soal → tulis kode di VS Code → paste/upload .py → autosave draft →
 * jalankan sendiri → submit → auto check (Pyodide) atau menunggu review guru.
 */
export default function QuestWorkspacePage() {
  const { questId } = useParams<{ questId: string }>()
  const { state, dataClient } = useAuth()
  const studentId = state.status === 'student' ? state.session.student.id : ''
  const classId = state.status === 'student' ? state.session.student.class_id : null
  const studentName = state.status === 'student' ? state.session.student.name : ''

  // Tetap tampil "online" di dashboard guru selama mengerjakan.
  useTrackPresence(dataClient, classId, studentId, studentName)

  const [quest, setQuest] = useState<QuestDetail | null>(null)
  const [testCases, setTestCases] = useState<TestCase[]>([])
  const [submission, setSubmission] = useState<SubmissionRow | null>(null)
  const [attempts, setAttempts] = useState<AttemptRow[]>([])

  const [code, setCode] = useState('')
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [customStdin, setCustomStdin] = useState('')
  const [running, setRunning] = useState(false)
  const [runOutput, setRunOutput] = useState<{ stdout: string; error: string | null } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [caseResults, setCaseResults] = useState<CaseResult[] | null>(null)
  const [rewards, setRewards] = useState<PassRewards | null>(null)
  const [error, setError] = useState<string | null>(null)

  const saveTimer = useRef<number | undefined>(undefined)
  const codeRef = useRef('')

  // ---------------------------------------------------------------------------
  // Muat data & siapkan Pyodide di latar
  // ---------------------------------------------------------------------------
  const loadAttempts = useCallback(
    async (submissionId: string) => {
      const { data } = await dataClient
        .from('submission_attempt')
        .select('id, passed, created_at')
        .eq('submission_id', submissionId)
        .order('created_at', { ascending: false })
      if (data) setAttempts(data as AttemptRow[])
    },
    [dataClient],
  )

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [{ data: q }, { data: tcs }, { data: sub }] = await Promise.all([
        dataClient
          .from('quest')
          .select(
            'id, chapter_id, title, description, is_boss, grading_mode, reward_xp, reward_gold, ignore_output_order, float_tolerance',
          )
          .eq('id', questId)
          .single(),
        dataClient
          .from('test_case')
          .select('id, stdin, expected_output, is_hidden, order_index')
          .eq('quest_id', questId)
          .order('order_index'),
        dataClient
          .from('submission')
          .select('id, status, draft_code, help_requested')
          .eq('quest_id', questId)
          .eq('student_id', studentId)
          .maybeSingle(),
      ])
      if (cancelled) return
      if (q) setQuest(q as QuestDetail)
      if (tcs) setTestCases(tcs as TestCase[])
      if (sub) {
        setSubmission(sub as SubmissionRow)
        if (sub.draft_code) {
          setCode(sub.draft_code)
          codeRef.current = sub.draft_code
        }
        loadAttempts(sub.id)
      }
    }
    load()
    if (quest?.grading_mode !== 'manual') pyodideRunner.preload()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataClient, questId, studentId])

  // ---------------------------------------------------------------------------
  // Submission & autosave draft (MVP-Scope §3.2)
  // ---------------------------------------------------------------------------
  const ensureSubmission = useCallback(async (): Promise<SubmissionRow> => {
    if (submission) return submission
    const { data, error: upsertError } = await dataClient
      .from('submission')
      .upsert(
        { student_id: studentId, quest_id: questId, status: 'in_progress' },
        { onConflict: 'student_id,quest_id' },
      )
      .select('id, status, draft_code, help_requested')
      .single()
    if (upsertError || !data) throw new Error('Gagal menyiapkan pengerjaan')
    setSubmission(data as SubmissionRow)
    return data as SubmissionRow
  }, [dataClient, questId, studentId, submission])

  const saveDraft = useCallback(async () => {
    const draft = codeRef.current
    try {
      const sub = await ensureSubmission()
      // PENTING: autosave TIDAK menyentuh kolom status — status hanya diubah
      // saat submit. (Autosave tertunda yang menulis status dari state basi
      // bisa menimpa hasil "passed" yang baru saja diset oleh submit.)
      await dataClient
        .from('submission')
        .update({
          draft_code: draft,
          draft_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', sub.id)
      setSavedAt(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }))
    } catch {
      /* autosave gagal senyap; percobaan berikut akan mengulang */
    }
  }, [dataClient, ensureSubmission])

  function onCodeChange(value: string) {
    setCode(value)
    codeRef.current = value
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(saveDraft, 2500)
  }

  useEffect(() => () => window.clearTimeout(saveTimer.current), [])

  async function onUploadFile(file: File) {
    // File .py dibaca sebagai teks (TechDecisions §2.3) — tidak ada Storage.
    const text = await file.text()
    onCodeChange(text)
  }

  // ---------------------------------------------------------------------------
  // Jalankan sendiri (self-test) — tidak dinilai
  // ---------------------------------------------------------------------------
  async function runSelfTest() {
    setError(null)
    setRunning(true)
    setRunOutput(null)
    try {
      const result = await pyodideRunner.run(code, customStdin)
      setRunOutput({ stdout: result.stdout, error: result.error })
    } finally {
      setRunning(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Submit — auto check semua test case, atau kirim untuk review guru
  // ---------------------------------------------------------------------------
  async function submit() {
    if (!quest) return
    if (!code.trim()) {
      setError('Kode masih kosong.')
      return
    }
    setError(null)
    setSubmitting(true)
    setCaseResults(null)
    setRewards(null)
    // Batalkan autosave yang mengantre agar tidak berlomba dengan submit.
    window.clearTimeout(saveTimer.current)
    try {
      const sub = await ensureSubmission()
      await saveDraft()

      if (quest.grading_mode === 'manual') {
        const { error: attemptError } = await dataClient
          .from('submission_attempt')
          .insert({ submission_id: sub.id, source_code: code, passed: null })
        if (attemptError) throw new Error('Gagal mengirim jawaban')
        await dataClient
          .from('submission')
          .update({ status: 'waiting_review', updated_at: new Date().toISOString() })
          .eq('id', sub.id)
        setSubmission({ ...sub, status: 'waiting_review' })
        await loadAttempts(sub.id)
        return
      }

      // --- Auto check ---
      if (testCases.length === 0) {
        throw new Error('Quest ini belum punya test case. Beri tahu gurumu ya.')
      }
      const results: CaseResult[] = []
      for (const tc of testCases) {
        const run = await pyodideRunner.run(code, tc.stdin)
        const cmp = run.error
          ? { passed: false, detail: run.timedOut ? run.error : 'Program error saat dijalankan.' }
          : compareOutput(tc.expected_output, run.stdout, {
              floatTolerance: quest.float_tolerance,
              ignoreOrder: quest.ignore_output_order,
            })
        results.push({
          test_case_id: tc.id,
          hidden: tc.is_hidden,
          passed: cmp.passed,
          detail: cmp.detail ?? (run.error ? run.error.split('\n').slice(-3).join('\n') : null),
          actual: run.error ? '' : run.stdout,
        })
      }
      const allPassed = results.every((r) => r.passed)

      const { error: attemptError } = await dataClient.from('submission_attempt').insert({
        submission_id: sub.id,
        source_code: code,
        auto_result: results,
        passed: allPassed,
      })
      if (attemptError) throw new Error('Gagal menyimpan hasil percobaan')

      // Pernah lolos = status passed ATAU ada attempt lolos di riwayat
      // (lebih tahan banting terhadap status yang tidak sinkron).
      const wasAlreadyPassed = sub.status === 'passed' || attempts.some((a) => a.passed === true)
      const newStatus = allPassed ? 'passed' : 'failed'
      await dataClient
        .from('submission')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', sub.id)
      setSubmission({ ...sub, status: newStatus })
      setCaseResults(results)
      await loadAttempts(sub.id)

      if (allPassed) {
        const passRewards = await awardPassRewards(dataClient, {
          studentId,
          questId: quest.id,
          chapterId: quest.chapter_id,
          isBoss: quest.is_boss,
          rewardXp: quest.reward_xp,
          rewardGold: quest.reward_gold,
          attemptCount: attempts.length + 1,
          wasAlreadyPassed,
        })
        setRewards(passRewards)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit gagal')
    } finally {
      setSubmitting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Tombol "Butuh Bantuan" (PRD §8.2)
  // ---------------------------------------------------------------------------
  async function toggleHelp() {
    try {
      const sub = await ensureSubmission()
      const next = !sub.help_requested
      await dataClient
        .from('submission')
        .update({
          help_requested: next,
          help_requested_at: next ? new Date().toISOString() : null,
        })
        .eq('id', sub.id)
      setSubmission({ ...sub, help_requested: next })
    } catch {
      setError('Gagal mengirim permintaan bantuan')
    }
  }

  if (!quest) {
    return (
      <main className="min-h-screen bg-canvas flex items-center justify-center text-faint">
        Memuat…
      </main>
    )
  }

  const visibleCases = testCases.filter((tc) => !tc.is_hidden)
  const isPassed = submission?.status === 'passed'

  return (
    <main className="min-h-screen bg-canvas">
      <header className="bg-surface border-b border-line">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo to="/siswa" />
            <span className="text-xs font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700 rounded-full px-2.5 py-1">
              Siswa
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/siswa" className="text-sm text-dim hover:text-indigo-600">
              ← Kembali
            </Link>
          </div>
        </div>
      </header>

      {/* Desktop lebar: soal di kiri, editor di kanan (feedback: full layar). */}
      <div className="max-w-7xl mx-auto px-6 py-6 grid xl:grid-cols-5 gap-6 items-start">
        <div className="xl:col-span-2 space-y-5">
        {/* Soal */}
        <section className="bg-surface rounded-2xl shadow-sm p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-ink">
                {quest.title}
                {quest.is_boss && (
                  <span className="ml-2 text-xs font-bold bg-rose-100 text-rose-700 rounded-full px-2 py-0.5 align-middle">
                    BOSS
                  </span>
                )}
              </h1>
              <p className="text-sm text-dim mt-0.5">
                {quest.reward_xp} XP ·{' '}
                {quest.grading_mode === 'auto' ? 'dinilai otomatis' : 'direview guru'}
                {isPassed && <span className="text-emerald-600 font-semibold"> · LOLOS ✓</span>}
                {submission?.status === 'waiting_review' && (
                  <span className="text-amber-600 font-semibold"> · menunggu review guru</span>
                )}
              </p>
            </div>
            <button
              onClick={toggleHelp}
              className={
                submission?.help_requested
                  ? 'rounded-lg bg-amber-500 text-white text-sm font-semibold px-3 py-2 hover:bg-amber-600'
                  : 'rounded-lg border border-amber-300 text-amber-600 text-sm font-semibold px-3 py-2 hover:bg-amber-50'
              }
            >
              <span className="inline-flex items-center gap-1.5">
                <Hand className="w-4 h-4" />
                {submission?.help_requested ? 'Menunggu guru…' : 'Butuh Bantuan'}
              </span>
            </button>
          </div>
          {quest.description && (
            <p className="text-ink mt-4 whitespace-pre-wrap">{quest.description}</p>
          )}

          {visibleCases.length > 0 && (
            <div className="mt-4 grid sm:grid-cols-2 gap-3">
              {visibleCases.map((tc, i) => (
                <div key={tc.id} className="rounded-lg bg-surface2 border border-line p-3 text-sm">
                  <p className="font-semibold text-dim mb-1">Contoh {i + 1}</p>
                  <p className="text-dim">
                    Input: <code className="font-mono text-ink">{tc.stdin || '(tanpa input)'}</code>
                  </p>
                  <p className="text-dim">
                    Output: <code className="font-mono text-ink">{tc.expected_output}</code>
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
        </div>

        <div className="xl:col-span-3 space-y-5">
        {/* Editor kode */}
        <section className="bg-surface rounded-2xl shadow-sm p-6 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-bold text-ink">Kode kamu</h2>
            <div className="flex items-center gap-3 text-sm">
              {savedAt && <span className="text-faint">Draft tersimpan {savedAt}</span>}
              <label className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-dim hover:bg-surface2">
                Upload .py
                <input
                  type="file"
                  accept=".py,text/x-python,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) onUploadFile(f)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
          </div>
          <textarea
            className={inputClass + ' h-64 font-mono text-sm'}
            placeholder={'# Tulis kodemu di VS Code, lalu tempel di sini\n# atau upload file .py\n'}
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            spellCheck={false}
          />

          {/* Jalankan sendiri */}
          <div className="rounded-xl bg-surface2 border border-line p-4 space-y-2">
            <p className="text-sm font-semibold text-dim">
              Coba jalankan dulu (tidak dinilai)
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-dim mb-1">
                  Input percobaan (satu nilai per baris)
                </label>
                <textarea
                  className={inputClass + ' h-20 font-mono text-sm'}
                  value={customStdin}
                  onChange={(e) => setCustomStdin(e.target.value)}
                  placeholder={'5\n7'}
                />
              </div>
              <div>
                <label className="block text-xs text-dim mb-1">Output</label>
                <pre className="h-20 overflow-auto rounded-lg bg-slate-900 text-slate-100 text-sm p-3 font-mono">
                  {running
                    ? 'Menjalankan… (pemuatan pertama Python bisa ±10-30 detik)'
                    : runOutput
                      ? runOutput.error
                        ? runOutput.stdout + '\n' + runOutput.error
                        : runOutput.stdout || '(tidak ada output)'
                      : ''}
                </pre>
              </div>
            </div>
            <button
              onClick={runSelfTest}
              disabled={running || !code.trim()}
              className="rounded-lg border border-indigo-300 text-indigo-600 font-semibold px-4 py-2 hover:bg-indigo-50 disabled:opacity-50"
            >
              {running ? 'Menjalankan…' : '▶ Jalankan'}
            </button>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <button
            onClick={submit}
            disabled={submitting || !code.trim()}
            className="w-full rounded-lg bg-indigo-600 text-white font-bold py-3 hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Send className="w-5 h-5" />
            {submitting
              ? 'Memeriksa…'
              : quest.grading_mode === 'auto'
                ? 'Kumpulkan & Periksa Otomatis'
                : 'Kumpulkan untuk Direview Guru'}
          </button>
        </section>

        {/* Hasil auto check */}
        {caseResults && (
          <section className="bg-surface rounded-2xl shadow-sm p-6 space-y-3">
            <h2 className="font-bold text-ink">
              Hasil pemeriksaan:{' '}
              {caseResults.every((r) => r.passed) ? (
                <span className="text-emerald-600">LOLOS SEMUA ✓</span>
              ) : (
                <span className="text-red-600">
                  {caseResults.filter((r) => r.passed).length}/{caseResults.length} lolos
                </span>
              )}
            </h2>
            <ul className="space-y-2">
              {caseResults.map((r, i) => (
                <li
                  key={r.test_case_id}
                  className={
                    'rounded-lg border px-4 py-3 text-sm ' +
                    (r.passed ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50')
                  }
                >
                  <p className={'font-semibold ' + (r.passed ? 'text-emerald-700' : 'text-red-700')}>
                    {r.passed ? '✓' : '✗'} Test {i + 1}
                    {r.hidden && ' (tersembunyi)'}
                  </p>
                  {/* Detail hanya untuk test case yang boleh dilihat siswa. */}
                  {!r.passed && !r.hidden && r.detail && (
                    <p className="text-red-600 mt-1 whitespace-pre-wrap">{r.detail}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Reward */}
        {rewards &&
          (rewards.xpAwarded > 0 ||
            rewards.goldAwarded > 0 ||
            rewards.newAchievements.length > 0) && (
          <section className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl shadow-lg p-6">
            <p className="text-xl font-extrabold flex items-center gap-2">
              <PartyPopper className="w-6 h-6" /> Quest selesai!
            </p>
            {rewards.xpAwarded > 0 && (
              <p className="mt-1 font-semibold flex items-center gap-1.5">
                <Zap className="w-4 h-4 fill-amber-300 text-amber-300" /> +{rewards.xpAwarded} XP
              </p>
            )}
            {rewards.goldAwarded > 0 && (
              <p className="mt-1 font-semibold flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-amber-300" /> +{rewards.goldAwarded} Gold —{' '}
                <Link to="/siswa/toko" className="underline">
                  belanjakan di Toko!
                </Link>
              </p>
            )}
            {rewards.newAchievements.map((a) => (
              <p key={a.code} className="mt-1 flex items-center gap-1.5">
                <Medal className="w-4 h-4 text-amber-300" /> Achievement terbuka:{' '}
                <span className="font-bold">{a.name}</span>
              </p>
            ))}
          </section>
        )}

        {/* Riwayat percobaan */}
        {attempts.length > 0 && (
          <section className="bg-surface rounded-2xl shadow-sm p-6">
            <h2 className="font-bold text-ink mb-3">Riwayat percobaan ({attempts.length})</h2>
            <ul className="space-y-1 text-sm">
              {attempts.map((a, i) => (
                <li key={a.id} className="flex items-center gap-2 text-dim">
                  <span className="text-faint">#{attempts.length - i}</span>
                  <span>
                    {new Date(a.created_at).toLocaleString('id-ID', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {a.passed === true && <span className="text-emerald-600 font-semibold">lolos ✓</span>}
                  {a.passed === false && <span className="text-red-500 font-semibold">belum lolos</span>}
                  {a.passed === null && <span className="text-amber-600 font-semibold">menunggu review</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
        </div>
      </div>
    </main>
  )
}
