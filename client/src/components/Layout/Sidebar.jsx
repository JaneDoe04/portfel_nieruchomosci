import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Building2, LogOut, Settings } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Panel główny' },
  { to: '/apartments', icon: Building2, label: 'Mieszkania' },
  { to: '/api-settings', icon: Settings, label: 'Ustawienia API' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="w-64 h-screen bg-navy-900 text-white flex flex-col shrink-0">
      <div className="p-6 border-b border-navy-700">
        <h1 className="text-lg font-semibold text-white">Portfel Nieruchomości</h1>
        <p className="text-xs text-navy-300 mt-0.5">Zarządzanie wynajmem</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-navy-200 hover:bg-navy-800 hover:text-white'
              }`
            }
          >
            <Icon className="w-5 h-5 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-navy-700">
        <div className="px-4 py-2 text-xs text-navy-400 truncate" title={user?.email}>
          {user?.email}
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium text-navy-200 hover:bg-navy-800 hover:text-white transition-colors"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          Wyloguj się
        </button>
      </div>
    </aside>
  );
}
