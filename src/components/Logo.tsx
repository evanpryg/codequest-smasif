import { Swords } from 'lucide-react'
import { Link } from 'react-router-dom'

/** Logo CodeQuest — lencana gradien + wordmark (pengganti emoji, arah premium). */
export default function Logo({
  to,
  textClass = 'text-2xl',
}: {
  to?: string
  textClass?: string
}) {
  const inner = (
    <>
      <span className="rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white p-1.5 shadow-md flex items-center justify-center">
        <Swords className="w-5 h-5" strokeWidth={2.5} />
      </span>
      <span className={`${textClass} text-game`}>CodeQuest</span>
    </>
  )
  return to ? (
    <Link to={to} className="flex items-center gap-2">
      {inner}
    </Link>
  ) : (
    <span className="flex items-center gap-2">{inner}</span>
  )
}
