import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import swal from '../../utils/swal';
import Button from '../../components/Button';
import SelectBox from '../../components/SelectBox';
import Badge from '../../components/Badge';
import { useForm } from 'react-hook-form';
import './MarksEntry.css';
import { CLASS_OPTIONS } from '../../utils/constants';

export default function MarksEntry() {
  const { user } = useAuth();
  const isAdmin        = user?.role === 'admin';
  const isClassTeacher = user?.role === 'class_teacher';
  const isTeacher      = user?.role === 'teacher';

  const [students,      setStudents]      = useState([]);
  const [sessions,      setSessions]      = useState([]);
  const [exams,         setExams]         = useState([]);
  const [subjects,      setSubjects]      = useState([]); // allowed subjects for this user
  const [marks,         setMarks]         = useState({});
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [lockedClass,   setLockedClass]   = useState('');
  const [teacherName,   setTeacherName]   = useState('');
  const [sessionId,     setSessionId]     = useState(null);

  // Class teacher review state
  const [pendingMarks,  setPendingMarks]  = useState([]);
  const [submitting,    setSubmitting]    = useState(false);
  const [viewMode,      setViewMode]      = useState('entry'); // 'entry' | 'review'

  const { register, watch, setValue } = useForm();
  const selectedClass   = watch('class');
  const selectedExam    = watch('exam');
  const selectedSession = watch('session');

  // Load sessions + teacher info
  useEffect(() => {
    api.get('/sessions').then(res => {
      const data = Array.isArray(res.data) ? res.data : [];
      setSessions(data);
      const cur = data.find(s => s.is_current == 1);
      if (cur) { setValue('session', cur.id); setSessionId(cur.id); }
    }).catch(() => {});

    if (!isAdmin) {
      api.get('/teachers/me').then(res => {
        const cls  = res.data?.class || '';
        const name = res.data?.name  || '';
        setTeacherName(name);
        if (isClassTeacher || isTeacher) {
          setLockedClass(cls);
          if (cls) setValue('class', cls);
        }
      }).catch(() => {});
    }
  }, [user]);

  // Load exams when session changes
  useEffect(() => {
    if (!selectedSession) return;
    setSessionId(selectedSession);
    api.get(`/exams?session_id=${selectedSession}`).then(res => {
      let all = Array.isArray(res.data) ? res.data : [];
      if (lockedClass) all = all.filter(e => e.class_name === lockedClass || e.class_name === 'সকল শ্রেণি');
      setExams(all);
    }).catch(() => {});
  }, [selectedSession, lockedClass]);

  // Load students + subjects when class changes
  useEffect(() => {
    if (!selectedClass) return;
    api.get(`/students?class=${encodeURIComponent(selectedClass)}&limit=200`)
      .then(res => setStudents(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, [selectedClass]);

  // Load allowed subjects based on role
  useEffect(() => {
    if (!selectedClass || !sessionId) return;

    if (isAdmin || isClassTeacher) {
      // Admin and class teacher see all subjects for the class
      api.get(`/class-subjects?class=${encodeURIComponent(selectedClass)}`)
        .then(res => setSubjects(Array.isArray(res.data) ? res.data.map(s => s.subject) : []))
        .catch(() => {});
    } else if (isTeacher && teacherName) {
      // Regular teacher: only subjects they teach in the class routine
      api.get(`/class-routine/teacher-subjects?class=${encodeURIComponent(selectedClass)}&teacher=${encodeURIComponent(teacherName)}&session_id=${sessionId}`)
        .then(res => setSubjects(Array.isArray(res.data) ? res.data : []))
        .catch(() => {});
    }
  }, [selectedClass, sessionId, teacherName]);

  // Reset marks when exam changes
  useEffect(() => {
    setMarks({});
    setPendingMarks([]);
  }, [selectedExam]);

  // Load pending/submitted marks to pre-fill the table:
  // - class teacher: their locked class
  // - admin: whatever class+exam they select
  useEffect(() => {
    const cls = isClassTeacher ? lockedClass : selectedClass;
    if (!selectedExam || !cls) return;
    if (!isClassTeacher && !isAdmin) return;

    api.get(`/results/pending?exam_id=${selectedExam}&class=${encodeURIComponent(cls)}`)
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : [];
        setPendingMarks(data);
        // Pre-fill entry table with existing marks
        const prefilled = {};
        data.forEach(r => {
          prefilled[`${r.student_id}-${r.subject_name}`] = String(r.obtained);
        });
        setMarks(prefilled);
      })
      .catch(() => {});
  }, [selectedExam, selectedClass, lockedClass, isClassTeacher, isAdmin]);

  const handleMark = (studentId, subject, value) =>
    setMarks(prev => ({ ...prev, [`${studentId}-${subject}`]: value }));

  const handleSave = async () => {
    if (!selectedExam) { await swal.error('পরীক্ষা নির্বাচন করুন'); return; }
    if (subjects.length === 0) { await swal.error('কোনো বিষয় পাওয়া যায়নি'); return; }
    setSaving(true);
    const bulk = [];
    students.forEach(s => {
      subjects.forEach(sub => {
        const val = marks[`${s.id}-${sub}`];
        if (val !== undefined && val !== '') {
          bulk.push({ student_id: s.id, exam_id: selectedExam, subject_name: sub, obtained: Number(val) });
        }
      });
    });
    if (bulk.length === 0) { await swal.error('কোনো নম্বর দেওয়া হয়নি'); setSaving(false); return; }
    try {
      await api.post('/results/bulk', { results: bulk });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      if (isTeacher) {
        swal.success('নম্বর সংরক্ষিত হয়েছে। শ্রেণি শিক্ষক পর্যালোচনা করে জমা দেবেন।');
      } else {
        swal.success('নম্বর সংরক্ষিত হয়েছে');
        if (isClassTeacher) setViewMode('review');
      }
    } catch (e) { await swal.error(e.message); }
    finally { setSaving(false); }
  };

  const handleSubmitToAdmin = async () => {
    if (!selectedExam || !lockedClass) return;
    const ok = await swal.confirm('নম্বর জমা দেবেন?', 'এই শ্রেণির সকল নম্বর প্রশাসকের কাছে জমা দেওয়া হবে।');
    if (!ok) return;
    setSubmitting(true);
    try {
      await api.post('/results/submit', { exam_id: selectedExam, class: lockedClass });
      swal.success('নম্বর প্রশাসকের কাছে জমা দেওয়া হয়েছে');
      setViewMode('entry');
    } catch (e) { await swal.error(e.message); }
    finally { setSubmitting(false); }
  };

  const examOptions    = exams.map(e => ({ value: e.id, label: e.name }));
  const sessionOptions = sessions.map(s => ({ value: s.id, label: `${s.name} (${s.year})${s.is_current == 1 ? ' — বর্তমান' : ''}` }));

  // Group pending marks by student for review table
  const pendingByStudent = {};
  pendingMarks.forEach(r => {
    if (!pendingByStudent[r.student_id]) pendingByStudent[r.student_id] = { name: r.student_name, roll: r.roll, subjects: {} };
    pendingByStudent[r.student_id].subjects[r.subject_name] = { obtained: r.obtained, grade: r.grade, status: r.status };
  });
  const pendingSubjects = [...new Set(pendingMarks.map(r => r.subject_name))].sort();
  // Track which subjects were entered by teachers (have pending/submitted records)
  const teacherEnteredSubjects = new Set(pendingMarks.map(r => r.subject_name));
  const submittedCount = pendingMarks.filter(r => r.status === 'submitted').length;
  const hasSubmitted = submittedCount > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">নম্বর প্রদান</h1>
          <p className="page-subtitle">
            {isTeacher && teacherName && `শিক্ষক: ${teacherName} — শুধুমাত্র নিজের বিষয়ের নম্বর দিন`}
            {isClassTeacher && `শ্রেণি শিক্ষক: ${lockedClass}`}
            {isAdmin && 'শিক্ষার্থীদের পরীক্ষার নম্বর লিখুন'}
          </p>
        </div>
        {isClassTeacher && selectedExam && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setViewMode('entry')}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid var(--border)', background: viewMode === 'entry' ? 'var(--primary)' : 'var(--surface)', color: viewMode === 'entry' ? '#fff' : 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' }}>
              নম্বর এন্ট্রি
            </button>
            <button onClick={() => setViewMode('review')}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid var(--border)', background: viewMode === 'review' ? 'var(--primary)' : 'var(--surface)', color: viewMode === 'review' ? '#fff' : 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' }}>
              পর্যালোচনা ও জমা
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="marks-filters card">
        <div className="marks-filter-grid">
          <SelectBox label="সেশন" name="session" options={sessionOptions} register={register} />
          {lockedClass ? (
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>শ্রেণি</label>
              <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, border: '1.5px solid var(--border)', fontWeight: 600, color: 'var(--primary)' }}>{lockedClass}</div>
            </div>
          ) : (
            <SelectBox label="শ্রেণি" name="class" options={CLASS_OPTIONS} register={register} />
          )}
          <SelectBox label="পরীক্ষা" name="exam" options={examOptions} register={register} />
        </div>
      </div>

      {/* Teacher subject info */}
      {isTeacher && subjects.length > 0 && (
        <div style={{ background: '#e8f5ee', border: '1px solid var(--primary)', borderRadius: 8, padding: '10px 16px', fontSize: '0.85rem', color: 'var(--primary)' }}>
          আপনি যে বিষয়গুলোর নম্বর দিতে পারবেন: <strong>{subjects.join(', ')}</strong>
        </div>
      )}
      {isTeacher && subjects.length === 0 && selectedClass && sessionId && teacherName && (
        <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: '10px 16px', fontSize: '0.85rem', color: '#856404' }}>
          ⚠ এই শ্রেণির রুটিনে আপনার কোনো বিষয় নির্ধারিত নেই। প্রথমে ক্লাস রুটিনে আপনার নাম যোগ করুন।
        </div>
      )}

      {saved && <div className="marks-saved">✓ নম্বর সফলভাবে সংরক্ষিত হয়েছে</div>}

      {/* Pre-fill info banner */}
      {isAdmin && hasSubmitted && (
        <div style={{ background: '#e8f5ee', border: '1px solid var(--primary)', borderRadius: 8, padding: '10px 16px', fontSize: '0.85rem', color: 'var(--primary)' }}>
          ✓ শ্রেণি শিক্ষক কর্তৃক জমাকৃত নম্বর স্বয়ংক্রিয়ভাবে পূরণ হয়েছে। প্রয়োজনে পরিবর্তন করে সংরক্ষণ করুন।
        </div>
      )}
      {isAdmin && pendingMarks.length > 0 && !hasSubmitted && (
        <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: '10px 16px', fontSize: '0.85rem', color: '#856404' }}>
          ⚠ শিক্ষকদের দেওয়া নম্বর এখনো শ্রেণি শিক্ষক জমা দেননি (খসড়া অবস্থায় আছে)।
        </div>
      )}

      {/* ── Entry mode ── */}
      {viewMode === 'entry' && students.length > 0 && subjects.length > 0 && (
        <div className="card marks-table-wrapper">
          {(isClassTeacher || isAdmin) && pendingMarks.length > 0 && (
            <div style={{ padding: '8px 16px', background: '#e8f5ee', borderBottom: '1px solid var(--border)', fontSize: '0.82rem', color: 'var(--primary)' }}>
              ✓ সবুজ ঘরগুলো শিক্ষকদের দেওয়া নম্বর। প্রয়োজনে পরিবর্তন করতে পারবেন।
            </div>
          )}
          <table className="marks-table">
            <thead>
              <tr>
                <th>রোল</th><th>নাম</th>
                {subjects.map(s => {
                  const hasPending = (isClassTeacher || isAdmin) && teacherEnteredSubjects.has(s);
                  return (
                    <th key={s} style={hasPending ? { background: '#d1fae5', color: '#065f46' } : {}}>
                      {s}
                      {hasPending && <div style={{ fontSize: '0.6rem', fontWeight: 400, opacity: 0.8 }}>শিক্ষক প্রদত্ত</div>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {students.map(student => (
                <tr key={student.id}>
                  <td>{student.roll}</td>
                  <td>{student.name}</td>
                  {subjects.map(subject => {
                    const key = `${student.id}-${subject}`;
                    const val = marks[key] || '';
                    const isFromTeacher = (isClassTeacher || isAdmin) && pendingMarks.some(
                      r => r.student_id === student.id && r.subject_name === subject
                    );
                    return (
                      <td key={subject} style={isFromTeacher ? { background: '#f0fdf4' } : {}}>
                        <input type="number" min="0" max="100" className="marks-input"
                          value={val}
                          onChange={e => handleMark(student.id, subject, e.target.value)}
                          placeholder="০"
                          style={isFromTeacher ? { borderColor: '#86efac', background: '#f0fdf4' } : {}} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewMode === 'entry' && students.length === 0 && selectedClass && (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>এই শ্রেণিতে কোনো শিক্ষার্থী নেই।</p>
      )}

      {viewMode === 'entry' && students.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={handleSave} size="lg" disabled={saving}>
            {saving ? 'সংরক্ষণ হচ্ছে...' : isAdmin ? 'নম্বর সংরক্ষণ করুন' : 'নম্বর সংরক্ষণ করুন (খসড়া)'}
          </Button>
        </div>
      )}

      {/* ── Class teacher review mode ── */}
      {viewMode === 'review' && isClassTeacher && (
        <>
          <div style={{ background: '#e8f5ee', border: '1px solid var(--primary)', borderRadius: 8, padding: '10px 16px', fontSize: '0.85rem', color: 'var(--primary)' }}>
            শিক্ষকদের দেওয়া নম্বর পর্যালোচনা করুন। সবুজ = শিক্ষক প্রদত্ত। লাল = এখনো দেওয়া হয়নি। সঠিক মনে হলে প্রশাসকের কাছে জমা দিন।
          </div>

          {students.length > 0 && subjects.length > 0 ? (
            <div className="card marks-table-wrapper">
              <table className="marks-table">
                <thead>
                  <tr>
                    <th>রোল</th><th>নাম</th>
                    {subjects.map(s => (
                      <th key={s} style={teacherEnteredSubjects.has(s) ? { background: '#d1fae5', color: '#065f46' } : { background: '#fee2e2', color: '#991b1b' }}>
                        {s}
                        <div style={{ fontSize: '0.6rem', fontWeight: 400, marginTop: 2 }}>
                          {teacherEnteredSubjects.has(s) ? '✓ প্রদত্ত' : '✗ বাকি'}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map(student => (
                    <tr key={student.id}>
                      <td>{student.roll}</td>
                      <td>{student.name}</td>
                      {subjects.map(sub => {
                        const pending = pendingByStudent[student.id]?.subjects[sub];
                        return (
                          <td key={sub} style={{ textAlign: 'center', background: pending ? '#f0fdf4' : '#fff5f5' }}>
                            {pending
                              ? <span style={{ fontWeight: 600 }}>{pending.obtained} <small style={{ color: 'var(--text-muted)' }}>({pending.grade})</small></span>
                              : <span style={{ color: '#f87171', fontSize: '0.8rem' }}>—</span>
                            }
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>পরীক্ষা নির্বাচন করুন।</p>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {pendingMarks.length > 0
                ? `${teacherEnteredSubjects.size}টি বিষয়ের নম্বর পাওয়া গেছে, ${subjects.length - teacherEnteredSubjects.size}টি বাকি`
                : 'কোনো নম্বর এখনো জমা পড়েনি'}
            </div>
            <Button variant="success" onClick={handleSubmitToAdmin} disabled={submitting || pendingMarks.length === 0}>
              {submitting ? 'জমা হচ্ছে...' : 'প্রশাসকের কাছে জমা দিন'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
