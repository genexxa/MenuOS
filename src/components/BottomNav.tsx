import { NavLink } from 'react-router-dom'

const LINKS = [
  { to: '/', label: 'Accueil', end: true },
  { to: '/recettes', label: 'Recettes', end: false },
  { to: '/planificateur', label: 'Planificateur', end: false },
  { to: '/epicerie', label: 'Épicerie', end: false },
]

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 flex border-t border-neutral-200 bg-white">
      {LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          className={({ isActive }) =>
            `flex-1 py-3 text-center text-xs ${isActive ? 'font-medium text-neutral-900' : 'text-neutral-400'}`
          }
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  )
}
