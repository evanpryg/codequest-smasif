import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import AvatarView, { type AvatarConfig } from '../../components/AvatarView'
import ThemeToggle from '../../components/ThemeToggle'

interface ShopItem {
  id: string
  code: string
  name: string
  category: 'background' | 'hair' | 'outfit' | 'hat' | 'frame'
  price: number
  sort_index: number
}

const CATEGORIES: { key: ShopItem['category']; label: string }[] = [
  { key: 'background', label: '🖼️ Latar' },
  { key: 'hair', label: '💇 Rambut' },
  { key: 'outfit', label: '👕 Baju' },
  { key: 'hat', label: '🎩 Topi' },
  { key: 'frame', label: '✨ Bingkai' },
]

/**
 * Toko & kostumisasi karakter (PRD §7.4 — Fase 2).
 * Gold dari quest dibelanjakan jadi kosmetik; pembelian lewat RPC
 * buy_shop_item (atomik di server). Pratinjau karakter langsung berubah
 * saat item dipakai. Murni motivasi — tidak menyentuh nilai akademik.
 */
export default function ShopPage() {
  const { state, dataClient } = useAuth()
  const studentId = state.status === 'student' ? state.session.student.id : ''
  const studentName = state.status === 'student' ? state.session.student.name : ''

  const [gold, setGold] = useState<number | null>(null)
  const [items, setItems] = useState<ShopItem[]>([])
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set())
  const [avatar, setAvatar] = useState<AvatarConfig>({})
  const [category, setCategory] = useState<ShopItem['category']>('background')
  const [busyItemId, setBusyItemId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  const reload = useCallback(async () => {
    const [{ data: me }, { data: catalog }, { data: owned }, { data: av }] = await Promise.all([
      dataClient.from('student').select('gold').eq('id', studentId).single(),
      dataClient.from('shop_item').select('*').order('category').order('sort_index'),
      dataClient.from('student_item').select('item_id'),
      dataClient.from('student_avatar').select('*').maybeSingle(),
    ])
    if (me) setGold(me.gold)
    if (catalog) setItems(catalog as ShopItem[])
    setOwnedIds(new Set((owned ?? []).map((o) => o.item_id as string)))
    if (av) setAvatar(av as AvatarConfig)
  }, [dataClient, studentId])

  useEffect(() => {
    reload()
  }, [reload])

  async function buy(item: ShopItem) {
    setBusyItemId(item.id)
    setMessage(null)
    try {
      const { data, error } = await dataClient.rpc('buy_shop_item', { p_item_id: item.id })
      if (error) {
        // Pesan dari RAISE EXCEPTION di fungsi (mis. "Gold belum cukup…").
        setMessage({ text: error.message.replace(/^.*?: /, ''), ok: false })
        return
      }
      setOwnedIds((prev) => new Set(prev).add(item.id))
      if (data && typeof data.gold === 'number') setGold(data.gold)
      setMessage({ text: `Berhasil membeli ${item.name}! 🎉`, ok: true })
      await equip(item.category, item.code) // langsung dipakai setelah beli
    } finally {
      setBusyItemId(null)
    }
  }

  async function equip(cat: ShopItem['category'], code: string | null) {
    const next = { ...avatar, [cat]: code }
    setAvatar(next) // optimis — pratinjau langsung berubah
    await dataClient
      .from('student_avatar')
      .upsert(
        { student_id: studentId, [cat]: code, updated_at: new Date().toISOString() },
        { onConflict: 'student_id' },
      )
  }

  const shown = useMemo(() => items.filter((i) => i.category === category), [items, category])

  return (
    <main className="min-h-screen bg-canvas">
      <header className="bg-surface border-b border-line">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/siswa" className="text-2xl text-game">
              ⚔️ CodeQuest
            </Link>
            <span className="text-xs font-bold uppercase tracking-wide bg-fuchsia-100 text-fuchsia-700 rounded-full px-2.5 py-1">
              Toko
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/siswa" className="text-sm text-dim hover:text-indigo-600">
              ← Kembali
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 grid lg:grid-cols-3 gap-6 items-start">
        {/* Pratinjau karakter */}
        <section className="bg-surface rounded-2xl shadow-sm border border-line/60 p-6 text-center lg:sticky lg:top-6">
          <AvatarView config={avatar} size={220} className="mx-auto drop-shadow-lg" />
          <p className="mt-3 text-lg font-extrabold text-ink">{studentName}</p>
          <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-700 font-extrabold px-4 py-1.5">
            🪙 {gold ?? '…'} Gold
          </p>
          <p className="text-xs text-faint mt-3">
            Selesaikan quest untuk mendapat Gold, lalu dandani karaktermu!
          </p>
        </section>

        {/* Katalog */}
        <section className="lg:col-span-2 space-y-4">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => setCategory(c.key)}
                className={
                  c.key === category
                    ? 'rounded-full bg-indigo-600 text-white text-sm font-bold px-4 py-2'
                    : 'rounded-full border border-line text-dim text-sm font-semibold px-4 py-2 hover:bg-surface2'
                }
              >
                {c.label}
              </button>
            ))}
          </div>

          {message && (
            <p
              className={
                'text-sm font-semibold rounded-xl px-4 py-2.5 ' +
                (message.ok
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-red-100 text-red-600')
              }
            >
              {message.text}
            </p>
          )}

          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* Kartu "Bawaan" — kembali ke tampilan default (gratis) */}
            <ItemCard
              name="Bawaan"
              price={0}
              owned
              equipped={!avatar[category]}
              busy={false}
              preview={{ ...avatar, [category]: null }}
              onEquip={() => equip(category, null)}
            />
            {shown.map((item) => {
              const owned = ownedIds.has(item.id)
              return (
                <ItemCard
                  key={item.id}
                  name={item.name}
                  price={item.price}
                  owned={owned}
                  equipped={avatar[item.category] === item.code}
                  busy={busyItemId === item.id}
                  affordable={(gold ?? 0) >= item.price}
                  preview={{ ...avatar, [item.category]: item.code }}
                  onBuy={() => buy(item)}
                  onEquip={() => equip(item.category, item.code)}
                />
              )
            })}
          </div>
        </section>
      </div>
    </main>
  )
}

