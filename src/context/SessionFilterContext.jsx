import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const SessionFilterContext = createContext(null);

export function SessionFilterProvider({ children }) {
  const [sessions, setSessions]       = useState([]);
  const [sessionId, setSessionId]     = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [section, setSection]         = useState('');
  const [studentId, setStudentId]     = useState('');

  useEffect(() => {
    api.pub('/sessions/all')
      .then(r => {
        const list = Array.isArray(r.data) ? r.data : [];
        setSessions(list);
        const current = list.find(s => Number(s.is_current) === 1);
        if (current) setSessionId(String(current.id));
      })
      .catch(() => {});
  }, []);

  const reset = () => {
    setClassFilter('');
    setSection('');
    setStudentId('');
  };

  const buildQuery = (extra = {}) => {
    const params = new URLSearchParams();
    if (sessionId)   params.set('session_id', sessionId);
    if (classFilter) params.set('class', classFilter);
    if (section)     params.set('section', section);
    if (studentId)   params.set('student_id', studentId.trim());
    Object.entries(extra).forEach(([k, v]) => { if (v) params.set(k, v); });
    return params.toString();
  };

  return (
    <SessionFilterContext.Provider value={{
      sessions, sessionId, setSessionId,
      classFilter, setClassFilter,
      section, setSection,
      studentId, setStudentId,
      buildQuery, reset,
    }}>
      {children}
    </SessionFilterContext.Provider>
  );
}

export const useSessionFilter = () => useContext(SessionFilterContext);
