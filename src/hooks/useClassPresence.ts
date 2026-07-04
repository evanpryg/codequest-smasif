import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Status "online" siswa via Supabase Realtime Presence (DataModel §8 —
 * tidak perlu kolom permanen). Kanal per kelas: `class-{classId}`.
 *
 * - Siswa: `useTrackPresence` menandai dirinya hadir selama halaman terbuka.
 * - Guru : `useOnlineStudents` membaca daftar student_id yang sedang hadir.
 */

export function useTrackPresence(
  client: SupabaseClient,
  classId: string | null,
  studentId: string | null,
  name: string,
) {
  useEffect(() => {
    if (!classId || !studentId) return
    const channel = client.channel(`class-${classId}`, {
      config: { presence: { key: studentId } },
    })
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.track({ name, at: Date.now() })
      }
    })
    return () => {
      channel.unsubscribe()
    }
  }, [client, classId, studentId, name])
}

export function useOnlineStudents(client: SupabaseClient, classId: string | null): Set<string> {
  const [online, setOnline] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!classId) return
    const channel = client.channel(`class-${classId}`)
    channel.on('presence', { event: 'sync' }, () => {
      setOnline(new Set(Object.keys(channel.presenceState())))
    })
    channel.subscribe()
    return () => {
      channel.unsubscribe()
    }
  }, [client, classId])

  return online
}
