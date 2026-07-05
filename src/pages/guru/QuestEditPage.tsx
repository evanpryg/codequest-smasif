import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import {
  Card,
  TeacherShell,
  dangerButton,
  inputClass,
  primaryButton,
  subtleButton,
} from '../../components/teacher/shared'

interface QuestDetail {
  id: string
  title: string
  description: string | null
  order_index: number
  is_boss: boolean
  grading_mode: 'auto' | 'manual'
  reward_xp: number
  reward_gold: number
  ignore_output_order: boolean
  float_tolerance: number
  rubric: RubricItem[] | null
  chapter: {
    id: string
    title: string
    class: { id: string; name: string } | null
  } | null
}

interface RubricItem {
  key: string
  label: string
  max: number
}

interface TestCaseRow {
  id: string
  stdin: string
  expected_output: string
  is_hidden: boolean
  order_index: number
}

/** Editor satu Quest: soal, reward, pengaturan auto check, test case, rubrik. */
export default function QuestEditPage() {
  const { questId } = useParams<{ questId: string }>()
  const { dataClient } = useAuth()

  const [quest, setQuest] = useState<QuestDetail | null>(null)
  const [testCases, setTestCases] = useState<TestCaseRow[] | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Field form (diisi dari quest saat dimuat)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isBoss, setIsBoss] = useState(false)
  const [gradingMode, setGradingMode] = useState<'auto' | 'manual'>('auto')
  const [rewardXp, setRewardXp] = useState(25)
  const [rewardGold, setRewardGold] = useState(10)
  const [orderIndex, setOrderIndex] = useState(1)
  const [ignoreOrder, setIgnoreOrder] = useState(false)
  const [floatTol, setFloatTol] = useState('0.001')
  const [rubric, setRubric] = useState<RubricItem[]>([])

  const reload = useCallback(async () => {
    const [{ data: q }, { data: tcs }] = await Promise.all([
      dataClient
        .from('quest')
        .select(
          'id, title, description, order_index, is_boss, grading_mode, reward_xp, reward_gold, ignore_output_order, float_tolerance, rubric, chapter:chapter_id(id, title, class:class_id(id, name))',
        )
        .eq('id', questId)
        .single(),
      dataClient
        .from('test_case')
        .select('id, stdin, expected_output, is_hidden, order_index')
        .eq('quest_id', questId)
        .order('order_index'),
    ])
    if (q) {
      const detail = q as unknown as QuestDetail
      setQuest(detail)
      setTitle(detail.title)
      setDescription(detail.description ?? '')
      setIsBoss(detail.is_boss)
      setGradingMode(detail.grading_mode)
      setRewardXp(detail.reward_xp)
      setRewardGold(detail.reward_gold)
      setOrderIndex(detail.order_index)
      setIgnoreOrder(detail.ignore_output_order)
      setFloatTol(String(detail.float_tolerance))
      setRubric(detail.rubric ?? [])
    }
    if (tcs) setTestCases(tcs as TestCaseRow[])
  }, [dataClient, questId])

  useEffect(() => {
    reload()
  }, [reload])

  async function saveQuest(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const tol = parseFloat(floatTol)
    // Rubrik: buang baris tanpa label; key dibuat dari label (slug).
    const cleanRubric = rubric
      .filter((r) => r.label.trim())
      .map((r) => ({
        key: r.key || r.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        label: r.label.trim(),
        max: Math.max(1, Math.floor(r.max) || 1),
      }))
    const { error: updateError } = await dataClient
      .from('quest')
      .update({
        title: title.trim(),
        description: description.trim() || null,
        is_boss: isBoss,
        grading_mode: gradingMode,
        reward_xp: Math.max(0, Math.floor(rewardXp) || 0),
        reward_gold: Math.max(0, Math.floor(rewardGold) || 0),
        order_index: Math.max(1, Math.floor(orderIndex) || 1),
        ignore_output_order: ignoreOrder,
        float_tolerance: Number.isFinite(tol) && tol >= 0 ? tol : 0.001,
        rubric: gradingMode === 'manual' && cleanRubric.length > 0 ? cleanRubric : null,
      })
      .eq('id', questId)
    if (updateError) {
      setError('Gagal menyimpan quest')
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    await reload()
  }

  const chapter = quest?.chapter

  return (
    <TeacherShell
      crumbs={[
        { label: 'Beranda', to: '/guru' },
        {
          label: chapter?.class ? `Kelas ${chapter.class.name}` : '…',
          to: chapter?.class ? `/guru/kelas/${chapter.class.id}` : undefined,
        },
        { label: chapter?.title ?? '…', to: chapter ? `/guru/chapter/${chapter.id}` : undefined },
        { label: quest?.title ?? '…' },
      ]}
    >
      <Card title="Pengaturan Quest">
        <form onSubmit={saveQuest} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dim mb-1">Judul</label>
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div>
            <label className="block text-sm font-medium text-dim mb-1">Soal / instruksi</label>
            <textarea
              className={inputClass + ' h-36'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tulis soal yang dibaca siswa…"
            />
          </div>

          <div className="grid sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-dim mb-1">Reward XP</label>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={rewardXp}
                onChange={(e) => setRewardXp(Number(e.target.value))}
              />
              <p className="text-xs text-faint mt-1">Default: kecil 25, boss 100</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-dim mb-1">Reward Gold 🪙</label>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={rewardGold}
                onChange={(e) => setRewardGold(Number(e.target.value))}
              />
              <p className="text-xs text-faint mt-1">Default: kecil 10, boss 40</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-dim mb-1">Urutan</label>
              <input
                type="number"
                min={1}
                className={inputClass}
                value={orderIndex}
                onChange={(e) => setOrderIndex(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dim mb-1">Cara penilaian</label>
              <select
                className={inputClass}
                value={gradingMode}
                onChange={(e) => setGradingMode(e.target.value as 'auto' | 'manual')}
              >
                <option value="auto">Auto check (test case)</option>
                <option value="manual">Review guru (rubrik)</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={isBoss} onChange={(e) => setIsBoss(e.target.checked)} />
            Boss Quest (latihan besar — lebih menantang, reward lebih besar)
          </label>

          {gradingMode === 'auto' && (
            <div className="rounded-xl bg-surface2 border border-line p-4 space-y-3">
              <p className="text-sm font-semibold text-dim">Pengaturan auto check</p>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={ignoreOrder}
                  onChange={(e) => setIgnoreOrder(e.target.checked)}
                />
                Abaikan urutan baris output (untuk soal berurutan bebas)
              </label>
              <div className="flex items-center gap-2 text-sm text-ink">
                <span>Toleransi angka desimal:</span>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  className={inputClass + ' w-28'}
                  value={floatTol}
                  onChange={(e) => setFloatTol(e.target.value)}
                />
              </div>
            </div>
          )}

          {gradingMode === 'manual' && (
            <RubricEditor rubric={rubric} onChange={setRubric} />
          )}

          <div className="flex items-center gap-3">
            <button type="submit" className={primaryButton}>
              Simpan quest
            </button>
            {saved && <span className="text-sm text-emerald-600">Tersimpan ✓</span>}
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </form>
      </Card>

      {gradingMode === 'auto' && (
        <TestCaseSection questId={questId!} testCases={testCases} onChanged={reload} />
      )}
    </TeacherShell>
  )
}

// =============================================================================
// Editor rubrik (quest manual) — DataModel §5
// =============================================================================

function RubricEditor({
  rubric,
  onChange,
}: {
  rubric: RubricItem[]
  onChange: (r: RubricItem[]) => void
}) {
  return (
    <div className="rounded-xl bg-surface2 border border-line p-4 space-y-3">
      <p className="text-sm font-semibold text-dim">
        Rubrik penilaian <span className="font-normal text-faint">(contoh: Kebenaran logika, maks 4)</span>
      </p>
      {rubric.length === 0 && (
        <p className="text-sm text-faint">Belum ada kriteria.</p>
      )}
      {rubric.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            className={inputClass}
            placeholder="Nama kriteria"
            value={item.label}
            onChange={(e) => {
              const next = [...rubric]
              next[i] = { ...item, label: e.target.value }
              onChange(next)
            }}
          />
          <span className="text-sm text-dim whitespace-nowrap">maks</span>
          <input
            type="number"
            min={1}
            className={inputClass + ' w-20'}
            value={item.max}
            onChange={(e) => {
              const next = [...rubric]
              next[i] = { ...item, max: Number(e.target.value) }
              onChange(next)
            }}
          />
          <button
            type="button"
            className={dangerButton}
            onClick={() => onChange(rubric.filter((_, j) => j !== i))}
          >
            Hapus
          </button>
        </div>
      ))}
      <button
        type="button"
        className={subtleButton}
        onClick={() => onChange([...rubric, { key: '', label: '', max: 4 }])}
      >
        + Kriteria
      </button>
      <p className="text-xs text-faint">
        Kriteria umum: kebenaran logika, gaya penulisan kode. Disimpan bersama tombol
        "Simpan quest".
      </p>
    </div>
  )
}

// =============================================================================
// Test case (quest auto) — DataModel §4
// =============================================================================

function TestCaseSection({
  questId,
  testCases,
  onChanged,
}: {
  questId: string
  testCases: TestCaseRow[] | null
  onChanged: () => Promise<void>
}) {
  const { dataClient } = useAuth()
  const [error, setError] = useState<string | null>(null)

  async function addTestCase() {
    setError(null)
    const nextOrder = (testCases ?? []).reduce((m, t) => Math.max(m, t.order_index), 0) + 1
    const { error: insertError } = await dataClient
      .from('test_case')
      .insert({ quest_id: questId, stdin: '', expected_output: '', order_index: nextOrder })
    if (insertError) setError('Gagal menambah test case')
    await onChanged()
  }

  async function updateTestCase(id: string, patch: Partial<TestCaseRow>) {
    setError(null)
    const { error: updateError } = await dataClient.from('test_case').update(patch).eq('id', id)
    if (updateError) setError('Gagal menyimpan test case')
  }

  async function deleteTestCase(id: string) {
    setError(null)
    const { error: deleteError } = await dataClient.from('test_case').delete().eq('id', id)
    if (deleteError) setError('Gagal menghapus test case')
    await onChanged()
  }

  return (
    <Card
      title={`Test Case${testCases ? ` (${testCases.length})` : ''}`}
      subtitle='Input diberikan ke program lewat input(); output dibandingkan dengan "Output yang diharapkan". Centang "tersembunyi" agar tidak ditampilkan ke siswa.'
    >
      {testCases === null && <p className="text-sm text-faint">Memuat…</p>}
      {testCases !== null && testCases.length === 0 && (
        <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-3">
          Quest auto check butuh minimal 1 test case agar bisa dinilai.
        </p>
      )}
      <div className="space-y-4">
        {testCases?.map((tc, i) => (
          <TestCaseEditor
            key={tc.id}
            index={i + 1}
            testCase={tc}
            onSave={(patch) => updateTestCase(tc.id, patch)}
            onDelete={() => {
              if (window.confirm(`Hapus test case #${i + 1}?`)) deleteTestCase(tc.id)
            }}
          />
        ))}
      </div>
      <button className={subtleButton + ' mt-4'} onClick={addTestCase}>
        + Test case
      </button>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-3">{error}</p>}
    </Card>
  )
}

function TestCaseEditor({
  index,
  testCase,
  onSave,
  onDelete,
}: {
  index: number
  testCase: TestCaseRow
  onSave: (patch: Partial<TestCaseRow>) => Promise<void>
  onDelete: () => void
}) {
  const [stdin, setStdin] = useState(testCase.stdin)
  const [expected, setExpected] = useState(testCase.expected_output)
  const [hidden, setHidden] = useState(testCase.is_hidden)
  const [saved, setSaved] = useState(false)

  const dirty =
    stdin !== testCase.stdin || expected !== testCase.expected_output || hidden !== testCase.is_hidden

  return (
    <div className="rounded-xl border border-line p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-dim">Test case #{index}</p>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm text-dim">
            <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
            tersembunyi
          </label>
          <button className={dangerButton} onClick={onDelete}>
            Hapus
          </button>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-dim mb-1">
            Input (stdin) — satu nilai per baris
          </label>
          <textarea
            className={inputClass + ' h-24 font-mono text-sm'}
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            placeholder={'5\n7'}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-dim mb-1">
            Output yang diharapkan
          </label>
          <textarea
            className={inputClass + ' h-24 font-mono text-sm'}
            value={expected}
            onChange={(e) => setExpected(e.target.value)}
            placeholder={'12'}
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          className={primaryButton}
          disabled={!dirty}
          onClick={async () => {
            await onSave({ stdin, expected_output: expected, is_hidden: hidden })
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
          }}
        >
          Simpan test case
        </button>
        {saved && <span className="text-sm text-emerald-600">Tersimpan ✓</span>}
      </div>
    </div>
  )
}
