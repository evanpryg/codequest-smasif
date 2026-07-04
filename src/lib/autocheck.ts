/**
 * Pembanding output Auto Check — aturan normalisasi dari MVP-Scope §6:
 *
 * - Whitespace: trim spasi di AKHIR tiap baris dan baris kosong di AKHIR
 *   output; spasi di TENGAH baris tetap dihitung.
 * - Floating point: token angka dibandingkan dengan toleransi per-quest
 *   (default 0.001). Jalur toleransi hanya dipakai bila barisnya memuat
 *   angka desimal — baris teks murni tetap harus sama persis (termasuk
 *   spasi tengah).
 * - Urutan baris: diperhatikan secara default; `ignoreOrder` per-quest
 *   membandingkan sebagai kumpulan baris (untuk soal berurutan bebas).
 */

export interface CompareOptions {
  floatTolerance: number
  ignoreOrder: boolean
}

/** rstrip tiap baris + buang baris kosong di akhir. */
export function normalizeOutput(text: string): string[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n').map((l) => l.replace(/\s+$/g, ''))
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

function isNumericToken(token: string): boolean {
  return /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(token)
}

/**
 * Bandingkan satu baris. Baris tanpa angka harus sama persis. Baris dengan
 * angka: token non-angka harus sama & angka dibandingkan dengan toleransi.
 */
function lineMatches(expected: string, actual: string, tolerance: number): boolean {
  if (expected === actual) return true

  const expTokens = expected.split(/\s+/).filter(Boolean)
  const actTokens = actual.split(/\s+/).filter(Boolean)
  // Jalur toleransi hanya untuk baris yang memang memuat angka.
  if (!expTokens.some(isNumericToken)) return false
  if (expTokens.length !== actTokens.length) return false

  for (let i = 0; i < expTokens.length; i++) {
    const e = expTokens[i]
    const a = actTokens[i]
    if (isNumericToken(e) && isNumericToken(a)) {
      if (Math.abs(parseFloat(e) - parseFloat(a)) > tolerance) return false
    } else if (e !== a) {
      return false
    }
  }
  return true
}

export interface CompareResult {
  passed: boolean
  /** Penjelasan singkat untuk ditampilkan (baris pertama yang beda, dsb). */
  detail: string | null
}

export function compareOutput(
  expectedText: string,
  actualText: string,
  options: CompareOptions,
): CompareResult {
  const expected = normalizeOutput(expectedText)
  const actual = normalizeOutput(actualText)

  if (expected.length !== actual.length) {
    return {
      passed: false,
      detail: `Jumlah baris output beda: diharapkan ${expected.length}, program mencetak ${actual.length}.`,
    }
  }

  if (options.ignoreOrder) {
    // Kumpulan baris: tiap baris expected harus terpasangkan dengan satu baris
    // actual yang cocok (greedy — cukup untuk latihan sekolah).
    const remaining = [...actual]
    for (const exp of expected) {
      const idx = remaining.findIndex((act) => lineMatches(exp, act, options.floatTolerance))
      if (idx === -1) {
        return { passed: false, detail: `Baris "${exp}" tidak ditemukan di output program.` }
      }
      remaining.splice(idx, 1)
    }
    return { passed: true, detail: null }
  }

  for (let i = 0; i < expected.length; i++) {
    if (!lineMatches(expected[i], actual[i], options.floatTolerance)) {
      return {
        passed: false,
        detail: `Baris ${i + 1} beda — diharapkan: "${expected[i]}", program mencetak: "${actual[i]}".`,
      }
    }
  }
  return { passed: true, detail: null }
}
