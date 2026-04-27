import { useState, useEffect, useRef, useMemo } from 'react';
import { useRoutine } from '../../context/RoutineContext';
import { CLASS_OPTIONS } from '../../utils/constants';
import Button from '../../components/Button';
import { FiPlus, FiTrash2, FiSave, FiCheck, FiX, FiGlobe } from 'react-icons/fi';
import api from '../../services/api';
import swal from '../../utils/swal';
import './AdminRoutine.css';

// ── Session + Exam selector bar ───────────────────────────────────────────────
function SessionSelector({ sessions, value, onChange, label = 'সেশন' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{label}:</span>
      <select
        className="rg-time-input"
        value={value || ''}
        onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
        style={{ minWidth: 140, cursor: 'pointer', fontWeight: 500 }}
      >
        <option value="">-- সেশন নির্বাচন করুন --</option>
        {sessions.map(s => (
          <option key={s.id} value={s.id}>{s.name} {s.is_current ? '(চলমান)' : ''}</option>
        ))}
      </select>
    </div>
  );
}

function ExamSelector({ exams, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>পরীক্ষা:</span>
      <select
        className="rg-time-input"
        value={value || ''}
        onChange={e => onChange(e.target.value || null)}
        style={{ minWidth: 180, cursor: 'pointer', fontWeight: 500 }}
      >
        <option value="">-- পরীক্ষা নির্বাচন করুন --</option>
        {exams.map(e => (
          <option key={e.id} value={e.id}>{e.name}</option>
        ))}
      </select>
    </div>
  );
}

// ── Shared editable grid (Class Routine) ──────────────────────────────────────
const BANGLA_DAYS = ['শনিবার','রবিবার','সোমবার','মঙ্গলবার','বুধবার','বৃহস্পতিবার','শুক্রবার'];
const PERIOD_LABELS = ['১ম','২য়','৩য়','৪র্থ','৫ম','৬ষ্ঠ','৭ম','৮ম','৯ম','১০ম'];

