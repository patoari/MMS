import { createContext, useContext, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

function getStoredUser() {
  try {
    const stored = localStorage.getItem('mms_user');
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(getStoredUser);
  const [loading, setLoading] = useState(false);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      const userData = { ...res.data.user, token: res.data.token, studentId: res.data.studentId, teacherId: res.data.teacherId };
      setUser(userData);
      localStorage.setItem('mms_user', JSON.stringify(userData));
      return userData;
    } finally {
      setLoading(false);
    }
  };

  const studentLogin = async (studentId) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/student-login', { studentId });
      const userData = { ...res.data.user, token: res.data.token, studentId: res.data.studentId };
      setUser(userData);
      localStorage.setItem('mms_user', JSON.stringify(userData));
      return userData;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('mms_user');
  };

  const initAuth = () => {}; // no-op, state already initialized from localStorage

  return (
    <AuthContext.Provider value={{ user, login, studentLogin, logout, loading, initAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
