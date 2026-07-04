import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { Card, CrudList, TeacherShell, type CrudItem } from '../../components/teacher/shared'

interface SemesterInfo {
  name: string
  academic_year: { id: string; label: string } | null
}

/** Halaman satu Semester: kelola kelas di dalamnya. */
export default function SemesterDetailPage() {
  const { semesterId } = useParams<{ semesterId: string }>()
  const { dataClient } = useAuth()
  const [info, setInfo] = useState<SemesterInfo | null>(null)
  const [items, setItems] = useState<CrudItem[] | null>(null)

  const reload = useCallback(async () => {
    const [{ data: semester }, { data: classes }] = await Promise.all([
      dataClient
        .from('semester')
        .select('name, academic_year:academic_year_id(id, label)')
        .eq('id', semesterId)
        .single(),
      dataClient
        .from('class')
        .select('id, name')
        .eq('semester_id', semesterId)
        .order('name'),
    ])
    if (semester) setInfo(semester as unknown as SemesterInfo)
    if (classes) {
      setItems(classes.map((c) => ({ id: c.id, label: c.name, href: `/guru/kelas/${c.id}` })))
    }
  }, [dataClient, semesterId])

  useEffect(() => {
    reload()
  }, [reload])

  return (
    <TeacherShell
      crumbs={[
        { label: 'Beranda', to: '/guru' },
        {
          label: info?.academic_year?.label ?? '…',
          to: info?.academic_year ? `/guru/tahun/${info.academic_year.id}` : undefined,
        },
        { label: info ? `Semester ${info.name}` : '…' },
      ]}
    >
      <Card
        title={info ? `Kelas — Semester ${info.name}` : 'Kelas'}
        subtitle="Contoh nama kelas: X-1, X-2, XI IPA 3."
      >
        <CrudList
          items={items}
          emptyText="Belum ada kelas."
          createPlaceholder="Nama kelas, contoh: X-1"
          onCreate={async (name) => {
            const { error } = await dataClient
              .from('class')
              .insert({ semester_id: semesterId, name })
            if (error) throw new Error('Gagal membuat kelas')
            await reload()
          }}
          onRename={async (id, name) => {
            const { error } = await dataClient.from('class').update({ name }).eq('id', id)
            if (error) throw new Error('Gagal mengubah nama')
            await reload()
          }}
          onDelete={async (id) => {
            const { error } = await dataClient.from('class').delete().eq('id', id)
            if (error) throw new Error('Gagal menghapus')
            await reload()
          }}
          deleteConfirmText={(label) =>
            `Hapus kelas "${label}"?\n\nSemua siswa, chapter, quest, dan pekerjaan siswa di kelas ini ikut terhapus.`
          }
        />
      </Card>
    </TeacherShell>
  )
}
