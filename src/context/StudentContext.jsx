import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const StudentContext = createContext(null);

export function StudentProvider({ children }) {
  const [students, setStudents] = useState([]);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(false);

  const fetchStudents = async (q = '') => {
    setLoading(true);
    try {
      // Fetch all students for current session (no limit cap)
      const res = await api.get(`/students?search=${encodeURIComponent(q)}&limit=2000`);
      // paginate returns { success, data: [...], meta: {...} }
      const list = Array.isArray(res.data) ? res.data : [];
      setStudents(list);
    } catch (e) {
      // Failed to load students - will show empty list
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStudents(search); }, [search]);

  const addStudent = async (studentOrFormData) => {
    // if FormData, send multipart; otherwise JSON
    if (studentOrFormData instanceof FormData) {
      await api.post('/students', studentOrFormData);
    } else {
      await api.post('/students', studentOrFormData);
    }
    await fetchStudents(search);
  };

  const updateStudent = async (id, data) => {
    // if FormData, send multipart using POST (PHP doesn't support $_FILES with PUT)
    if (data instanceof FormData) {
      // Add _method field to simulate PUT
      data.append('_method', 'PUT');
      await api.post(`/students/${id}`, data);
    } else {
      await api.put(`/students/${id}`, data);
    }
    await fetchStudents(search);
  };

  const deleteStudent = async (id) => {
    await api.delete(`/students/${id}`);
    setStudents(prev => prev.filter(s => s.id !== id));
  };

  const restoreStudent = async (id) => {
    await api.put(`/students/${id}/restore`);
    await fetchStudents(search);
  };

  const fetchArchivedStudents = async (q = '') => {
    const res = await api.get(`/students?archived=1&search=${encodeURIComponent(q)}&limit=2000`);
    return Array.isArray(res.data) ? res.data : [];
  };

  return (
    <StudentContext.Provider value={{
      students, allStudents: students, loading,
      addStudent, updateStudent, deleteStudent, restoreStudent, fetchArchivedStudents,
      search, setSearch,
    }}>
      {children}
    </StudentContext.Provider>
  );
}

export const useStudents = () => useContext(StudentContext);
