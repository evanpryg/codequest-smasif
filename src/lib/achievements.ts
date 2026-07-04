import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Pemberian XP & achievement saat siswa LOLOS quest (pertama kali).
 *
 * Berjalan di sisi klien dengan sesi siswa — RLS hanya mengizinkan menulis
 * xp_log/student_achievement miliknya sendiri, dan trigger DB
 * (apply_xp_to_student) yang menghitung total_xp & level. Risiko manipulasi
 * client-side diterima untuk MVP: gamifikasi tidak memengaruhi nilai akademik
 * (TechDecisions §2.1, PRD prinsip #3).
 *
 * Daftar achievement mengikuti DataModel §6.2; semua dihitung dari data yang
 * sudah ada. Duplikat dicegah oleh unique(student_id, achievement_id).
 */

export interface PassContext {
  studentId: string
  questId: string
  chapterId: string
  isBoss: boolean
  rewardXp: number
  /** Jumlah percobaan submit untuk quest ini, TERMASUK yang lolos ini. */
  attemptCount: number
  /** true bila quest ini sudah pernah lolos sebelumnya (tidak ada XP ulang). */
  wasAlreadyPassed: boolean
}

export interface PassRewards {
  xpAwarded: number
  newAchievements: { code: string; name: string }[]
}

export async function awardPassRewards(
  client: SupabaseClient,
  ctx: PassContext,
): Promise<PassRewards> {
  if (ctx.wasAlreadyPassed) return { xpAwarded: 0, newAchievements: [] }

  // 1. XP — sekali per quest; trigger DB menaikkan total_xp & level.
  const { error: xpError } = await client.from('xp_log').insert({
    student_id: ctx.studentId,
    amount: ctx.rewardXp,
    reason: 'Quest selesai',
    source_quest_id: ctx.questId,
  })
  const xpAwarded = xpError ? 0 : ctx.rewardXp

  // 2. Kumpulkan data untuk syarat achievement. Selalu difilter student_id —
  //    fungsi ini juga dipanggil dari SESI GURU (meluluskan review manual),
  //    di mana RLS mengembalikan data seluruh siswa miliknya.
  const [{ data: passedSubs }, { data: chapterQuests }, { data: me }] = await Promise.all([
    client
      .from('submission')
      .select('quest_id, quest:quest_id(id, is_boss, chapter_id)')
      .eq('student_id', ctx.studentId)
      .eq('status', 'passed'),
    client.from('quest').select('id, is_boss').eq('chapter_id', ctx.chapterId),
    client.from('student').select('level').eq('id', ctx.studentId).single(),
  ])

  // Quest yang baru saja lolos mungkin belum ter-refleksi di query submission
  // (update status berjalan bersamaan) — pastikan terhitung.
  const passedQuestIds = new Set<string>((passedSubs ?? []).map((s) => s.quest_id as string))
  passedQuestIds.add(ctx.questId)
  const passedBossCount = (passedSubs ?? []).filter(
    (s) => (s.quest as unknown as { is_boss: boolean } | null)?.is_boss,
  ).length + (ctx.isBoss ? 1 : 0)

  const chapterDone =
    (chapterQuests ?? []).length > 0 &&
    (chapterQuests ?? []).every((q) => passedQuestIds.has(q.id))
  const chapterHasBoss = (chapterQuests ?? []).some((q) => q.is_boss)

  const codes: string[] = []
  if (passedQuestIds.size >= 1) codes.push('first_quest')
  if (ctx.isBoss && passedBossCount >= 1) codes.push('first_boss')
  if (chapterDone) codes.push('chapter_clear')
  if (passedQuestIds.size >= 10) codes.push('quests_10')
  if (passedQuestIds.size >= 25) codes.push('quests_25')
  if ((me?.level ?? 1) >= 5) codes.push('level_5')
  if (ctx.attemptCount === 1) codes.push('flawless')
  if (ctx.attemptCount >= 5) codes.push('persistence')
  if (chapterDone && chapterHasBoss) codes.push('full_chapter_boss')

  if (codes.length === 0) return { xpAwarded, newAchievements: [] }

  // 3. Terjemahkan code -> id, lalu insert yang BELUM dimiliki.
  const [{ data: defs }, { data: owned }] = await Promise.all([
    client.from('achievement').select('id, code, name').in('code', codes),
    client
      .from('student_achievement')
      .select('achievement_id')
      .eq('student_id', ctx.studentId),
  ])
  const ownedIds = new Set((owned ?? []).map((o) => o.achievement_id as string))
  const fresh = (defs ?? []).filter((d) => !ownedIds.has(d.id))
  if (fresh.length === 0) return { xpAwarded, newAchievements: [] }

  const { error: insertError } = await client.from('student_achievement').insert(
    fresh.map((d) => ({ student_id: ctx.studentId, achievement_id: d.id })),
  )
  if (insertError) return { xpAwarded, newAchievements: [] }

  return {
    xpAwarded,
    newAchievements: fresh.map((d) => ({ code: d.code, name: d.name })),
  }
}
