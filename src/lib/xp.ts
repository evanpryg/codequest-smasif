/**
 * Formula Level dari XP — DataModel.md §6.1.
 *
 * XP naik level L -> L+1 = 100 × L
 * Total XP kumulatif untuk mencapai level N = 50 × N × (N − 1)
 * level = floor( (1 + sqrt(1 + 0.08 × total_xp)) / 2 )
 *
 * Sumber kebenaran level tersimpan di DB (trigger apply_xp_to_student);
 * fungsi di sini hanya untuk tampilan (progress bar, "XP menuju level N+1").
 */

export function levelFromXp(totalXp: number): number {
  return Math.max(1, Math.floor((1 + Math.sqrt(1 + 0.08 * totalXp)) / 2))
}

/** Total XP kumulatif yang dibutuhkan untuk MENCAPAI level N. */
export function totalXpForLevel(level: number): number {
  return 50 * level * (level - 1)
}

/** Progres menuju level berikutnya, untuk progress bar. */
export function xpProgress(totalXp: number): {
  level: number
  currentLevelXp: number // XP yang sudah terkumpul di level ini
  neededXp: number //       XP yang dibutuhkan dari level ini ke berikutnya
  fraction: number //       0..1
} {
  const level = levelFromXp(totalXp)
  const floor = totalXpForLevel(level)
  const ceil = totalXpForLevel(level + 1)
  const currentLevelXp = totalXp - floor
  const neededXp = ceil - floor
  return {
    level,
    currentLevelXp,
    neededXp,
    fraction: Math.min(1, Math.max(0, currentLevelXp / neededXp)),
  }
}
