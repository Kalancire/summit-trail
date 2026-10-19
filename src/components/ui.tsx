import type { InputHTMLAttributes, ReactNode } from 'react'
import { motion } from 'motion/react'
import { Check, ChevronLeft, Menu, Moon } from 'lucide-react'

export const Field = ({ label, ...r }: InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
  <label className="block">
    <span className="mb-1.5 block text-xs text-mute">{label}</span>
    <input {...r} className="inset h-12 w-full rounded-2xl px-4 text-ink outline-none focus:ring-2 focus:ring-accent/60" />
  </label>
)

export const Btn = ({ children, onClick, disabled, outline, className = '' }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; outline?: boolean; className?: string
}) => (
  <motion.button whileTap={{ scale: 0.97 }} onClick={onClick} disabled={disabled}
    className={`flex h-13 items-center justify-center gap-2 rounded-2xl px-5 font-bold disabled:opacity-50 ${
      outline ? 'border-2 border-accent text-accent' : 'grad text-white shadow-[0_8px_22px_-8px_var(--accent)]'} ${className}`}>
    {children}
  </motion.button>
)

export const Stat = ({ icon, label, value }: { icon: ReactNode; label: string; value: string }) => (
  <div className="card flex flex-col items-center gap-1 rounded-3xl py-4">
    <span className="grid size-9 place-items-center rounded-full bg-accent/15 text-accent">{icon}</span>
    <b className="text-lg">{value}</b>
    <span className="text-xs text-mute">{label}</span>
  </div>
)

export const Mini = ({ label, value }: { label: string; value: string }) => (
  <div><p className="text-xs text-mute">{label}</p><p className="font-bold">{value}</p></div>
)

export const Back = ({ onClick }: { onClick: () => void }) => (
  <motion.button whileTap={{ scale: 0.9 }} onClick={onClick} className="card grid size-11 place-items-center rounded-full">
    <ChevronLeft className="size-6" />
  </motion.button>
)

export const Header = ({ name, time, photo, onMenu }: { name: string; time: string; photo?: string; onMenu: () => void }) => (
  <div className="flex items-center gap-3">
    {photo ? <img src={photo} alt="" className="size-12 rounded-full object-cover ring-2 ring-accent/60" />
      : <span className="inset grid size-12 place-items-center rounded-full text-lg font-bold text-accent ring-2 ring-accent/60">{name.trim()[0]?.toUpperCase() ?? '?'}</span>}
    <span className="flex flex-1 items-center gap-2 pl-1">
      <Moon className="glow size-6 fill-accent text-accent" />
      <span className="leading-tight"><b className="block text-sm">{time}</b><small className="text-[11px] text-mute">this week</small></span>
    </span>
    <button onClick={onMenu} className="card grid size-12 place-items-center rounded-full"><Menu className="size-5 text-accent" /></button>
  </div>
)

export const Tabs = ({ items, on, set }: { items: string[]; on: number; set: (i: number) => void }) => (
  <div className="inset flex overflow-hidden rounded-lg">
    {items.map((t, i) => (
      <button key={t} onClick={() => set(i)} className={`h-10 flex-1 text-sm font-medium ${on === i ? 'grad text-white' : 'text-ink'}`}>{t}</button>
    ))}
  </div>
)

export const Tile = ({ icon, label, value }: { icon: ReactNode; label: string; value: string }) => (
  <div className="card flex flex-col items-center justify-center gap-2 rounded-2xl px-3 py-5">
    <span className="glow text-accent [&>svg]:size-11 [&>svg]:stroke-[1.4]">{icon}</span>
    <b className="text-lg">{value}</b>
    <span className="text-xs text-mute">{label}</span>
  </div>
)

export const CheckRow = ({ icon, label, sub, done = true, onClick }: {
  icon: ReactNode; label: string; sub?: string; done?: boolean; onClick?: () => void
}) => (
  <motion.button whileTap={{ scale: 0.98 }} onClick={onClick} className="card mb-3 flex w-full items-center gap-4 rounded-2xl p-3 text-left">
    <span className="grad grid size-12 shrink-0 place-items-center rounded-full text-white shadow-[0_6px_16px_-6px_var(--accent)]">{icon}</span>
    <span className="flex-1"><b className="block text-sm">{label}</b>{sub && <span className="text-xs text-mute">{sub}</span>}</span>
    <span className={`grid size-9 place-items-center rounded-lg ${done ? 'bg-[#4a4a4a] shadow-[3px_3px_7px_#1b1b1b]' : 'inset'}`}>
      {done && <Check className="size-5 text-accent" strokeWidth={3} />}
    </span>
  </motion.button>
)
