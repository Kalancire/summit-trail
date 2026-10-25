import { motion } from 'motion/react'
import { CalendarDays, LayoutDashboard, Play, Route, User, type LucideIcon } from 'lucide-react'
import type { Screen } from '../lib/core'

export default function Nav({ tab, go }: { tab: Screen; go: (s: Screen) => void }) {
  const item = (k: Screen, Icon: LucideIcon) => (
    <button key={k} onClick={() => go(k)} className="grid size-12 place-items-center">
      <Icon className={`size-7 ${tab === k ? 'glow text-accent' : 'text-mute'}`} strokeWidth={tab === k ? 2.2 : 1.8} />
    </button>
  )
  return (
    <motion.nav initial={{ y: 90 }} animate={{ y: 0 }} transition={{ type: 'spring', damping: 22 }}
      className="card fixed inset-x-4 bottom-[max(env(safe-area-inset-bottom),1rem)] z-20 mx-auto flex max-w-md items-center justify-around rounded-[2rem] px-4 py-2.5">
      {item('home', LayoutDashboard)}
      {item('history', CalendarDays)}
      <motion.button whileTap={{ scale: 0.9 }} onClick={() => go('live')} className="inset grid size-14 place-items-center rounded-full">
        <Play className="glow size-7 fill-accent text-accent" />
      </motion.button>
      {item('trails', Route)}
      {item('profile', User)}
    </motion.nav>
  )
}
