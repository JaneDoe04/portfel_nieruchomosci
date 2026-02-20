import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Building2, LogOut, Settings, Menu, X, User } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Panel główny' },
  { to: '/apartments', icon: Building2, label: 'Mieszkania' },
  { to: '/api-settings', icon: Settings, label: 'Ustawienia API' },
  { to: '/profile', icon: User, label: 'Moje konto' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile menu button - ukryty gdy menu jest otwarte */}
      {!mobileMenuOpen && (
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-navy-900 text-white shadow-lg"
        >
          <Menu className="w-6 h-6" />
        </button>
      )}

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40
        w-64 h-screen bg-navy-900 text-white flex flex-col shrink-0
        transform transition-transform duration-300 ease-in-out
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 border-b border-navy-700 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">Portfel Nieruchomości</h1>
            <p className="text-xs text-navy-300 mt-0.5">Zarządzanie wynajmem</p>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1 rounded-lg text-navy-300 hover:text-white hover:bg-navy-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMobileMenuOpen(false)}
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
          {user?.name && (
            <div className="px-4 py-1 text-sm font-medium text-white truncate" title={user.name}>
              Witaj, {user.name.split(/\s+/)[0]}
            </div>
          )}
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
    </>
  );
}
