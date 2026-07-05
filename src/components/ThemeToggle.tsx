import { Moon, Sun } from 'lucide-react'
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
        'text-dim hover:bg-surface2 hover:text-ink transition ' +
        className
      }
    >
      {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  )
}
