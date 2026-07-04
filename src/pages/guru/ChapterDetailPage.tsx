import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import {
  Card,
  TeacherShell,
  dangerButton,
  inputClass,
  primaryButton,
  subtleButton,
} from '../../components/teacher/shared'

interface ChapterInfo {
  title: string
  description: string | null
  class: {
    id: string
    name: string
    semester: { id: string; name: string; academic_year: { id: string; label: string } | null } | null
  } | null
}

interface QuestRow {
  id: string
  title: string
  order_index: number
  is_boss: boolean
  grading_mode: 'auto' | 'manual'
  reward_xp: number
}

/**
 * Halaman satu Chapter: edit judul/materi + kelola quest di dalamnya.
 * Chapter baru sudah otomatis berisi 3 latihan kecil + 1 boss (trigger DB).
 */
export default function ChapterDetailPage() {
  const { chapterId } = useParams<{ chapterId: string }>()
  const { dataClient } = useAuth()

  const [info, setInfo] = useState<ChapterInfo | null>(null)
  const [quests, setQuests] = useState<QuestRow[] | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const [{ data: chapter }, { data: questRows }] = await Promise.all([
      dataClient
        .from('chapter')
        .select(
          'title, description, class:class_id(id, name, semester:semester_id(id, name, academic_year:academic_year_id(id, label)))',
        )
        .eq('id', chapterId)
        .single(),
      dataClient
        .from('quest')
        .select('id, title, order_index, is_boss, grading_mode, reward_xp')
        .eq('chapter_id', chapterId)
        .order('order_index'),
    ])
    if (chapter) {
      const c = chapter as unknown as ChapterInfo
      setInfo(c)
      setTitle(c.title)
      setDescription(c.description ?? '')
    }
    if (questRows) setQuests(questRows as QuestRow[])
  }, [dataClient, chapterId])

  useEffect(() => {
    reload()
  }, [reload])

  async function saveChapter(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const { error: updateError } = await dataClient
      .from('chapter')
      .update({ title: title.trim(), description: description.trim() || null })
      .eq('id', chapterId)
    if (updateError) {
      setError('Gagal menyimpan chapter')
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    await reload()
  }

  async function addQuest(isBoss: boolean) {
    setError(null)
    const nextOrder = (quests ?? []).reduce((m, q) => Math.max(m, q.order_index), 0) + 1
    // Default reward sesuai DataModel §6.1: kecil 25 XP, boss 100 XP.
    const { error: insertError } = await dataClient.from('quest').insert({
      chapter_id: chapterId,
      title: isBoss ? 'Boss Quest baru' : 'Latihan baru',
      order_index: nextOrder,
      is_boss: isBoss,
      grading_mode: isBoss ? 'manual' : 'auto',
      reward_xp: isBoss ? 100 : 25,
    })
    if (insertError) setError('Gagal menambah quest')
    await reload()
  }

  async function deleteQuest(quest: QuestRow) {
    if (
      !window.confirm(
        `Hapus quest "${quest.title}"?\n\nSemua pekerjaan siswa pada quest ini ikut terhapus.`,
      )
    )
      return
    const { error: deleteError } = await dataClient.from('quest').delete().eq('id', quest.id)
    if (deleteError) setError('Gagal menghapus quest')
    await reload()
  }

  const cls = info?.class

  return (
    <TeacherShell
      crumbs={[
        { label: 'Beranda', to: '/guru' },
        {
          label: cls?.semester?.academic_year?.label ?? '…',
          to: cls?.semester?.academic_year ? `/guru/tahun/${cls.semester.academic_year.id}` : undefined,
        },
        {
          label: cls?.semester ? `Semester ${cls.semester.name}` : '…',
          to: cls?.semester ? `/guru/semester/${cls.semester.id}` : undefined,
        },
        { label: cls ? `Kelas ${cls.name}` : '…', to: cls ? `/guru/kelas/${cls.id}` : undefined },
        { label: info?.title ?? '…' },
      ]}
    >
      <Card title="Chapter" subtitle="Judul dan materi/pengantar yang dibaca siswa.">
        <form onSubmit={saveChapter} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-dim mb-1">Judul</label>
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-dim mb-1">
              Materi / pengantar (opsional)
            </label>
            <textarea
              className={inputClass + ' h-28'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ringkasan materi pertemuan ini…"
            />
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" className={primaryButton}>
              Simpan
            </button>
            {saved && <span className="text-sm text-emerald-600">Tersimpan ✓</span>}
          </div>
        </form>
      </Card>

      <Card title="Quest" subtitle="Klik quest untuk mengedit soal, XP, test case, dan rubrik.">
        {quests === null && <p className="text-sm text-faint">Memuat…</p>}
        <ul className="space-y-2">
          {quests?.map((q) => (
            <li
              key={q.id}
              className="rounded-lg border border-line px-4 py-3 flex items-center gap-3"
            >
              <Link
                to={`/guru/quest/${q.id}`}
                className="flex-1 font-medium text-ink hover:text-indigo-700"
              >
                <span className="text-faint mr-2">{q.order_index}.</span>
                {q.title}
                {q.is_boss && (
                  <span className="ml-2 text-xs font-bold bg-rose-100 text-rose-700 rounded-full px-2 py-0.5">
                    BOSS
                  </span>
                )}
                <span className="ml-2 text-xs font-semibold bg-surface2 text-dim rounded-full px-2 py-0.5">
                  {q.grading_mode === 'auto' ? 'auto check' : 'review guru'}
                </span>
                <span className="ml-2 text-xs font-semibold bg-indigo-50 text-indigo-600 rounded-full px-2 py-0.5">
                  {q.reward_xp} XP
                </span>
              </Link>
              <button className={dangerButton} onClick={() => deleteQuest(q)}>
                Hapus
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2 mt-4">
          <button className={subtleButton} onClick={() => addQuest(false)}>
            + Latihan kecil
          </button>
          <button className={subtleButton} onClick={() => addQuest(true)}>
            + Boss Quest
          </button>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-3">{error}</p>}
      </Card>
    </TeacherShell>
  )
}
