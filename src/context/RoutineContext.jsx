import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CLASS_OPTIONS } from '../utils/constants';
import api from '../services/api';

const RoutineContext = createContext(null);

const defaultSubjects = {
  'মক্তব':          ['কুরআন','দোয়া','আরবি','বাংলা'],
  'হিফজ':           ['তিলাওয়াত','হিফজ','তাজবিদ','আরবি','বাংলা','গণিত'],
  'প্রথম শ্রেণি':   ['কুরআন','আরবি','বাংলা','ইংরেজি','গণিত'],
  'দ্বিতীয় শ্রেণি':['কুরআন','আরবি','বাংলা','ইংরেজি','গণিত'],
  'তৃতীয় শ্রেণি':  ['কুরআন','হাদিস','আরবি','বাংলা','ইংরেজি','গণিত'],
  'চতুর্থ শ্রেণি':  ['কুরআন','হাদিস','আরবি','বাংলা','ইংরেজি','গণিত'],
  'পঞ্চম শ্রেণি':   ['কুরআন','হাদিস','আরবি','বাংলা','ইংরেজি','গণিত'],
  'ষষ্ঠ শ্রেণি':    ['কুরআন','হাদিস','আরবি','বাংলা','ইংরেজি','গণিত','বিজ্ঞান'],
  'সপ্তম শ্রেণি':   ['কুরআন','হাদিস','আরবি','বাংলা','ইংরেজি','গণিত','বিজ্ঞান'],
  'অষ্টম শ্রেণি':   ['কুরআন','হাদিস','আরবি','বাংলা','ইংরেজি','গণিত','বিজ্ঞান'],
};

function makeDefaultClassRoutine() {
  const cols = [
    { id: 'c1', label: '1ম পিরিয়ড', time: '8:00-8:45' },
    { id: 'c2', label: '2য় পিরিয়ড', time: '8:45-9:30' },
    { id: 'c3', label: '3য় পিরিয়ড', time: '9:30-10:15' },
    { id: 'c4', label: 'বিরতি',       time: '10:15-10:30', leisure: true },
    { id: 'c5', label: '4র্থ পিরিয়ড', time: '10:30-11:15' },
    { id: 'c6', label: '5ম পিরিয়ড',  time: '11:15-12:00' },
    { id: 'c7', label: '6ষ্ঠ পিরিয়ড', time: '12:00-12:45' },
  ];
  const days = ['শনিবার','রবিবার','সোমবার','মঙ্গলবার','বুধবার','বৃহস্পতিবার'];
  const rows = days.map(day => ({ id: day, day, cells: {} }));
  const result = {};
  CLASS_OPTIONS.forEach(({ value: cls }) => { result[cls] = { columns: cols, rows }; });
  return result;
}

// key helper: "cls|sessionId"
const crKey = (cls, sid) => `${cls}|${sid || ''}`;
// key helper: "cls|sessionId|examId"
const erKey = (cls, sid, eid) => `${cls}|${sid || ''}|${eid || ''}`;

export function RoutineProvider({ children }) {
  const [classRoutines,  setClassRoutines]  = useState({});
  const [examRoutines,   setExamRoutines]   = useState({});
  const [classSubjects,  setClassSubjectsS] = useState(defaultSubjects);

  // Fetch class subjects
  useEffect(() => {
    api.get('/class-subjects')
      .then(res => {
        if (!Array.isArray(res.data)) return;
        const map = {};
        res.data.forEach(s => {
          if (!map[s.class_name]) map[s.class_name] = [];
          map[s.class_name].push(s.subject);
        });
        if (Object.keys(map).length > 0) setClassSubjectsS(map);
      })
      .catch(() => {});
  }, []);

  // ── Class routine ──────────────────────────────────────────
  const getClassRoutine = (cls, sessionId) => {
    return classRoutines[crKey(cls, sessionId)] || { columns: [], rows: [], published: false };
  };

  const fetchClassRoutine = useCallback(async (cls, sessionId, pubOnly = true) => {
    try {
      let url = `/class-routine?class=${encodeURIComponent(cls)}`;
      if (sessionId) url += `&session_id=${sessionId}`;
      if (!pubOnly)  url += `&published=0`;
      const res = await api.pub(url);
      if (res.data?.columns !== undefined) {
        setClassRoutines(prev => ({ ...prev, [crKey(cls, sessionId)]: res.data }));
      }
    } catch {}
  }, []);

  const updateClassRoutine = async (cls, sessionId, data) => {
    setClassRoutines(prev => ({ ...prev, [crKey(cls, sessionId)]: data }));
    await api.post('/class-routine', { class: cls, session_id: sessionId, ...data });
  };

  const publishClassRoutine = async (sessionId) => {
    await api.post('/class-routine/publish', { session_id: sessionId });
    // Refresh all classes for this session
    CLASS_OPTIONS.forEach(({ value: cls }) => fetchClassRoutine(cls, sessionId, false));
  };

  // ── Exam routine ───────────────────────────────────────────
  const getExamRoutine = (cls, sessionId, examId) => {
    return examRoutines[erKey(cls, sessionId, examId)] || { columns: [], rows: [], published: false };
  };

  const fetchExamRoutine = useCallback(async (cls, sessionId, examId, pubOnly = true) => {
    try {
      let url = `/exam-routine?class=${encodeURIComponent(cls)}`;
      if (sessionId) url += `&session_id=${sessionId}`;
      if (examId)    url += `&exam_id=${encodeURIComponent(examId)}`;
      if (!pubOnly)  url += `&published=0`;
      const res = await api.pub(url);
      if (res.data?.columns !== undefined) {
        setExamRoutines(prev => ({ ...prev, [erKey(cls, sessionId, examId)]: res.data }));
      }
    } catch {}
  }, []);

  const updateExamRoutine = async (cls, sessionId, examId, data) => {
    setExamRoutines(prev => ({ ...prev, [erKey(cls, sessionId, examId)]: data }));
    await api.post('/exam-routine', { class: cls, session_id: sessionId, exam_id: examId, ...data });
  };

  const publishExamRoutine = async (sessionId, examId) => {
    await api.post('/exam-routine/publish', { session_id: sessionId, exam_id: examId || null });
  };

  // ── Class subjects ─────────────────────────────────────────
  const getClassSubjects = (cls) => classSubjects[cls] || [];
  const updateClassSubjects = async (cls, list) => {
    setClassSubjectsS(prev => ({ ...prev, [cls]: list }));
  };

  return (
    <RoutineContext.Provider value={{
      getClassRoutine, fetchClassRoutine, updateClassRoutine, publishClassRoutine,
      getExamRoutine,  fetchExamRoutine,  updateExamRoutine,  publishExamRoutine,
      getClassSubjects, updateClassSubjects,
    }}>
      {children}
    </RoutineContext.Provider>
  );
}

export const useRoutine = () => useContext(RoutineContext);
