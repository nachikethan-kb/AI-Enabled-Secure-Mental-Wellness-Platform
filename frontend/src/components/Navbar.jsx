import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, LayoutDashboard, MessageCircle, ClipboardList, Users, LogOut, Menu, X, Heart, FileText } from 'lucide-react';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem('token');
  const userName = localStorage.getItem('full_name') || 'User';

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('full_name');
    localStorage.removeItem('email');
    setIsOpen(false);
    setIsDropdownOpen(false);
    navigate('/login');
  };

  const navLinks = [
    { label: 'Home', path: '/', icon: Home },
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Assessment', path: '/assessment', icon: ClipboardList },
    { label: 'Health Report', path: '/health-report', icon: FileText },
    { label: 'Chat', path: '/chat', icon: MessageCircle },
    { label: 'Forum', path: '/forum', icon: Users },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-[#08080C]/80 border-b border-white/5 backdrop-blur-xl transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between items-center h-20">
          
          {/* Logo / Brand */}
          <div
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="relative p-2 bg-gradient-to-br from-[#00F5D4]/10 to-[#CCFF00]/10 rounded-xl border border-[#00F5D4]/20 group-hover:border-[#CCFF00]/40 transition-all duration-300">
              <Heart className="h-6 w-6 text-[#00F5D4] group-hover:scale-110 transition-transform duration-300" />
              <div className="absolute inset-0 bg-[#00F5D4]/20 blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            <span className="text-2xl font-extrabold tracking-widest text-white font-display bg-gradient-to-r from-white via-white to-slate-400 bg-clip-text text-transparent group-hover:to-[#CCFF00] transition-all duration-300">
              HEALTHLY
            </span>
          </div>

          {/* Desktop Navigation Links */}
          {token && (
            <div className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.path;
                return (
                  <button
                    key={link.path}
                    onClick={() => navigate(link.path)}
                    className={`nav-link-interactive inline-flex items-center gap-2 font-medium px-1 py-2 text-sm transition-all duration-200 ${
                      isActive 
                        ? 'text-[#00F5D4] font-semibold font-display after:w-full' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <link.icon className={`h-4 w-4 ${isActive ? 'text-[#00F5D4]' : 'text-slate-400 group-hover:text-white'}`} />
                    <span>{link.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* User Menu / Login Action */}
          <div className="flex items-center gap-4">
            {token ? (
              <div className="relative">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="btn-secondary flex items-center gap-2 px-4 py-2 border border-white/10 hover:border-[#00F5D4]/30 bg-white/5 rounded-xl transition-all"
                >
                  <span className="text-sm font-semibold tracking-wide text-white">👤 {userName}</span>
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 z-50 mt-3 w-52 rounded-2xl bg-[#0d0d15] border border-white/10 shadow-2xl py-2 backdrop-blur-xl animate-in fade-in slide-in-from-top-3 duration-200">
                    <div className="px-4 py-2 border-b border-white/5">
                      <p className="text-xs text-slate-500 font-medium">Logged in as</p>
                      <p className="text-sm font-bold text-white truncate">{userName}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 px-4 py-3 mt-1 text-sm text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 rounded-xl transition-all font-semibold font-display"
                    >
                      <LogOut className="h-4 w-4" /> Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="px-6 py-2 bg-white text-[#08080C] font-bold rounded-xl hover:bg-[#00F5D4] transition-all"
              >
                Login
              </button>
            )}

            {/* Mobile Navigation Toggle */}
            <button
               onClick={() => setIsOpen(!isOpen)}
               className="p-2 rounded-lg bg-white/5 border border-white/10 text-white md:hidden hover:border-[#00F5D4]/40 hover:bg-white/10 transition-all"
            >
               {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer menu */}
      {isOpen && token && (
        <div className="md:hidden border-t border-white/5 py-4 space-y-2 bg-[#08080C] px-4 shadow-2xl animate-in fade-in slide-in-from-top-5 duration-200">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <button
                key={link.path}
                onClick={() => {
                  navigate(link.path);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center gap-3 px-4 py-3 text-sm rounded-xl transition-all ${
                  isActive
                    ? 'bg-[#00F5D4]/10 text-[#00F5D4] border-l-4 border-[#00F5D4] font-semibold'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <link.icon className="h-5 w-5" />
                <span>{link.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </nav>
  );
}
