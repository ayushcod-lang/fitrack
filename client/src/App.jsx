import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Workout from './pages/Workout';
import Diet from './pages/Diet';
import Progress from './pages/Progress';
import Settings from './pages/Settings';

const Spinner = () => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100vh', background: '#0A0F1E'
  }}>
    <div className="spinner" />
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.onboardingComplete) return <Navigate to="/onboarding" replace />;
  return children;
};

const AppRoutes = () => {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/onboarding" element={
        !user ? <Navigate to="/login" replace /> :
        user.onboardingComplete ? <Navigate to="/" replace /> :
        <Onboarding />
      } />
      <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
      <Route path="/workout" element={<ProtectedRoute><Layout><Workout /></Layout></ProtectedRoute>} />
      <Route path="/diet" element={<ProtectedRoute><Layout><Diet /></Layout></ProtectedRoute>} />
      <Route path="/progress" element={<ProtectedRoute><Layout><Progress /></Layout></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
