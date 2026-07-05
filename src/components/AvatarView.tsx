import { useId } from 'react'

/**
 * Karakter siswa — SVG chibi berlapis (PRD §7.4: avatar & kosmetik).
 *
 * Lapisan (bawah → atas): latar → badan+baju → kepala/wajah → rambut → topi
 * → bingkai. Setiap bagian dirujuk lewat KODE item (shop_item.code); null =
 * tampilan default bawaan. Digambar sendiri agar tanpa aset/CDN eksternal
 * (ramah internet sekolah) dan item baru cukup menambah renderer + seed.
 */

export interface AvatarConfig {
  background?: string | null
  hair?: string | null
  outfit?: string | null
  hat?: string | null
  frame?: string | null
}

const SKIN = '#fcd7b0'
const SKIN_SHADE = '#f0b98a'

export default function AvatarView({
  config,
  size = 160,
  className = '',
}: {
  config: AvatarConfig
  size?: number
  className?: string
}) {
  // id unik per instance — gradien tidak bentrok saat banyak avatar di 1 layar.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const g = (name: string) => `${uid}-${name}`

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Karakter avatar"
    >
      <defs>
        <linearGradient id={g('bgDefault')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c7d2fe" />
          <stop offset="100%" stopColor="#e0e7ff" />
        </linearGradient>
        <linearGradient id={g('bgSunset')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#f472b6" />
        </linearGradient>
        <linearGradient id={g('bgForest')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#86efac" />
          <stop offset="100%" stopColor="#22c55e" />
        </linearGradient>
        <linearGradient id={g('bgOcean')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
        <linearGradient id={g('bgSpace')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e1b4b" />
          <stop offset="100%" stopColor="#312e81" />
        </linearGradient>
        <linearGradient id={g('rainbow')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="25%" stopColor="#f59e0b" />
          <stop offset="50%" stopColor="#22c55e" />
          <stop offset="75%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
        <clipPath id={g('clip')}>
          <rect x="0" y="0" width="200" height="200" rx="24" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${g('clip')})`}>
        <Background code={config.background} g={g} />
        <Outfit code={config.outfit} />
        <Head />
        <Hair code={config.hair} />
        <Hat code={config.hat} />
      </g>
      <Frame code={config.frame} g={g} />
    </svg>
  )
}

// =============================================================================
// Latar
// =============================================================================
function Background({ code, g }: { code?: string | null; g: (n: string) => string }) {
  switch (code) {
    case 'bg_sunset':
      return (
        <>
          <rect width="200" height="200" fill={`url(#${g('bgSunset')})`} />
          <circle cx="100" cy="150" r="45" fill="#fde047" opacity="0.9" />
          <rect y="150" width="200" height="50" fill="#c2410c" opacity="0.35" />
        </>
      )
    case 'bg_forest':
      return (
        <>
          <rect width="200" height="200" fill={`url(#${g('bgForest')})`} />
          <path d="M20 200 L45 130 L70 200 Z" fill="#166534" opacity="0.8" />
          <path d="M140 200 L170 115 L200 200 Z" fill="#14532d" opacity="0.8" />
          <circle cx="165" cy="35" r="16" fill="#fef9c3" opacity="0.9" />
        </>
      )
    case 'bg_ocean':
      return (
        <>
          <rect width="200" height="200" fill={`url(#${g('bgOcean')})`} />
          <path
            d="M0 165 Q25 155 50 165 T100 165 T150 165 T200 165 V200 H0 Z"
            fill="#0369a1"
            opacity="0.7"
          />
          <path
            d="M0 180 Q25 172 50 180 T100 180 T150 180 T200 180 V200 H0 Z"
            fill="#075985"
            opacity="0.8"
          />
        </>
      )
    case 'bg_space':
      return (
        <>
          <rect width="200" height="200" fill={`url(#${g('bgSpace')})`} />
          {[
            [20, 30], [60, 15], [150, 25], [180, 60], [30, 90],
            [175, 120], [15, 150], [190, 175], [55, 175],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 2.5 : 1.5} fill="#fef9c3" />
          ))}
          <circle cx="160" cy="160" r="18" fill="#f472b6" opacity="0.9" />
          <ellipse cx="160" cy="160" rx="28" ry="7" fill="none" stroke="#fbcfe8" strokeWidth="3" />
        </>
      )
    case 'bg_candy':
      return (
        <>
          <rect width="200" height="200" fill="#fbcfe8" />
          {[
            [25, 25], [80, 45], [160, 30], [40, 110], [185, 100],
            [20, 170], [120, 20], [170, 170],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="7" fill={i % 2 ? '#f9a8d4' : '#fdf2f8'} />
          ))}
        </>
      )
    default:
      return <rect width="200" height="200" fill={`url(#${g('bgDefault')})`} />
  }
}

// =============================================================================
// Kepala & wajah (selalu sama — identitas dasar karakter)
// =============================================================================
function Head() {
  return (
    <>
      {/* leher */}
      <rect x="90" y="112" width="20" height="14" fill={SKIN_SHADE} />
      {/* kepala */}
      <circle cx="100" cy="85" r="40" fill={SKIN} />
      {/* mata */}
      <circle cx="85" cy="85" r="5.5" fill="#1f2937" />
      <circle cx="115" cy="85" r="5.5" fill="#1f2937" />
      <circle cx="87" cy="83" r="1.8" fill="#ffffff" />
      <circle cx="117" cy="83" r="1.8" fill="#ffffff" />
      {/* pipi */}
      <circle cx="76" cy="97" r="6" fill="#fda4af" opacity="0.6" />
      <circle cx="124" cy="97" r="6" fill="#fda4af" opacity="0.6" />
      {/* senyum */}
      <path d="M90 100 Q100 110 110 100" fill="none" stroke="#92400e" strokeWidth="3" strokeLinecap="round" />
    </>
  )
}

// =============================================================================
// Baju (badan)
// =============================================================================
function Outfit({ code }: { code?: string | null }) {
  const body = (fill: string, extra?: JSX.Element) => (
    <>
      <path d="M55 200 V155 Q55 124 100 124 Q145 124 145 155 V200 Z" fill={fill} />
      {/* lengan */}
      <circle cx="57" cy="160" r="12" fill={fill} />
      <circle cx="143" cy="160" r="12" fill={fill} />
      {extra}
    </>
  )
  switch (code) {
    case 'outfit_hoodie_red':
      return body(
        '#dc2626',
        <>
          <path d="M74 132 Q100 150 126 132 Q113 124 100 124 Q87 124 74 132 Z" fill="#b91c1c" />
          <line x1="93" y1="140" x2="93" y2="158" stroke="#fecaca" strokeWidth="3" strokeLinecap="round" />
          <line x1="107" y1="140" x2="107" y2="158" stroke="#fecaca" strokeWidth="3" strokeLinecap="round" />
        </>,
      )
    case 'outfit_jacket_blue':
      return body(
        '#2563eb',
        <>
          <line x1="100" y1="128" x2="100" y2="200" stroke="#bfdbfe" strokeWidth="3" />
          <rect x="66" y="150" width="12" height="8" rx="2" fill="#1e40af" />
          <rect x="122" y="150" width="12" height="8" rx="2" fill="#1e40af" />
        </>,
      )
    case 'outfit_tee_star':
      return body(
        '#0d9488',
        <path
          d="M100 145 l4.7 9.5 10.5 1.5 -7.6 7.4 1.8 10.4 -9.4 -4.9 -9.4 4.9 1.8 -10.4 -7.6 -7.4 10.5 -1.5 Z"
          fill="#fde047"
        />,
      )
    case 'outfit_robe_purple':
      return body(
        '#7c3aed',
        <>
          <path d="M55 200 L45 200 Q52 165 62 150 Z" fill="#6d28d9" />
          <path d="M145 200 L155 200 Q148 165 138 150 Z" fill="#6d28d9" />
          <circle cx="82" cy="165" r="3" fill="#fde047" />
          <circle cx="118" cy="178" r="3" fill="#fde047" />
          <circle cx="100" cy="190" r="3" fill="#fde047" />
        </>,
      )
    default:
      // Kaos abu default
      return body('#94a3b8', <path d="M88 124 L100 136 L112 124" fill="none" stroke="#64748b" strokeWidth="3" />)
  }
}

// =============================================================================
// Rambut
// =============================================================================
function Hair({ code }: { code?: string | null }) {
  switch (code) {
    case 'hair_spiky':
      return (
        <path
          d="M60 82 Q58 52 76 46 L80 32 L88 45 L96 28 L103 45 L112 30 L117 46 Q142 52 140 82 Q135 58 100 56 Q65 58 60 82 Z"
          fill="#1f2937"
        />
      )
    case 'hair_bob':
      return (
        <path
          d="M58 100 Q54 44 100 44 Q146 44 142 100 L134 100 Q140 62 100 58 Q60 62 66 100 Z"
          fill="#92400e"
        />
      )
    case 'hair_long':
      return (
        <>
          <path d="M58 130 Q50 46 100 44 Q150 46 142 130 L128 130 Q136 66 100 60 Q64 66 72 130 Z" fill="#713f12" />
        </>
      )
    case 'hair_curly':
      return (
        <g fill="#3f2305">
          {[
            [70, 60], [85, 50], [100, 47], [115, 50], [130, 60],
            [63, 74], [137, 74],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="13" />
          ))}
        </g>
      )
    case 'hair_mohawk':
      return (
        <path
          d="M92 52 L96 30 L100 48 L104 26 L108 48 L112 32 L114 54 Q104 48 92 52 Z M88 56 Q100 48 112 56 L110 62 Q100 56 90 62 Z"
          fill="#dc2626"
        />
      )
    default:
      // Poni pendek default
      return (
        <path
          d="M62 78 Q62 48 100 46 Q138 48 138 78 Q128 60 100 60 Q72 60 62 78 Z"
          fill="#7c4a21"
        />
      )
  }
}

