import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRoutine } from '../../context/RoutineContext';
import { CLASS_OPTIONS } from '../../utils/constants';
import api from '../../services/api';
import Button from '../../components/Button';
import { FiPlus, FiTrash2, FiSave, FiCheck, FiGlobe } from 'react-icons/fi';
import swal from '../../utils/swal';
import '../admin/AdminRoutine.css';

const BANGLA_DAYS = ['শনিবার','রবিবার','সোমবার','মঙ্গলবার','বুধবার','বৃহস্পতিবার','শুক্রবার'];

// ── Read-only routine table ───────────────────────────────────────────────────
function RoutineReadOnly({ data, type }) {
  const { columns, rows } = data;
  if (!columns?.length || !rows?.length) {
    return <p style={{ color: 'var(--text-muted)', padding: 24, textAlign: 'center' }}>এই শ্রেণির রুটিন এখনো প্রকাশিত হয়নি।</p>;
  }
  return (
    <div style={{ overflowX: 'auto', borderRadius: 10, border: '1.5px solid var(--border)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr style={{ background: 'var(--primary)', color: '#fff' }}>
            {type === 'class' && <th style={{ padding: '10px 14px' }}>দিন</th>}
            {columns.map(col => (
              <th key={col.id} style={{ padding: '10px 14px', fontWeight: 600 }}>
                {col.label}
                {col.time && <div style={{ fontSize: '0.68rem', opacity: 0.8, marginTop: 2 }}>{col.time}</div>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={row.id} style={{ background: ri % 2 === 0 ? '#fff' : 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
              {type === 'class' && <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--primary)', background: '#f0faf4' }}>{row.day}</td>}
              {columns.map(col => {
                const cell = row.cells?.[col.id];
                const subject = typeof cell === 'string' ? cell : (cell?.subject || cell?.value || '');
                const teacher = typeof cell === 'object' ? cell?.teacher : '';
                return (
                  <td key={col.id} style={{ padding: '10px 14px', textAlign: 'center' }}>
                    {col.leisure ? <span style={{ color: '#ccc' }}>বিরতি</span> : subject ? (
                      <div>
                        <div style={{ fontWeight: 600 }}>{subject}</div>
                        {teacher && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{teacher}</div>}
                      </div>
                    ) : <span style={{ color: '#ccc' }}>—</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Editable grid (class teacher only) ───────────────────────────────────────
const PERIOD_LABELS = ['১ম','২য়','৩য়','৪র্থ','৫ম','৬ষ্ঠ','৭ম','৮ম','৯ম','১০ম'];

function EditableGrid({ data, onSave, colHeaderExtra, rowHeaderKey = 'day', newColDefaults = {}, subjectOptions = [], teacherOptions = [], busyTeachers = {} }) {
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
  const setColField = (id, f, v) => sync(d => { const c = d.columns.find(c => c.id === id); if (c) c[f] = v; });
  const addRow = () => sync(d => d.rows.push({ id: `row_${Date.now()}`, cells: {}, [rowHeaderKey]: '' }));
  const delRow = (id) => sync(d => { d.rows = d.rows.filter(r => r.id !== id); });
  const setRowHeader = (id, v) => sync(d => { const r = d.rows.find(r => r.id === id); if (r) r[rowHeaderKey] = v; });
  const setCell = (rowId, colId, f, v) => sync(d => {
    const r = d.rows.find(r => r.id === rowId);
    if (r) {
      if (!r.cells[colId]) r.cells[colId] = {};
      if (typeof r.cells[colId] === 'string') r.cells[colId] = { subject: r.cells[colId], teacher: '' };
      r.cells[colId][f] = v;
    }
  });
  const setCellVal = (rowId, colId, v) => sync(d => { const r = d.rows.find(r => r.id === rowId); if (r) r.cells[colId] = { value: v }; });

  const getCellVal = (row, colId) => {
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
            {/* Period number row */}
            <tr>
              <th className="rg-corner"></th>
              {draft.columns.map((col, ci) => {
                const periodNum = draft.columns.slice(0, ci + 1).filter(c => !c.leisure).length;
                return (
                  <th key={col.id} style={{
                    background: col.leisure ? '#fff8e1' : 'var(--primary)',
                    color: col.leisure ? '#b8860b' : '#fff',
                    padding: '4px 8px', fontSize: '0.72rem', fontWeight: 700, textAlign: 'center',
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
                  <button className="rg-del-btn" onClick={() => delCol(col.id)}><FiTrash2 /></button>
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
                    <select className="rg-row-input" value={row.day || ''} onChange={e => setRowHeader(row.id, e.target.value)}>
                      <option value="">-- বার --</option>
                      {BANGLA_DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  ) : (
                    <input className="rg-row-input" value={row[rowHeaderKey] || ''} onChange={e => setRowHeader(row.id, e.target.value)} placeholder="সারি" />
                  )}
                  <button className="rg-del-btn" onClick={() => delRow(row.id)}><FiTrash2 /></button>
                </td>
                {draft.columns.map(col => {
                  if (rowHeaderKey === 'day') {
                    // class routine cell
                    const cellData = row.cells[col.id] || {};
                    const cv = typeof cellData === 'string' ? { subject: cellData, teacher: '' } : cellData;
                    const day = row.day || '';
                    const busySet = busyTeachers[col.id]?.[day] || new Set();
                    const availableTeachers = teacherOptions.filter(t => !busySet.has(t) || t === cv.teacher);
                    return (
                      <td key={col.id} className={`rg-cell${col.leisure ? ' rg-leisure' : ''}`}>
                        {col.leisure ? <span className="rg-leisure-label">বিরতি</span> : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {subjectOptions.length > 0 ? (
                              <select className="rg-cell-select" value={cv.subject || ''} onChange={e => setCell(row.id, col.id, 'subject', e.target.value)}>
                                <option value="">-- বিষয় --</option>
                                {subjectOptions.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            ) : (
                              <input className="rg-cell-input" value={cv.subject || ''} onChange={e => setCell(row.id, col.id, 'subject', e.target.value)} placeholder="বিষয়" />
                            )}
                            {teacherOptions.length > 0 && (
                              <select className="rg-cell-select" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }} value={cv.teacher || ''} onChange={e => setCell(row.id, col.id, 'teacher', e.target.value)}>
                                <option value="">-- শিক্ষক --</option>
                                {availableTeachers.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  } else {
                    // exam routine cell
                    const val = getCellVal(row, col.id);
                    return (
                      <td key={col.id} className="rg-cell">
                        {col.examColType === 'subject' ? (
                          <select className="rg-cell-select" value={val} onChange={e => setCellVal(row.id, col.id, e.target.value)}>
                            <option value="">-- বিষয় --</option>
                            {subjectOptions.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        ) : col.examColType === 'day' ? (
                          <select className="rg-cell-select" value={val} onChange={e => setCellVal(row.id, col.id, e.target.value)}>
                            <option value="">-- বার --</option>
                            {BANGLA_DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        ) : (
                          <input className="rg-cell-input" value={val} onChange={e => setCellVal(row.id, col.id, e.target.value)} placeholder="..." />
                        )}
                      </td>
                    );
                  }
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

// ── Main ──────────────────────────────────────────────────────────────────────
export default function TeacherRoutine() {
  const { user } = useAuth();
  const {
    getClassRoutine, fetchClassRoutine, updateClassRoutine, publishClassRoutine,
    getExamRoutine,  fetchExamRoutine,  updateExamRoutine,  publishExamRoutine,
    getClassSubjects,
  } = useRoutine();

  const isClassTeacher = user?.role === 'class_teacher';

  const [assignedClass, setAssignedClass] = useState(''); // teacher's own class (editable)
  const [selectedClass, setSelectedClass] = useState(CLASS_OPTIONS[0]?.value || ''); // currently viewing
  const [sessions,      setSessions]      = useState([]);
  const [sessionId,     setSessionId]     = useState(null);
  const [exams,         setExams]         = useState([]);
  const [examId,        setExamId]        = useState(null);
  const [tab,           setTab]           = useState('class');
  const [teachers,      setTeachers]      = useState([]);
  const [publishing,    setPublishing]    = useState(false);

  // Load teacher's assigned class
  useEffect(() => {
    api.get('/teachers/me')
      .then(res => {
        const cls = res.data?.class || '';
        setAssignedClass(cls);
        if (cls) setSelectedClass(cls); // default view to own class
      })
      .catch(() => {});
  }, []);

  // Load sessions
  useEffect(() => {
    api.pub('/sessions/all')
      .then(res => {
        if (Array.isArray(res.data)) {
          setSessions(res.data);
          const cur = res.data.find(s => s.is_current);
          if (cur) setSessionId(cur.id);
        }
      }).catch(() => {});
  }, []);

  // Load exams when session changes
  useEffect(() => {
    if (!sessionId) return;
    api.pub(`/exams/all?session_id=${sessionId}`)
      .then(res => {
        if (Array.isArray(res.data)) {
          setExams(res.data);
          setExamId(res.data[0]?.id || null);
        }
      }).catch(() => {});
  }, [sessionId]);

  // Load teachers list for class teacher editing
  useEffect(() => {
    if (!isClassTeacher) return;
    api.get('/teachers')
      .then(res => {
        if (Array.isArray(res.data))
          setTeachers(res.data.filter(t => t.status === 'সক্রিয়' && !t.is_user_only).map(t => t.name));
      }).catch(() => {});
  }, [isClassTeacher]);

  // Fetch routine for currently selected class
  // class teacher viewing their own class → fetch draft too (pubOnly=false)
  // everyone else → published only
  useEffect(() => {
    if (!selectedClass || !sessionId) return;
    const isOwnClass = isClassTeacher && selectedClass === assignedClass;
    if (tab === 'class') {
      fetchClassRoutine(selectedClass, sessionId, !isOwnClass);
    } else {
      fetchExamRoutine(selectedClass, sessionId, examId, !isOwnClass);
    }
  }, [selectedClass, sessionId, examId, tab, assignedClass]);

  const classData = getClassRoutine(selectedClass, sessionId);
  const examData  = getExamRoutine(selectedClass, sessionId, examId);
  const subjects  = getClassSubjects(selectedClass);

  // Is the class teacher viewing their own editable class?
  const isEditableView = isClassTeacher && selectedClass === assignedClass;

  const handlePublishClass = async () => {
    const ok = await swal.confirm('ক্লাস রুটিন প্রকাশ করবেন?', `${assignedClass} শ্রেণির ক্লাস রুটিন প্রকাশিত হবে।`);
    if (!ok) return;
    setPublishing(true);
    try {
      await publishClassRoutine(sessionId);
      swal.success('ক্লাস রুটিন প্রকাশিত হয়েছে');
      fetchClassRoutine(assignedClass, sessionId, false);
    } catch (e) { swal.error(e.message); }
    setPublishing(false);
  };

  const handlePublishExam = async () => {
    const examName = exams.find(e => e.id === examId)?.name || 'পরীক্ষার';
    const ok = await swal.confirm(`"${examName}" রুটিন প্রকাশ করবেন?`, `${assignedClass} শ্রেণির এই পরীক্ষার রুটিন প্রকাশিত হবে।`);
    if (!ok) return;
    setPublishing(true);
    try {
      await publishExamRoutine(sessionId, examId);
      swal.success('পরীক্ষার রুটিন প্রকাশিত হয়েছে');
      fetchExamRoutine(assignedClass, sessionId, examId, false);
    } catch (e) { swal.error(e.message); }
    setPublishing(false);
  };

  const classColHeaderExtra = (col, _ci, setColField) => (
    <div className="rg-col-extras">
      <input className="rg-time-input" value={col.time || ''} onChange={e => setColField(col.id, 'time', e.target.value)} placeholder="সময়" />
      <label className="rg-leisure-toggle">
        <input type="checkbox" checked={!!col.leisure} onChange={e => setColField(col.id, 'leisure', e.target.checked)} />
        <span>বিরতি</span>
      </label>
    </div>
  );

  const examColHeaderExtra = (col, _ci, setColField) => (
    <div className="rg-col-extras">
      <select className="rg-time-input" value={col.examColType || ''} onChange={e => setColField(col.id, 'examColType', e.target.value)} style={{ cursor: 'pointer' }}>
        <option value="">-- ধরন --</option>
        <option value="subject">বিষয়</option>
        <option value="day">বার</option>
      </select>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title">রুটিন</h1>
        <p className="page-subtitle">
          {isClassTeacher ? `শ্রেণি শিক্ষক — ${assignedClass}` : 'শিক্ষক'}
        </p>
      </div>

      {/* Tabs */}
      <div className="routine-tabs" style={{ marginBottom: 12 }}>
        <button className={`routine-tab-btn${tab === 'class' ? ' active' : ''}`} onClick={() => setTab('class')}>ক্লাস রুটিন</button>
        <button className={`routine-tab-btn${tab === 'exam'  ? ' active' : ''}`} onClick={() => setTab('exam')}>পরীক্ষার রুটিন</button>
      </div>

      {/* Session + exam selectors */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {sessions.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>সেশন:</span>
              <select value={sessionId || ''} onChange={e => setSessionId(e.target.value ? Number(e.target.value) : null)}
                style={{ padding: '5px 10px', borderRadius: 7, border: '1.5px solid var(--border)', fontSize: '0.85rem', fontFamily: 'inherit', cursor: 'pointer' }}>
                {sessions.map(s => <option key={s.id} value={s.id}>{s.name}{s.is_current ? ' (চলমান)' : ''}</option>)}
              </select>
            </div>
          )}
          {tab === 'exam' && exams.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>পরীক্ষা:</span>
              <select value={examId || ''} onChange={e => setExamId(e.target.value || null)}
                style={{ padding: '5px 10px', borderRadius: 7, border: '1.5px solid var(--border)', fontSize: '0.85rem', fontFamily: 'inherit', cursor: 'pointer' }}>
                {exams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Publish button — only when class teacher is viewing their own class */}
        {isEditableView && tab === 'class' && (
          <Button icon={<FiGlobe />} variant="success" onClick={handlePublishClass} disabled={publishing}>
            {publishing ? 'প্রকাশ হচ্ছে...' : 'ক্লাস রুটিন প্রকাশ করুন'}
          </Button>
        )}
        {isEditableView && tab === 'exam' && (
          <Button icon={<FiGlobe />} variant="success" onClick={handlePublishExam} disabled={publishing || !examId}>
            {publishing ? 'প্রকাশ হচ্ছে...' : 'পরীক্ষার রুটিন প্রকাশ করুন'}
          </Button>
        )}
      </div>

      {/* Class selector — all classes, for all teachers */}
      <div className="routine-class-select" style={{ marginBottom: 12 }}>
        {CLASS_OPTIONS.map(c => (
          <button
            key={c.value}
            className={`class-btn${selectedClass === c.value ? ' active' : ''}${isClassTeacher && c.value === assignedClass ? ' class-btn-own' : ''}`}
            onClick={() => setSelectedClass(c.value)}
            title={isClassTeacher && c.value === assignedClass ? 'আপনার শ্রেণি' : ''}
          >
            {c.label}
            {isClassTeacher && c.value === assignedClass && <span style={{ marginLeft: 4, fontSize: '0.65rem', opacity: 0.85 }}>✎</span>}
          </button>
        ))}
      </div>

      {/* Draft warning — only for class teacher on their own class */}
      {isEditableView && tab === 'class' && !classData.published && classData.columns?.length > 0 && (
        <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 6, padding: '6px 12px', fontSize: '0.82rem', color: '#856404', marginBottom: 8 }}>
          ⚠ এই রুটিনটি এখনো খসড়া। প্রকাশ করতে উপরের বোতাম ব্যবহার করুন।
        </div>
      )}
      {isEditableView && tab === 'exam' && !examData.published && examData.columns?.length > 0 && (
        <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 6, padding: '6px 12px', fontSize: '0.82rem', color: '#856404', marginBottom: 8 }}>
          ⚠ এই রুটিনটি এখনো খসড়া। প্রকাশ করতে উপরের বোতাম ব্যবহার করুন।
        </div>
      )}

      {/* Content: editable for own class (class teacher), read-only for everything else */}
      {tab === 'class' ? (
        isEditableView ? (
          <EditableGrid
            key={`class|${selectedClass}|${sessionId}`}
            data={classData}
            onSave={d => updateClassRoutine(selectedClass, sessionId, d)}
            colHeaderExtra={classColHeaderExtra}
            rowHeaderKey="day"
            newColDefaults={{ time: '', leisure: false }}
            subjectOptions={subjects}
            teacherOptions={teachers}
          />
        ) : (
          <RoutineReadOnly data={classData} type="class" />
        )
      ) : (
        isEditableView ? (
          <EditableGrid
            key={`exam|${selectedClass}|${sessionId}|${examId}`}
            data={examData}
            onSave={d => updateExamRoutine(selectedClass, sessionId, examId, d)}
            colHeaderExtra={examColHeaderExtra}
            rowHeaderKey="serial"
            subjectOptions={subjects}
          />
        ) : (
          <RoutineReadOnly data={examData} type="exam" />
        )
      )}
    </div>
  );
}
