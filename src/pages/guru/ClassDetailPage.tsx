import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import {
  Card,
  CrudList,
  TeacherShell,
  dangerButton,
  inputClass,
  primaryButton,
  subtleButton,
  type CrudItem,
} from '../../components/teacher/shared'
import { cleanNameList, parseStudentNames } from '../../lib/excel'
import { generatePassword, hashPassword } from '../../lib/password'

interface ClassInfo {
  name: string
  semester: {
    id: string
    name: string
    academic_year: { id: string; label: string } | null
  } | null
}

interface StudentRow {
  id: string
  name: string
  level: number
  total_xp: number
  must_change_password: boolean
}

/** Kredensial yang baru dibuat — plaintext hanya tampil sekali di layar guru. */
interface NewCredential {
  name: string
  password: string
}

export default function ClassDetailPage() {
  const { classId } = useParams<{ classId: string }>()
  const { dataClient } = useAuth()

  const [info, setInfo] = useState<ClassInfo | null>(null)
  const [students, setStudents] = useState<StudentRow[] | null>(null)
  const [chapters, setChapters] = useState<CrudItem[] | null>(null)
  const [maxChapterOrder, setMaxChapterOrder] = useState(0)

  const reload = useCallback(async () => {
    const [{ data: cls }, { data: studentRows }, { data: chapterRows }] = await Promise.all([
      dataClient
        .from('class')
        .select('name, semester:semester_id(id, name, academic_year:academic_year_id(id, label))')
        .eq('id', classId)
        .single(),
      dataClient
        .from('student')
        .select('id, name, level, total_xp, must_change_password')
        .eq('class_id', classId)
        .order('name'),
      dataClient
        .from('chapter')
        .select('id, title, order_index')
        .eq('class_id', classId)
        .order('order_index'),
    ])
    if (cls) setInfo(cls as unknown as ClassInfo)
    if (studentRows) setStudents(studentRows)
    if (chapterRows) {
      setChapters(
        chapterRows.map((c) => ({
          id: c.id,
          label: c.title,
          href: `/guru/chapter/${c.id}`,
          badge: `Pertemuan ${c.order_index}`,
        })),
      )
      setMaxChapterOrder(chapterRows.reduce((max, c) => Math.max(max, c.order_index), 0))
    }
  }, [dataClient, classId])

  useEffect(() => {
    reload()
  }, [reload])

  const nextChapterIndex = maxChapterOrder + 1

  return (
    <TeacherShell
      crumbs={[
        { label: 'Tahun Ajaran', to: '/guru' },
        {
          label: info?.semester?.academic_year?.label ?? '…',
          to: info?.semester?.academic_year
            ? `/guru/tahun/${info.semester.academic_year.id}`
            : undefined,
        },
        {
          label: info?.semester ? `Semester ${info.semester.name}` : '…',
          to: info?.semester ? `/guru/semester/${info.semester.id}` : undefined,
        },
        { label: info ? `Kelas ${info.name}` : '…' },
      ]}
    >
      <section className="flex flex-wrap gap-3">
        <Link
          to={`/guru/kelas/${classId}/live`}
          className="flex-1 min-w-48 rounded-2xl bg-indigo-600 text-white shadow-sm p-5 hover:bg-indigo-700"
        >
          <p className="text-lg font-bold">🎓 Mulai Mengajar</p>
          <p className="text-sm text-indigo-200">
            Live progress, pilih siswa acak, presentasi kode
          </p>
        </Link>
        <Link
          to={`/guru/kelas/${classId}/rekap`}
          className="flex-1 min-w-48 rounded-2xl bg-white shadow-sm p-5 border border-slate-200 hover:border-indigo-300"
        >
          <p className="text-lg font-bold text-slate-700">📊 Rekap Nilai</p>
          <p className="text-sm text-slate-500">Status & skor semua siswa per chapter</p>
        </Link>
      </section>

      <Card
        title="Chapter (Pertemuan)"
        subtitle="Chapter baru otomatis berisi template: 3 latihan kecil + 1 latihan besar (Boss Quest). Semua bisa diubah."
      >
        <CrudList
          items={chapters}
          emptyText="Belum ada chapter."
          createPlaceholder="Judul chapter, contoh: Variabel & Tipe Data"
          onCreate={async (title) => {
            const { error } = await dataClient
              .from('chapter')
              .insert({ class_id: classId, title, order_index: nextChapterIndex })
            if (error) throw new Error('Gagal membuat chapter')
            await reload()
          }}
          onRename={async (id, title) => {
            const { error } = await dataClient.from('chapter').update({ title }).eq('id', id)
            if (error) throw new Error('Gagal mengubah judul')
            await reload()
          }}
          onDelete={async (id) => {
            const { error } = await dataClient.from('chapter').delete().eq('id', id)
            if (error) throw new Error('Gagal menghapus')
            await reload()
          }}
          deleteConfirmText={(label) =>
            `Hapus chapter "${label}"?\n\nSemua quest dan pekerjaan siswa di chapter ini ikut terhapus.`
          }
        />
      </Card>

      <StudentSection
        classId={classId!}
        students={students}
        onChanged={reload}
      />
    </TeacherShell>
  )
}

