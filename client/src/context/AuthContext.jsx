import { createContext, useContext, useEffect, useState } from 'react';
import { auth, signInWithGoogle, logOut, getGoogleRedirectResult } from '../firebase';
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

  // Handle redirect result when user returns from Google sign-in
  useEffect(() => {
    getGoogleRedirectResult()
      .then(async (result) => {
        if (result?.user) {
          // User just returned from Google redirect — onAuthStateChanged will fire too,
          // but we log here for visibility
          console.log('Redirect sign-in successful');
        }
      })
      .catch((err) => {
        if (err.code !== 'auth/popup-closed-by-user') {
          console.error('Redirect result error:', err.message);
          setAuthError('Sign-in failed. Please try again.');
        }
      });
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthError(null);
      if (firebaseUser) {
        // Render free tier can take 30-50s to wake up — retry once with long timeout
        const attemptBackendAuth = async (attempt = 1) => {
          try {
            console.log(`Backend auth attempt ${attempt}...`);
            const idToken = await firebaseUser.getIdToken(true);
            const { data } = await api.post('/api/auth/google', { idToken }, {
              timeout: 60000, // 60s timeout to survive Render cold start
            });
            localStorage.setItem('fitnex_token', data.token);
            localStorage.setItem('fitnex_user', JSON.stringify(data.user));
            setUser(data.user);
            console.log('Backend auth success');
          } catch (err) {
            console.error(`Backend auth attempt ${attempt} failed:`, err.message, err.response?.status, err.response?.data);
            if (attempt < 2) {
              console.log('Retrying backend auth in 3s...');
              await new Promise(r => setTimeout(r, 3000));
              return attemptBackendAuth(attempt + 1);
            }
            // All attempts failed — clear state
            localStorage.removeItem('fitnex_token');
            localStorage.removeItem('fitnex_user');
            setUser(null);
            setAuthError('Sign-in failed. Please try again.');
          }
        };
        await attemptBackendAuth();
      } else {
        localStorage.removeItem('fitnex_token');
        localStorage.removeItem('fitnex_user');
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = () => {
    setAuthError(null);
    // signInWithRedirect navigates away — no return value to await
    signInWithGoogle();
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
