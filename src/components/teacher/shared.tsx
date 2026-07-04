import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import ThemeToggle from '../ThemeToggle'

/** Gaya bersama halaman guru. */
export const inputClass =
  'w-full rounded-lg border border-line px-3 py-2 text-ink ' +
  'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-surface2'

export const primaryButton =
  'rounded-lg bg-indigo-600 text-white font-semibold px-4 py-2 hover:bg-indigo-700 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed'

export const subtleButton =
  'rounded-lg border border-line px-3 py-1.5 text-sm text-dim hover:bg-surface2'

export const dangerButton =
  'rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50'

export interface Crumb {
  label: string
  to?: string
}

/** Kerangka halaman guru: header + breadcrumb. */
export function TeacherShell({ crumbs, children }: { crumbs: Crumb[]; children: ReactNode }) {
  const { state, logout } = useAuth()
  const email = state.status === 'teacher' ? state.session.user.email : ''

  return (
    <main className="min-h-screen bg-canvas">
      <header className="bg-surface border-b border-line">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/guru" className="text-2xl text-game">
              ⚔️ CodeQuest
            </Link>
            <span className="text-xs font-bold uppercase tracking-wide bg-indigo-100 text-indigo-700 rounded-full px-2.5 py-1">
              Guru
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-dim hidden sm:inline">{email}</span>
            <ThemeToggle />
            <button onClick={logout} className={subtleButton}>
              Keluar
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <nav className="text-sm text-dim flex items-center gap-1 flex-wrap">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span className="text-faint">/</span>}
              {c.to ? (
                <Link to={c.to} className="hover:text-indigo-600 hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span className="font-semibold text-ink">{c.label}</span>
              )}
            </span>
          ))}
        </nav>
        {children}
      </div>
    </main>
  )
}

export function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="bg-surface rounded-2xl shadow-sm p-6">
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      {subtitle && <p className="text-sm text-dim mt-0.5 mb-4">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </section>
  )
}

export interface CrudItem {
  id: string
  label: string
  href?: string
  badge?: string
}

interface CrudListProps {
  items: CrudItem[] | null // null = memuat
  emptyText: string
  createPlaceholder: string
  /** Saran satu-klik, mis. ["Ganjil", "Genap"] untuk semester. */
  quickAdds?: string[]
  onCreate: (label: string) => Promise<void>
  onRename: (id: string, label: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  deleteConfirmText: (label: string) => string
}

/**
 * Daftar CRUD generik — dipakai Tahun Ajaran, Semester, Kelas, dan Chapter
 * (semuanya daftar berlabel dengan pola aksi yang sama).
 */
export function CrudList({
  items,
  emptyText,
  createPlaceholder,
  quickAdds,
  onCreate,
  onRename,
  onDelete,
  deleteConfirmText,
}: CrudListProps) {
  const [newLabel, setNewLabel] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(fn: () => Promise<void>) {
    setError(null)
    setBusy(true)
    try {
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setBusy(false)
    }
  }

  async function submitCreate(e: FormEvent) {
    e.preventDefault()
    const label = newLabel.trim()
    if (!label) return
    await run(async () => {
      await onCreate(label)
      setNewLabel('')
    })
  }

  const existingLabels = new Set((items ?? []).map((i) => i.label.toLowerCase()))

  return (
    <div className="space-y-3">
      {items === null && <p className="text-sm text-faint">Memuat…</p>}
      {items !== null && items.length === 0 && (
        <p className="text-sm text-faint">{emptyText}</p>
      )}

      <ul className="space-y-2">
        {items?.map((item) => (
          <li
            key={item.id}
            className="rounded-lg border border-line px-4 py-3 flex items-center gap-3"
          >
            {editingId === item.id ? (
              <form
                className="flex-1 flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  const label = editLabel.trim()
                  if (!label) return
                  run(async () => {
                    await onRename(item.id, label)
                    setEditingId(null)
                  })
                }}
              >
                <input
                  className={inputClass}
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  autoFocus
                />
                <button type="submit" className={primaryButton} disabled={busy}>
                  Simpan
                </button>
                <button type="button" className={subtleButton} onClick={() => setEditingId(null)}>
                  Batal
                </button>
              </form>
            ) : (
              <>
                {item.href ? (
                  <Link
                    to={item.href}
                    className="flex-1 font-medium text-ink hover:text-indigo-700"
                  >
                    {item.label}
                    {item.badge && (
                      <span className="ml-2 text-xs font-semibold bg-surface2 text-dim rounded-full px-2 py-0.5">
                        {item.badge}
                      </span>
                    )}
                    <span className="text-faint ml-2">›</span>
                  </Link>
                ) : (
                  <span className="flex-1 font-medium text-ink">{item.label}</span>
                )}
                <button
                  className={subtleButton}
                  onClick={() => {
                    setEditingId(item.id)
                    setEditLabel(item.label)
                  }}
                >
                  Ubah
                </button>
                <button
                  className={dangerButton}
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(deleteConfirmText(item.label))) {
                      run(() => onDelete(item.id))
                    }
                  }}
                >
                  Hapus
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={submitCreate} className="flex items-center gap-2 pt-1">
        <input
          className={inputClass}
          placeholder={createPlaceholder}
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
        />
        <button type="submit" className={primaryButton} disabled={busy || !newLabel.trim()}>
          Tambah
        </button>
      </form>

      {quickAdds && quickAdds.some((q) => !existingLabels.has(q.toLowerCase())) && (
        <div className="flex items-center gap-2 text-sm text-dim">
          <span>Cepat:</span>
          {quickAdds
            .filter((q) => !existingLabels.has(q.toLowerCase()))
            .map((q) => (
              <button
                key={q}
                className="rounded-full border border-indigo-200 text-indigo-600 px-3 py-1 hover:bg-indigo-50"
                disabled={busy}
                onClick={() => run(() => onCreate(q))}
              >
                + {q}
              </button>
            ))}
        </div>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
    </div>
  )
}