// busyTeachers: { colId: { day: Set<teacherName> } } — teachers busy in other classes same period+day
function RoutineGrid({ data, onSave, colHeaderExtra, rowHeaderKey = 'day', newColDefaults = {}, newRowDefaults = {}, subjectOptions = [], teacherOptions = [], busyTeachers = {} }) {
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(data)));
  const [saved, setSaved] = useState(false);
  const dataKeyRef = useRef(JSON.stringify(data));

  useEffect(() => {
    const key = JSON.stringify(data);
    if (key !== dataKeyRef.current) { dataKeyRef.current = key; setDraft(JSON.parse(JSON.stringify(data))); }
  }, [data]);

  const sync = (fn) => setDraft(prev => { const next = JSON.parse(JSON.stringify(prev)); fn(next); return next; });

  const addCol = () => sync(d => d.columns.push({ id: `col_${Date.now()}`, label: '', ...newColDefaults }));
  const delCol = (id) => sync(d => { d.columns = d.columns.filter(c => c.id !== id); d.rows.forEach(r => delete r.cells[id]); });
  const setColField = (id, field, val) => sync(d => { const c = d.columns.find(c => c.id === id); if (c) c[field] = val; });

  const addRow = () => sync(d => d.rows.push({ id: `row_${Date.now()}`, cells: {}, [rowHeaderKey]: '', ...newRowDefaults }));
  const delRow = (id) => sync(d => { d.rows = d.rows.filter(r => r.id !== id); });
  const setRowHeader = (id, val) => sync(d => { const r = d.rows.find(r => r.id === id); if (r) r[rowHeaderKey] = val; });
  const setCell = (rowId, colId, field, val) => sync(d => {
    const r = d.rows.find(r => r.id === rowId);
    if (r) {
      if (!r.cells[colId]) r.cells[colId] = {};
      if (typeof r.cells[colId] === 'string') r.cells[colId] = { subject: r.cells[colId], teacher: '' };
      r.cells[colId][field] = val;
    }
  });

  const handleSave = () => { onSave(draft); setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <div className="rg-wrapper">
      <div className="rg-scroll">
        <table className="rg-table">
          <thead>
            {/* Period number row */}
            <tr>
              <th className="rg-corner"></th>
              {draft.columns.map((col, ci) => {
                // Count non-leisure columns before this one for period numbering
                const periodNum = draft.columns.slice(0, ci + 1).filter(c => !c.leisure).length;
                return (
                  <th key={col.id} style={{
                    background: col.leisure ? '#fff8e1' : 'var(--primary)',
                    color: col.leisure ? '#b8860b' : '#fff',
                    padding: '4px 8px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textAlign: 'center',
                    borderBottom: '1px solid rgba(255,255,255,0.2)',
                  }}>
                    {col.leisure ? 'বিরতি' : `${PERIOD_LABELS[periodNum - 1] || periodNum + 'ম'} পিরিয়ড`}
                  </th>
                );
              })}
              <th style={{ background: 'var(--bg)' }}></th>
            </tr>
            {/* Editable label row */}
            <tr>
              <th className="rg-corner"></th>
              {draft.columns.map((col, ci) => (
                <th key={col.id} className="rg-col-header">
                  <input className="rg-header-input" value={col.label} onChange={e => setColField(col.id, 'label', e.target.value)} placeholder={`কলাম ${ci+1}`} />
                  {colHeaderExtra && colHeaderExtra(col, ci, setColField)}
                  <button className="rg-del-btn" onClick={() => delCol(col.id)} title="কলাম মুছুন"><FiTrash2 /></button>
                </th>
              ))}
              <th className="rg-add-col-th"><button className="rg-add-btn" onClick={addCol}><FiPlus /> কলাম</button></th>
            </tr>
          </thead>
          <tbody>
            {draft.rows.map((row, ri) => (
              <tr key={row.id} className={ri % 2 === 0 ? 'rg-even' : ''}>
                <td className="rg-row-header">
                  {rowHeaderKey === 'day' ? (
                    <select className="rg-row-input rg-day-select" value={row[rowHeaderKey] || ''} onChange={e => setRowHeader(row.id, e.target.value)}>
                      <option value="">-- বার --</option>
                      {BANGLA_DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  ) : (
                    <input className="rg-row-input" value={row[rowHeaderKey] || ''} onChange={e => setRowHeader(row.id, e.target.value)} placeholder="সারি" />
                  )}
                  <button className="rg-del-btn" onClick={() => delRow(row.id)} title="সারি মুছুন"><FiTrash2 /></button>
                </td>
                {draft.columns.map(col => {
                  const cellData = row.cells[col.id] || {};
                  const cellValue = typeof cellData === 'string' ? { subject: cellData, teacher: '' } : cellData;
                  const day = row[rowHeaderKey] || '';

                  // Teachers busy in other classes for this same period+day
                  const busySet = busyTeachers[col.id]?.[day] || new Set();
                  const availableTeachers = teacherOptions.filter(t => !busySet.has(t) || t === cellValue.teacher);

                  return (
                    <td key={col.id} className={`rg-cell${col.leisure ? ' rg-leisure' : ''}`}>
                      {col.leisure ? <span className="rg-leisure-label">বিরতি</span> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {subjectOptions.length > 0 ? (
                            <select className="rg-cell-select" value={cellValue.subject || ''} onChange={e => setCell(row.id, col.id, 'subject', e.target.value)}>
                              <option value="">-- বিষয় --</option>
                              {subjectOptions.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          ) : (
                            <input className="rg-cell-input" value={cellValue.subject || ''} onChange={e => setCell(row.id, col.id, 'subject', e.target.value)} placeholder="বিষয়" />
                          )}
                          {teacherOptions.length > 0 && (
                            <select className="rg-cell-select" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }} value={cellValue.teacher || ''} onChange={e => setCell(row.id, col.id, 'teacher', e.target.value)}>
                              <option value="">-- শিক্ষক --</option>
                              {availableTeachers.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
                <td></td>
              </tr>
            ))}
            <tr>
              <td colSpan={draft.columns.length + 2}>
                <button className="rg-add-row-btn" onClick={addRow}><FiPlus /> নতুন সারি যোগ করুন</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="rg-save-bar">
        <Button icon={saved ? <FiCheck /> : <FiSave />} onClick={handleSave} variant={saved ? 'success' : 'primary'}>
          {saved ? 'সংরক্ষিত হয়েছে ✓' : 'সংরক্ষণ করুন (খসড়া)'}
        </Button>
      </div>
    </div>
  );
}

// ── Subject bar ───────────────────────────────────────────────────────────────
function SubjectBar({ selectedClass }) {
  const { getClassSubjects, updateClassSubjects } = useRoutine();
  const [newSubject, setNewSubject] = useState('');
  const subjects = getClassSubjects(selectedClass);

  const add = () => {
    const s = newSubject.trim();
    if (!s || subjects.includes(s)) return;
    updateClassSubjects(selectedClass, [...subjects, s]);
    setNewSubject('');
  };
  const remove = (s) => updateClassSubjects(selectedClass, subjects.filter(x => x !== s));

  return (
    <div className="subject-bar">
      <span className="subject-bar-label">বিষয় তালিকা:</span>
      <div className="subject-bar-chips">
        {subjects.length === 0 && <span className="cr-no-subject">কোনো বিষয় নেই</span>}
        {subjects.map(s => (
          <div key={s} className="cr-chip"><span>{s}</span><button onClick={() => remove(s)} className="cr-chip-del"><FiX /></button></div>
        ))}
      </div>
      <div className="subject-bar-add">
        <input className="cr-new-subject-input" value={newSubject} onChange={e => setNewSubject(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="নতুন বিষয়..." />
        <button className="cr-add-subject-btn" onClick={add}><FiPlus /></button>
      </div>
    </div>
  );
}

// ── Exam Routine Grid ─────────────────────────────────────────────────────────
function ExamRoutineGrid({ data, onSave, colHeaderExtra, subjectOptions = [] }) {
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(data)));
  const [saved, setSaved] = useState(false);
  const dataKeyRef = useRef(JSON.stringify(data));

  useEffect(() => {
    const key = JSON.stringify(data);
    if (key !== dataKeyRef.current) { dataKeyRef.current = key; setDraft(JSON.parse(JSON.stringify(data))); }
  }, [data]);

  const sync = (fn) => setDraft(prev => { const next = JSON.parse(JSON.stringify(prev)); fn(next); return next; });

  const addCol = () => sync(d => d.columns.push({ id: `col_${Date.now()}`, label: '', examColType: '' }));
  const delCol = (id) => sync(d => { d.columns = d.columns.filter(c => c.id !== id); d.rows.forEach(r => delete r.cells[id]); });
  const setColField = (id, field, val) => sync(d => { const c = d.columns.find(c => c.id === id); if (c) c[field] = val; });

  const addRow = () => sync(d => d.rows.push({ id: `row_${Date.now()}`, cells: {}, serial: '' }));
  const delRow = (id) => sync(d => { d.rows = d.rows.filter(r => r.id !== id); });
  const setRowHeader = (id, val) => sync(d => { const r = d.rows.find(r => r.id === id); if (r) r.serial = val; });
  const setCell = (rowId, colId, val) => sync(d => { const r = d.rows.find(r => r.id === rowId); if (r) r.cells[colId] = { value: val }; });

  const getCellValue = (row, colId) => {
    const c = row.cells[colId];
    if (!c) return '';
    if (typeof c === 'string') return c;
    return c.value ?? c.subject ?? '';
  };

  const handleSave = () => { onSave(draft); setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <div className="rg-wrapper">
      <div className="rg-scroll">
        <table className="rg-table">
          <thead>
            <tr>
              <th className="rg-corner"></th>
              {draft.columns.map((col, ci) => (
                <th key={col.id} className="rg-col-header">
                  <input className="rg-header-input" value={col.label} onChange={e => setColField(col.id, 'label', e.target.value)} placeholder={`কলাম ${ci+1}`} />
                  {colHeaderExtra && colHeaderExtra(col, ci, setColField)}
                  <button className="rg-del-btn" onClick={() => delCol(col.id)} title="কলাম মুছুন"><FiTrash2 /></button>
                </th>
              ))}
              <th className="rg-add-col-th"><button className="rg-add-btn" onClick={addCol}><FiPlus /> কলাম</button></th>
            </tr>
          </thead>
          <tbody>
            {draft.rows.map((row, ri) => (
              <tr key={row.id} className={ri % 2 === 0 ? 'rg-even' : ''}>
                <td className="rg-row-header">
                  <input className="rg-row-input" value={row.serial || ''} onChange={e => setRowHeader(row.id, e.target.value)} placeholder="সারি" />
                  <button className="rg-del-btn" onClick={() => delRow(row.id)} title="সারি মুছুন"><FiTrash2 /></button>
                </td>
                {draft.columns.map(col => {
                  const val = getCellValue(row, col.id);
                  return (
                    <td key={col.id} className="rg-cell">
                      {col.examColType === 'subject' ? (
                        <select className="rg-cell-select" value={val} onChange={e => setCell(row.id, col.id, e.target.value)}>
                          <option value="">-- বিষয় --</option>
                          {subjectOptions.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : col.examColType === 'day' ? (
                        <select className="rg-cell-select" value={val} onChange={e => setCell(row.id, col.id, e.target.value)}>
                          <option value="">-- বার --</option>
                          {BANGLA_DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      ) : (
                        <input className="rg-cell-input" value={val} onChange={e => setCell(row.id, col.id, e.target.value)} placeholder="..." />
                      )}
                    </td>
                  );
                })}
                <td></td>
              </tr>
            ))}
            <tr>
              <td colSpan={draft.columns.length + 2}>
                <button className="rg-add-row-btn" onClick={addRow}><FiPlus /> নতুন সারি যোগ করুন</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="rg-save-bar">
        <Button icon={saved ? <FiCheck /> : <FiSave />} onClick={handleSave} variant={saved ? 'success' : 'primary'}>
          {saved ? 'সংরক্ষিত হয়েছে ✓' : 'সংরক্ষণ করুন (খসড়া)'}
        </Button>
      </div>
    </div>
  );
}

// ── Class Routine Editor ──────────────────────────────────────────────────────
function ClassRoutineEditor({ sessions, currentSessionId }) {
  const { getClassRoutine, fetchClassRoutine, updateClassRoutine, publishClassRoutine, getClassSubjects } = useRoutine();
  const [selectedClass,   setSelectedClass]   = useState(CLASS_OPTIONS[0]?.value || '');
  const [selectedSession, setSelectedSession] = useState(currentSessionId || null);
  const [teachers, setTeachers] = useState([]);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => { if (currentSessionId && !selectedSession) setSelectedSession(currentSessionId); }, [currentSessionId]);

  useEffect(() => {
    if (selectedClass && selectedSession) fetchClassRoutine(selectedClass, selectedSession, false);
  }, [selectedClass, selectedSession]);

  useEffect(() => {
    api.get('/teachers')
      .then(res => {
        if (Array.isArray(res.data))
          setTeachers(res.data.filter(t => t.status === 'সক্রিয়' && !t.is_user_only).map(t => t.name));
      }).catch(() => {});
  }, []);

  const data     = getClassRoutine(selectedClass, selectedSession);
  const subjects = getClassSubjects(selectedClass);

  // Build busyTeachers map: { colId: { day: Set<teacher> } } from all OTHER classes
  // We need to match columns by sort_order (period position) since col IDs differ per class
  const busyTeachers = useMemo(() => {
    const busy = {};
    // Get current class column order (by sort_order / array index)
    const currentCols = data.columns || [];

    CLASS_OPTIONS.forEach(({ value: cls }) => {
      if (cls === selectedClass) return;
      const other = getClassRoutine(cls, selectedSession);
      if (!other.columns?.length) return;

      other.rows.forEach(row => {
        const day = row.day || '';
        other.columns.forEach((otherCol, oi) => {
          if (otherCol.leisure) return;
          const cell = row.cells?.[otherCol.id];
          const teacher = typeof cell === 'object' ? cell?.teacher : null;
          if (!teacher) return;

          // Match to current class column by period index (non-leisure position)
          const otherPeriodIdx = other.columns.slice(0, oi + 1).filter(c => !c.leisure).length - 1;
          // Find the current class column at the same period index
          let curPeriodCount = -1;
          const matchedCol = currentCols.find((c, ci) => {
            if (!c.leisure) curPeriodCount++;
            return curPeriodCount === otherPeriodIdx && !c.leisure;
          });
          if (!matchedCol) return;

          if (!busy[matchedCol.id]) busy[matchedCol.id] = {};
          if (!busy[matchedCol.id][day]) busy[matchedCol.id][day] = new Set();
          busy[matchedCol.id][day].add(teacher);
        });
      });
    });
    return busy;
  }, [data, selectedClass, selectedSession, getClassRoutine]);

  const colHeaderExtra = (col, _ci, setColField) => (
    <div className="rg-col-extras">
      <input className="rg-time-input" value={col.time || ''} onChange={e => setColField(col.id, 'time', e.target.value)} placeholder="সময়" />
      <label className="rg-leisure-toggle">
        <input type="checkbox" checked={!!col.leisure} onChange={e => setColField(col.id, 'leisure', e.target.checked)} />
        <span>বিরতি</span>
      </label>
    </div>
  );

  const handlePublish = async () => {
    if (!selectedSession) return swal.error('সেশন নির্বাচন করুন');
    const ok = await swal.confirm('সকল ক্লাস রুটিন প্রকাশ করবেন?', 'এই সেশনের সকল শ্রেণির ক্লাস রুটিন প্রকাশিত হবে এবং নোটিশ তৈরি হবে।');
    if (!ok) return;
    setPublishing(true);
    try {
      await publishClassRoutine(selectedSession);
      swal.success('সকল ক্লাস রুটিন প্রকাশিত হয়েছে');
    } catch (e) { swal.error(e.message); }
    setPublishing(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Top bar: session + publish */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <SessionSelector sessions={sessions} value={selectedSession} onChange={setSelectedSession} />
        <Button icon={<FiGlobe />} variant="success" onClick={handlePublish} disabled={publishing || !selectedSession}>
          {publishing ? 'প্রকাশ হচ্ছে...' : 'সকল ক্লাস রুটিন প্রকাশ করুন'}
        </Button>
      </div>

      {/* Draft badge */}
      {!data.published && data.columns?.length > 0 && (
        <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 6, padding: '6px 12px', fontSize: '0.82rem', color: '#856404' }}>
          ⚠ এই রুটিনটি এখনো খসড়া অবস্থায় আছে। প্রকাশ করতে উপরের বোতাম ব্যবহার করুন।
        </div>
      )}

      {/* Class selector */}
      <div className="routine-class-select">
        {CLASS_OPTIONS.map(c => (
          <button key={c.value} className={`class-btn${selectedClass === c.value ? ' active' : ''}`} onClick={() => setSelectedClass(c.value)}>{c.label}</button>
        ))}
      </div>

      <SubjectBar selectedClass={selectedClass} />

      {!selectedSession ? (
        <p style={{ color: 'var(--text-muted)', padding: 24, textAlign: 'center' }}>সেশন নির্বাচন করুন।</p>
      ) : (
        <RoutineGrid
          key={`${selectedClass}|${selectedSession}`}
          data={data}
          onSave={(d) => updateClassRoutine(selectedClass, selectedSession, d)}
          colHeaderExtra={colHeaderExtra}
          rowHeaderKey="day"
          newColDefaults={{ time: '', leisure: false }}
          subjectOptions={subjects}
          teacherOptions={teachers}
          busyTeachers={busyTeachers}
        />
      )}
    </div>
  );
}

// ── Exam Routine Editor ───────────────────────────────────────────────────────
function ExamRoutineEditor({ sessions, currentSessionId }) {
  const { getExamRoutine, fetchExamRoutine, updateExamRoutine, publishExamRoutine, getClassSubjects } = useRoutine();
  const [selectedClass,   setSelectedClass]   = useState(CLASS_OPTIONS[0]?.value || '');
  const [selectedSession, setSelectedSession] = useState(currentSessionId || null);
  const [selectedExam,    setSelectedExam]    = useState(null);
  const [exams,           setExams]           = useState([]);
  const [publishing,      setPublishing]      = useState(false);

  useEffect(() => { if (currentSessionId && !selectedSession) setSelectedSession(currentSessionId); }, [currentSessionId]);

  // Fetch exams for selected session
  useEffect(() => {
    if (!selectedSession) { setExams([]); setSelectedExam(null); return; }
    api.get(`/exams?session_id=${selectedSession}`)
      .then(res => {
        if (Array.isArray(res.data)) { setExams(res.data); if (res.data.length > 0 && !selectedExam) setSelectedExam(res.data[0].id); }
      }).catch(() => {});
  }, [selectedSession]);

  useEffect(() => {
    if (selectedClass && selectedSession) fetchExamRoutine(selectedClass, selectedSession, selectedExam, false);
  }, [selectedClass, selectedSession, selectedExam]);

  const data     = getExamRoutine(selectedClass, selectedSession, selectedExam);
  const subjects = getClassSubjects(selectedClass);

  const examColHeaderExtra = (col, _ci, setColField) => (
    <div className="rg-col-extras">
      <select className="rg-time-input" value={col.examColType || ''} onChange={e => setColField(col.id, 'examColType', e.target.value)} style={{ cursor: 'pointer' }}>
        <option value="">-- ধরন --</option>
        <option value="subject">বিষয়</option>
        <option value="day">বার</option>
      </select>
    </div>
  );

  const handlePublish = async () => {
    if (!selectedSession) return swal.error('সেশন নির্বাচন করুন');
    const examLabel = exams.find(e => e.id === selectedExam)?.name || 'সকল পরীক্ষা';
    const ok = await swal.confirm(`"${examLabel}" এর রুটিন প্রকাশ করবেন?`, 'সকল শ্রেণির এই পরীক্ষার রুটিন প্রকাশিত হবে এবং নোটিশ তৈরি হবে।');
    if (!ok) return;
    setPublishing(true);
    try {
      await publishExamRoutine(selectedSession, selectedExam);
      swal.success('পরীক্ষার রুটিন প্রকাশিত হয়েছে');
      fetchExamRoutine(selectedClass, selectedSession, selectedExam, false);
    } catch (e) { swal.error(e.message); }
    setPublishing(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <SessionSelector sessions={sessions} value={selectedSession} onChange={v => { setSelectedSession(v); setSelectedExam(null); }} />
          <ExamSelector exams={exams} value={selectedExam} onChange={setSelectedExam} />
        </div>
        <Button icon={<FiGlobe />} variant="success" onClick={handlePublish} disabled={publishing || !selectedSession}>
          {publishing ? 'প্রকাশ হচ্ছে...' : 'রুটিন প্রকাশ করুন'}
        </Button>
      </div>

      {/* Draft badge */}
      {!data.published && data.columns?.length > 0 && (
        <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 6, padding: '6px 12px', fontSize: '0.82rem', color: '#856404' }}>
          ⚠ এই রুটিনটি এখনো খসড়া অবস্থায় আছে। প্রকাশ করতে উপরের বোতাম ব্যবহার করুন।
        </div>
      )}

      {/* Class selector */}
      <div className="routine-class-select">
        {CLASS_OPTIONS.map(c => (
          <button key={c.value} className={`class-btn${selectedClass === c.value ? ' active' : ''}`} onClick={() => setSelectedClass(c.value)}>{c.label}</button>
        ))}
      </div>

      <SubjectBar selectedClass={selectedClass} />

      {!selectedSession ? (
        <p style={{ color: 'var(--text-muted)', padding: 24, textAlign: 'center' }}>সেশন নির্বাচন করুন।</p>
      ) : !selectedExam ? (
        <p style={{ color: 'var(--text-muted)', padding: 24, textAlign: 'center' }}>পরীক্ষা নির্বাচন করুন।</p>
      ) : (
        <ExamRoutineGrid
          key={`${selectedClass}|${selectedSession}|${selectedExam}`}
          data={data}
          onSave={(d) => updateExamRoutine(selectedClass, selectedSession, selectedExam, d)}
          colHeaderExtra={examColHeaderExtra}
          subjectOptions={subjects}
        />
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminRoutine() {
  const [tab, setTab] = useState('class');
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);

  useEffect(() => {
    api.get('/sessions')
      .then(res => {
        if (Array.isArray(res.data)) {
          setSessions(res.data);
          const cur = res.data.find(s => s.is_current);
          if (cur) setCurrentSessionId(cur.id);
        }
      }).catch(() => {});
  }, []);

  return (
    <div>
      <div className="routine-tabs">
        <button className={`routine-tab-btn${tab === 'class' ? ' active' : ''}`} onClick={() => setTab('class')}>ক্লাস রুটিন</button>
        <button className={`routine-tab-btn${tab === 'exam'  ? ' active' : ''}`} onClick={() => setTab('exam')}>পরীক্ষার রুটিন</button>
      </div>
      {tab === 'class'
        ? <ClassRoutineEditor  sessions={sessions} currentSessionId={currentSessionId} />
        : <ExamRoutineEditor   sessions={sessions} currentSessionId={currentSessionId} />
      }
    </div>
  );
}
