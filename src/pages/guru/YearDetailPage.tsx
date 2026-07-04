import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { Card, CrudList, TeacherShell, type CrudItem } from '../../components/teacher/shared'

/** Halaman satu Tahun Ajaran: kelola semester di dalamnya. */
export default function YearDetailPage() {
  const { yearId } = useParams<{ yearId: string }>()
  const { dataClient } = useAuth()
  const [yearLabel, setYearLabel] = useState('')
  const [items, setItems] = useState<CrudItem[] | null>(null)

  const reload = useCallback(async () => {
    const [{ data: year }, { data: semesters }] = await Promise.all([
      dataClient.from('academic_year').select('label').eq('id', yearId).single(),
      dataClient
        .from('semester')
        .select('id, name')
        .eq('academic_year_id', yearId)
        .order('created_at'),
    ])
    if (year) setYearLabel(year.label)
    if (semesters) {
      setItems(semesters.map((s) => ({ id: s.id, label: s.name, href: `/guru/semester/${s.id}` })))
    }
  }, [dataClient, yearId])

  useEffect(() => {
    reload()
  }, [reload])

  return (
    <TeacherShell
      crumbs={[{ label: 'Beranda', to: '/guru' }, { label: yearLabel || '…' }]}
    >
      <Card title={`Semester — ${yearLabel}`} subtitle="Biasanya Ganjil dan Genap.">
        <CrudList
          items={items}
          emptyText="Belum ada semester."
          createPlaceholder="Nama semester"
          quickAdds={['Ganjil', 'Genap']}
          onCreate={async (name) => {
            const { error } = await dataClient
              .from('semester')
              .insert({ academic_year_id: yearId, name })
            if (error) throw new Error('Gagal membuat semester')
            await reload()
          }}
          onRename={async (id, name) => {
            const { error } = await dataClient.from('semester').update({ name }).eq('id', id)
            if (error) throw new Error('Gagal mengubah nama')
            await reload()
          }}
          onDelete={async (id) => {
            const { error } = await dataClient.from('semester').delete().eq('id', id)
            if (error) throw new Error('Gagal menghapus')
            await reload()
          }}
          deleteConfirmText={(label) =>
            `Hapus semester "${label}"?\n\nSemua kelas, siswa, chapter, quest, dan pekerjaan siswa di dalamnya ikut terhapus.`
          }
        />
      </Card>
    </TeacherShell>
  )
}
