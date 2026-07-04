import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { Card, CrudList, TeacherShell, type CrudItem } from '../../components/teacher/shared'

/**
 * Beranda guru: daftar & kelola Tahun Ajaran (PRD §5.1 "sebelum semester").
 * RLS menjamin hanya tahun ajaran milik guru ini yang tampil/tersentuh.
 */
export default function YearsPage() {
  const { state, dataClient } = useAuth()
  const [items, setItems] = useState<CrudItem[] | null>(null)

  const teacherId = state.status === 'teacher' ? state.session.user.id : null

  const reload = useCallback(async () => {
    const { data, error } = await dataClient
      .from('academic_year')
      .select('id, label')
      .order('created_at', { ascending: false })
    if (!error && data) {
      setItems(
        data.map((y) => ({ id: y.id, label: y.label, href: `/guru/tahun/${y.id}` })),
      )
    }
  }, [dataClient])

  useEffect(() => {
    reload()
  }, [reload])

  return (
    <TeacherShell crumbs={[{ label: 'Tahun Ajaran' }]}>
      <Card
        title="Tahun Ajaran"
        subtitle="Mulai dari sini: buat tahun ajaran, lalu semester, kelas, dan chapter di dalamnya."
      >
        <CrudList
          items={items}
          emptyText="Belum ada tahun ajaran. Buat yang pertama, contoh: 2026/2027."
          createPlaceholder="Contoh: 2026/2027"
          onCreate={async (label) => {
            const { error } = await dataClient
              .from('academic_year')
              .insert({ teacher_id: teacherId, label })
            if (error) throw new Error('Gagal membuat tahun ajaran')
            await reload()
          }}
          onRename={async (id, label) => {
            const { error } = await dataClient.from('academic_year').update({ label }).eq('id', id)
            if (error) throw new Error('Gagal mengubah nama')
            await reload()
          }}
          onDelete={async (id) => {
            const { error } = await dataClient.from('academic_year').delete().eq('id', id)
            if (error) throw new Error('Gagal menghapus')
            await reload()
          }}
          deleteConfirmText={(label) =>
            `Hapus tahun ajaran "${label}"?\n\nSEMUA isinya ikut terhapus: semester, kelas, siswa, chapter, quest, dan seluruh pekerjaan siswa di dalamnya. Tindakan ini tidak bisa dibatalkan.`
          }
        />
      </Card>
    </TeacherShell>
  )
}
