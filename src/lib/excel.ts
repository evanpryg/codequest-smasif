import * as XLSX from 'xlsx'

/**
 * Impor daftar siswa dari Excel (TechDecisions §2.4) — parsing di browser
 * memakai SheetJS. Format yang diterima: .xlsx / .xls / .csv dengan daftar
 * nama di KOLOM PERTAMA sheet pertama. Baris header ("nama"/"name") otomatis
 * dilewati.
 */
export async function parseStudentNames(file: File): Promise<string[]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) return []
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })
  return cleanNameList(
    rows.map((row) => (Array.isArray(row) ? String(row[0] ?? '') : '')),
  )
}

/** Bersihkan daftar nama (dari file atau tempelan teks): trim, buang kosong/duplikat/header. */
export function cleanNameList(raw: string[]): string[] {
  const seen = new Set<string>()
  const names: string[] = []
  for (const value of raw) {
    const name = value.trim().replace(/\s+/g, ' ')
    if (!name) continue
    if (/^(nama|name|nama siswa|nama_siswa)$/i.test(name)) continue // header
    const key = name.toLowerCase()
    if (seen.has(key)) continue // duplikat dalam file
    seen.add(key)
    names.push(name)
  }
  return names
}
