import { NavLink } from 'react-router-dom';
import { appPaths } from '../../navigation/appPaths';

const items = [
  { to: appPaths.admin, label: 'Обзор', end: true },
  { to: appPaths.adminUsers, label: 'Пользователи', end: false },
];

export function AdminNav() {
  return (
    <nav className="flex flex-wrap gap-2">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `rounded-xl border px-4 py-2 text-sm transition-colors ${
              isActive
                ? 'border-gold/35 bg-gold/15 text-gold-light'
                : 'border-gold/10 bg-surface/40 text-muted hover:border-gold/25 hover:text-white'
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