// =============================================================================
// Roster siswa + impor Excel + reset password
// =============================================================================

function StudentSection({
  classId,
  students,
  onChanged,
}: {
  classId: string
  students: StudentRow[] | null
  onChanged: () => Promise<void>
}) {
  const { dataClient } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)

  const [pasteText, setPasteText] = useState('')
  const [pendingNames, setPendingNames] = useState<string[] | null>(null)
  const [skippedNames, setSkippedNames] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [credentials, setCredentials] = useState<NewCredential[]>([])
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const existingNames = new Set((students ?? []).map((s) => s.name.toLowerCase()))

  function receiveNames(names: string[]) {
    setError(null)
    setCredentials([])
    const fresh = names.filter((n) => !existingNames.has(n.toLowerCase()))
    setSkippedNames(names.filter((n) => existingNames.has(n.toLowerCase())))
    setPendingNames(fresh)
    if (names.length === 0) setError('Tidak ada nama yang terbaca.')
  }

  async function onFileChosen(file: File) {
    try {
      receiveNames(await parseStudentNames(file))
    } catch {
      setError('File tidak bisa dibaca. Pastikan formatnya .xlsx, .xls, atau .csv.')
    }
  }

  async function doImport() {
    if (!pendingNames || pendingNames.length === 0) return
    setImporting(true)
    setError(null)
    try {
      // Hash di browser; hanya hash yang dikirim/disimpan (plaintext tampil
      // sekali di layar guru untuk dibagikan ke siswa).
      const creds: NewCredential[] = []
      const rows: { class_id: string; name: string; password_hash: string }[] = []
      for (let i = 0; i < pendingNames.length; i++) {
        const password = generatePassword()
        rows.push({
          class_id: classId,
          name: pendingNames[i],
          password_hash: await hashPassword(password),
        })
        creds.push({ name: pendingNames[i], password })
        setProgress(i + 1)
      }
      const { error: insertError } = await dataClient.from('student').insert(rows)
      if (insertError) throw new Error('Gagal menyimpan siswa: ' + insertError.message)
      setCredentials(creds)
      setPendingNames(null)
      setPasteText('')
      if (fileRef.current) fileRef.current.value = ''
      await onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impor gagal')
    } finally {
      setImporting(false)
      setProgress(0)
    }
  }

  async function resetPassword(student: StudentRow) {
    if (
      !window.confirm(
        `Reset password ${student.name}?\nPassword lama tidak akan bisa dipakai lagi.`,
      )
    )
      return
    const password = generatePassword()
    const { error: updateError } = await dataClient
      .from('student')
      .update({ password_hash: await hashPassword(password), must_change_password: true })
      .eq('id', student.id)
    if (updateError) {
      setError('Gagal mereset password')
      return
    }
    setCredentials([{ name: student.name, password }])
    await onChanged()
  }

  async function deleteStudent(student: StudentRow) {
    if (
      !window.confirm(
        `Hapus siswa "${student.name}"?\n\nSeluruh pekerjaan, XP, dan achievement-nya ikut terhapus.`,
      )
    )
      return
    const { error: deleteError } = await dataClient.from('student').delete().eq('id', student.id)
    if (deleteError) setError('Gagal menghapus siswa')
    await onChanged()
  }

  async function copyCredentials() {
    const text = credentials.map((c) => `${c.name}\t${c.password}`).join('\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card
      title={`Siswa${students ? ` (${students.length})` : ''}`}
      subtitle="Impor dari Excel/CSV (nama di kolom pertama) atau tempel daftar nama. Password awal dibuat otomatis."
    >
      {/* Hasil impor / reset: plaintext hanya tampil sekali di sini */}
      {credentials.length > 0 && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-emerald-800">
              Password baru — catat/bagikan SEKARANG (tidak akan tampil lagi):
            </p>
            <button className={subtleButton} onClick={copyCredentials}>
              {copied ? 'Tersalin ✓' : 'Salin semua'}
            </button>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {credentials.map((c) => (
                <tr key={c.name} className="border-t border-emerald-100">
                  <td className="py-1 text-emerald-900">{c.name}</td>
                  <td className="py-1 font-mono font-semibold text-emerald-900">{c.password}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pratinjau impor */}
      {pendingNames !== null && (
        <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-2">
          <p className="font-semibold text-indigo-900">
            {pendingNames.length} siswa siap diimpor
            {skippedNames.length > 0 &&
              ` (${skippedNames.length} dilewati karena nama sudah ada: ${skippedNames.join(', ')})`}
          </p>
          <p className="text-sm text-indigo-800">{pendingNames.join(', ')}</p>
          <div className="flex gap-2">
            <button className={primaryButton} onClick={doImport} disabled={importing || pendingNames.length === 0}>
              {importing ? `Menyiapkan… (${progress}/${pendingNames.length})` : 'Impor sekarang'}
            </button>
            <button className={subtleButton} onClick={() => setPendingNames(null)} disabled={importing}>
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Sumber impor */}
      {pendingNames === null && (
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div className="rounded-xl border border-dashed border-slate-300 p-4">
            <p className="text-sm font-semibold text-slate-600 mb-2">Dari file Excel/CSV</p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:text-white file:px-3 file:py-1.5 file:font-semibold hover:file:bg-indigo-700"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onFileChosen(f)
              }}
            />
          </div>
          <div className="rounded-xl border border-dashed border-slate-300 p-4">
            <p className="text-sm font-semibold text-slate-600 mb-2">Atau tempel daftar nama (satu per baris)</p>
            <textarea
              className={inputClass + ' h-20 text-sm'}
              placeholder={'Budi Santoso\nSiti Aminah\n…'}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <button
              className={subtleButton + ' mt-2'}
              disabled={!pasteText.trim()}
              onClick={() => receiveNames(cleanNameList(pasteText.split('\n')))}
            >
              Baca daftar
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>}

      {/* Roster */}
      {students === null && <p className="text-sm text-slate-400">Memuat…</p>}
      {students !== null && students.length === 0 && (
        <p className="text-sm text-slate-400">Belum ada siswa di kelas ini.</p>
      )}
      {students !== null && students.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2 font-semibold">Nama</th>
              <th className="py-2 font-semibold">Level</th>
              <th className="py-2 font-semibold">XP</th>
              <th className="py-2 font-semibold">Status</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-b border-slate-100">
                <td className="py-2 font-medium text-slate-700">{s.name}</td>
                <td className="py-2 text-slate-600">{s.level}</td>
                <td className="py-2 text-slate-600">{s.total_xp}</td>
                <td className="py-2">
                  {s.must_change_password ? (
                    <span className="text-xs font-semibold bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">
                      belum ganti password
                    </span>
                  ) : (
                    <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">
                      aktif
                    </span>
                  )}
                </td>
                <td className="py-2 text-right space-x-2 whitespace-nowrap">
                  <button className={subtleButton} onClick={() => resetPassword(s)}>
                    Reset password
                  </button>
                  <button className={dangerButton} onClick={() => deleteStudent(s)}>
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}