// =============================================================================
// Topi
// =============================================================================
function Hat({ code }: { code?: string | null }) {
  switch (code) {
    case 'hat_cap':
      return (
        <>
          <path d="M62 60 Q64 34 100 34 Q136 34 138 60 Q100 48 62 60 Z" fill="#ef4444" />
          <path d="M130 52 Q160 52 162 62 Q140 66 128 60 Z" fill="#b91c1c" />
          <circle cx="100" cy="36" r="4" fill="#b91c1c" />
        </>
      )
    case 'hat_headphones':
      return (
        <>
          <path d="M62 78 Q60 38 100 38 Q140 38 138 78" fill="none" stroke="#334155" strokeWidth="8" strokeLinecap="round" />
          <rect x="52" y="72" width="16" height="26" rx="7" fill="#475569" />
          <rect x="132" y="72" width="16" height="26" rx="7" fill="#475569" />
        </>
      )
    case 'hat_wizard':
      return (
        <>
          <path d="M100 -4 L128 58 L72 58 Z" fill="#7c3aed" />
          <ellipse cx="100" cy="58" rx="42" ry="9" fill="#6d28d9" />
          <circle cx="100" cy="22" r="3.5" fill="#fde047" />
          <circle cx="91" cy="42" r="2.5" fill="#fde047" />
          <circle cx="110" cy="36" r="2.5" fill="#fde047" />
        </>
      )
    case 'hat_halo':
      return (
        <ellipse cx="100" cy="30" rx="26" ry="8" fill="none" stroke="#fbbf24" strokeWidth="6" />
      )
    case 'hat_crown':
      return (
        <>
          <path d="M72 56 L72 34 L86 46 L100 26 L114 46 L128 34 L128 56 Z" fill="#f59e0b" />
          <rect x="72" y="52" width="56" height="8" rx="3" fill="#d97706" />
          <circle cx="100" cy="42" r="4" fill="#ef4444" />
          <circle cx="80" cy="48" r="3" fill="#3b82f6" />
          <circle cx="120" cy="48" r="3" fill="#22c55e" />
        </>
      )
    default:
      return null
  }
}

// =============================================================================
// Bingkai
// =============================================================================
function Frame({ code, g }: { code?: string | null; g: (n: string) => string }) {
  const ring = (stroke: string, width = 8) => (
    <rect
      x={width / 2}
      y={width / 2}
      width={200 - width}
      height={200 - width}
      rx={24 - width / 4}
      fill="none"
      stroke={stroke}
      strokeWidth={width}
    />
  )
  switch (code) {
    case 'frame_bronze':
      return ring('#b45309')
    case 'frame_silver':
      return ring('#94a3b8')
    case 'frame_gold':
      return ring('#f59e0b')
    case 'frame_rainbow':
      return ring(`url(#${g('rainbow')})`, 10)
    default:
      return null
  }
}