function ItemCard({
  name,
  price,
  owned,
  equipped,
  busy,
  affordable = true,
  preview,
  onBuy,
  onEquip,
}: {
  name: string
  price: number
  owned: boolean
  equipped: boolean
  busy: boolean
  affordable?: boolean
  preview: AvatarConfig
  onBuy?: () => void
  onEquip: () => void
}) {
  return (
    <div
      className={
        'rounded-2xl bg-surface border p-4 text-center transition hover:-translate-y-0.5 hover:shadow-md ' +
        (equipped ? 'border-indigo-400 ring-2 ring-indigo-300/50' : 'border-line')
      }
    >
      <AvatarView config={preview} size={110} className="mx-auto" />
      <p className="mt-2 font-bold text-ink text-sm">{name}</p>
      {!owned && (
        <p className="text-xs font-extrabold text-amber-600 mt-0.5">🪙 {price}</p>
      )}
      <div className="mt-2">
        {equipped ? (
          <span className="inline-block text-xs font-bold text-indigo-600 bg-indigo-50 rounded-full px-3 py-1.5">
            Dipakai ✓
          </span>
        ) : owned ? (
          <button
            onClick={onEquip}
            className="w-full rounded-lg border border-indigo-300 text-indigo-600 text-sm font-bold py-1.5 hover:bg-indigo-50"
          >
            Pakai
          </button>
        ) : (
          <button
            onClick={onBuy}
            disabled={busy || !affordable}
            title={affordable ? undefined : 'Gold belum cukup'}
            className="w-full rounded-lg bg-indigo-600 text-white text-sm font-bold py-1.5 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? 'Membeli…' : 'Beli'}
          </button>
        )}
      </div>
    </div>
  )
}
