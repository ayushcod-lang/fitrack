import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AICoach from './AICoach/AICoach';
import './Layout.css';

const navItems = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/workout', label: 'Workout', icon: '💪' },
  { path: '/diet', label: 'Diet', icon: '🍎' },
  { path: '/progress', label: 'Progress', icon: '📈' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
];

const Layout = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">⚡</span>
          <span className="brand-text">FitNex</span>
        </div>
        <div className="sidebar-user">
          {user?.photoURL && <img src={user.photoURL} alt="" className="sidebar-avatar" referrerPolicy="no-referrer" />}
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.name || 'User'}</span>
            <span className="sidebar-user-goal tag tag-green">{user?.goal?.replace('_', ' ') || 'No goal set'}</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink key={item.path} to={item.path} end={item.path === '/'} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <span className="sidebar-link-icon">{item.icon}</span>
              <span className="sidebar-link-label">{item.label}</span>
              {location.pathname === item.path && <span className="sidebar-link-indicator" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-calorie-target">
            <span className="sidebar-footer-label">Daily Target</span>
            <span className="sidebar-footer-value">{user?.calorieTarget || '—'} kcal</span>
          </div>
        </div>
      </aside>
      <main className="main-content">{children}</main>
      <nav className="bottom-nav">
        {navItems.map(item => (
          <NavLink key={item.path} to={item.path} end={item.path === '/'} className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
            <span className="bottom-nav-icon">{item.icon}</span>
            <span className="bottom-nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <AICoach />
    </div>
  );
};

export default Layout;
