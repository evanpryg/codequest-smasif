import { useTheme } from '../theme/ThemeContext'

/** Tombol ganti tema — dipasang di header semua layar. */
export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'}
      className={
        'rounded-full border border-line w-9 h-9 flex items-center justify-center ' +
        'hover:bg-surface2 transition ' +
        className
      }
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}
