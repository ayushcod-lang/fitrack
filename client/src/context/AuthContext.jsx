import { createContext, useContext, useEffect, useState } from 'react';
import { auth, signInWithGoogle, logOut } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import api from '../api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }) => {
  // Security: always start null — never trust localStorage as auth state.
  // Firebase onAuthStateChanged is the single source of truth.
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthError(null);
      if (firebaseUser) {
        try {
          // Always get a fresh token — Firebase auto-refreshes it
          const idToken = await firebaseUser.getIdToken(true);
          const { data } = await api.post('/api/auth/google', { idToken });
          localStorage.setItem('fitnex_token', data.token);
          localStorage.setItem('fitnex_user', JSON.stringify(data.user));
          setUser(data.user);
        } catch (err) {
          console.error('Backend auth failed:', err.message);
          // Clear everything on backend failure — don't leave stale state
          localStorage.removeItem('fitnex_token');
          localStorage.removeItem('fitnex_user');
          setUser(null);
          setAuthError('Sign-in failed. Please try again.');
        }
      } else {
        localStorage.removeItem('fitnex_token');
        localStorage.removeItem('fitnex_user');
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
      // onAuthStateChanged handles everything after this —
      // do NOT setUser here, that creates a race condition
    } catch (err) {
      console.error('Login failed:', err.message);
      setAuthError('Google sign-in was cancelled or failed.');
      throw err;
    }
  };

  const logout = async () => {
    await logOut();
    localStorage.removeItem('fitnex_token');
    localStorage.removeItem('fitnex_user');
    setUser(null);
  };

  const updateUser = (updatedData) => {
    const newUser = { ...user, ...updatedData };
    setUser(newUser);
    localStorage.setItem('fitnex_user', JSON.stringify(newUser));
  };

  return (
    <AuthContext.Provider value={{ user, loading, authError, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};
