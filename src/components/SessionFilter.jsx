import { useSessionFilter } from '../context/SessionFilterContext';
import { CLASS_OPTIONS } from '../utils/constants';
import { FiFilter, FiX } from 'react-icons/fi';
import './SessionFilter.css';

const SECTIONS = ['ক', 'খ', 'গ', 'ঘ'];

export default function SessionFilter({ showStudentId = true }) {
  const {
    sessions, sessionId, setSessionId,
    classFilter, setClassFilter,
    section, setSection,
    studentId, setStudentId,
    reset,
  } = useSessionFilter();

  const hasFilter = sessionId || classFilter || section || studentId;

  return (
    <div className="session-filter-bar">
      <div className="sf-icon"><FiFilter /></div>

      <select className="sf-select" value={sessionId} onChange={e => setSessionId(e.target.value)}>
        <option value="">সব সেশন</option>
        {sessions.map(s => (
          <option key={s.id} value={s.id}>
            {s.name}{Number(s.is_current) ? ' (চলমান)' : ''}
          </option>
        ))}
      </select>

      <select className="sf-select" value={classFilter} onChange={e => setClassFilter(e.target.value)}>
        <option value="">সব শ্রেণি</option>
        {CLASS_OPTIONS.map(c => (
          <option key={c.value} value={c.value}>{c.label}</option>
        ))}
      </select>

      <select className="sf-select sf-select-sm" value={section} onChange={e => setSection(e.target.value)}>
        <option value="">সব সেকশন</option>
        {SECTIONS.map(s => (
          <option key={s} value={s}>সেকশন {s}</option>
        ))}
      </select>

      {showStudentId && (
        <input
          className="sf-input"
          placeholder="শিক্ষার্থী আইডি..."
          value={studentId}
          onChange={e => setStudentId(e.target.value)}
        />
      )}

      {hasFilter && (
        <button className="sf-clear" onClick={reset}>
          <FiX /> ফিল্টার মুছুন
        </button>
      )}
    </div>
  );
}
