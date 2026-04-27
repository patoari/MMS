import { useState, useEffect } from 'react';
import { FiSearch, FiFilter, FiX } from 'react-icons/fi';
import api from '../services/api';
import './AdvancedSearchBar.css';

/**
 * Advanced Search Bar Component
 * Adapts filters based on context (students, results, receipts, fees, etc.)
 * 
 * @param {string} context - Type of search: 'students', 'results', 'receipts', 'fees', 'exams'
 * @param {function} onSearch - Callback with search parameters
 * @param {boolean} showSessionFilter - Show session dropdown
 * @param {boolean} showClassFilter - Show class dropdown
 * @param {boolean} showMonthFilter - Show month dropdown (for receipts)
 * @param {boolean} showExamFilter - Show exam dropdown (for results)
 */
export default function AdvancedSearchBar({ 
  context = 'students',
  onSearch,
  showSessionFilter = true,
  showClassFilter = true,
  showMonthFilter = false,
  showExamFilter = false
}) {
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filter states
  const [sessionId, setSessionId] = useState('');
  const [classId, setClassId] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [examId, setExamId] = useState('');
  
  // Data for dropdowns
  const [sessions, setSessions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [exams, setExams] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  
  // Load sessions
  useEffect(() => {
    if (showSessionFilter) {
      Promise.all([
        api.get('/sessions'),
        api.pub('/sessions/current')
      ]).then(([sessionsRes, currentRes]) => {
        setSessions(Array.isArray(sessionsRes.data) ? sessionsRes.data : []);
        setCurrentSession(currentRes.data);
        setSessionId(currentRes.data?.id || '');
      }).catch(() => {});
    }
  }, [showSessionFilter]);
  
  // Load classes
  useEffect(() => {
    if (showClassFilter) {
      api.get('/classes').then(res => {
        setClasses(Array.isArray(res.data) ? res.data : []);
      }).catch(() => {});
    }
  }, [showClassFilter]);
  
  // Load exams when session or class changes
  useEffect(() => {
    if (showExamFilter && (sessionId || classId)) {
      const params = new URLSearchParams();
      if (sessionId) params.append('session_id', sessionId);
      if (classId) params.append('class_id', classId);
      
      api.get(`/exams?${params}`).then(res => {
        setExams(Array.isArray(res.data) ? res.data : []);
      }).catch(() => {});
    }
  }, [showExamFilter, sessionId, classId]);
  
  const handleSearch = () => {
    const filters = {
      q: searchQuery,
      ...(sessionId && { session_id: sessionId }),
      ...(classId && { class_id: classId }),
      ...(month && { month }),
      ...(year && { year }),
      ...(examId && { exam_id: examId })
    };
    
    onSearch(filters);
  };
  
  const handleClear = () => {
    setSearchQuery('');
    setSessionId(currentSession?.id || '');
    setClassId('');
    setMonth('');
    setYear(new Date().getFullYear());
    setExamId('');
    onSearch({});
  };
  
  const getPlaceholder = () => {
    switch (context) {
      case 'students': return 'নাম, আইডি বা ফোন নম্বর দিয়ে খুঁজুন...';
      case 'results': return 'শিক্ষার্থীর নাম বা আইডি দিয়ে খুঁজুন...';
      case 'receipts': return 'রসিদ নম্বর বা শিক্ষার্থীর নাম দিয়ে খুঁজুন...';
      case 'fees': return 'শিক্ষার্থীর নাম বা আইডি দিয়ে খুঁজুন...';
      case 'exams': return 'পরীক্ষার নাম দিয়ে খুঁজুন...';
      default: return 'খুঁজুন...';
    }
  };
  
  const months = [
    { value: '1', label: 'জানুয়ারি' },
    { value: '2', label: 'ফেব্রুয়ারি' },
    { value: '3', label: 'মার্চ' },
    { value: '4', label: 'এপ্রিল' },
    { value: '5', label: 'মে' },
    { value: '6', label: 'জুন' },
    { value: '7', label: 'জুলাই' },
    { value: '8', label: 'আগস্ট' },
    { value: '9', label: 'সেপ্টেম্বর' },
    { value: '10', label: 'অক্টোবর' },
    { value: '11', label: 'নভেম্বর' },
    { value: '12', label: 'ডিসেম্বর' }
  ];
  
  return (
    <div className="advanced-search-bar">
      <div className="search-main">
        <div className="search-input-wrapper">
          <FiSearch className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder={getPlaceholder()}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          {searchQuery && (
            <button className="search-clear-btn" onClick={() => setSearchQuery('')}>
              <FiX />
            </button>
          )}
        </div>
        
        <button 
          className={`filter-toggle-btn ${showFilters ? 'active' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
        >
          <FiFilter /> ফিল্টার
        </button>
        
        <button className="search-btn" onClick={handleSearch}>
          খুঁজুন
        </button>
      </div>
      
      {showFilters && (
        <div className="search-filters">
          <div className="filters-grid">
            {/* Session Filter */}
            {showSessionFilter && (
              <div className="filter-item">
                <label>শিক্ষাবর্ষ</label>
                <select 
                  value={sessionId} 
                  onChange={(e) => setSessionId(e.target.value)}
                  className="filter-select"
                >
                  <option value="">সকল সেশন</option>
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.is_current ? '(বর্তমান)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {/* Class Filter */}
            {showClassFilter && (
              <div className="filter-item">
                <label>শ্রেণি</label>
                <select 
                  value={classId} 
                  onChange={(e) => setClassId(e.target.value)}
                  className="filter-select"
                >
                  <option value="">সকল শ্রেণি</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {/* Month Filter (for receipts) */}
            {showMonthFilter && (
              <>
                <div className="filter-item">
                  <label>মাস</label>
                  <select 
                    value={month} 
                    onChange={(e) => setMonth(e.target.value)}
                    className="filter-select"
                  >
                    <option value="">সকল মাস</option>
                    {months.map(m => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="filter-item">
                  <label>বছর</label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="filter-input"
                    placeholder="2026"
                    min="2020"
                    max="2050"
                  />
                </div>
              </>
            )}
            
            {/* Exam Filter (for results) */}
            {showExamFilter && (
              <div className="filter-item">
                <label>পরীক্ষা</label>
                <select 
                  value={examId} 
                  onChange={(e) => setExamId(e.target.value)}
                  className="filter-select"
                >
                  <option value="">সকল পরীক্ষা</option>
                  {exams.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          
          <div className="filters-actions">
            <button className="clear-filters-btn" onClick={handleClear}>
              <FiX /> ফিল্টার মুছুন
            </button>
            <div className="active-filters">
              {sessionId && <span className="filter-tag">সেশন: {sessions.find(s => s.id == sessionId)?.name}</span>}
              {classId && <span className="filter-tag">শ্রেণি: {classes.find(c => c.id == classId)?.name}</span>}
              {month && <span className="filter-tag">মাস: {months.find(m => m.value === month)?.label}</span>}
              {year && month && <span className="filter-tag">বছর: {year}</span>}
              {examId && <span className="filter-tag">পরীক্ষা: {exams.find(e => e.id === examId)?.name}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
