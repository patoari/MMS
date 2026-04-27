import { useState, useEffect } from 'react';
import api from '../../services/api';
import Button from '../../components/Button';
import { FiPlus, FiTrash2, FiUser } from 'react-icons/fi';
import { CLASS_OPTIONS } from '../../utils/constants';
import swal from '../../utils/swal';

export default function SubjectManager() {
  const [allSubjects, setAllSubjects] = useState([]);
  const [teachers, setTeachers]       = useState([]);
  const [selectedClass, setSelectedClass] = useState(CLASS_OPTIONS[0]?.value || '');
  const [newSubject, setNewSubject]   = useState('');
  const [loading, setLoading]         = useState(false);
  const [assigningId, setAssigningId] = useState(null); // subject id being assigned

  const fetchSubjects = () =>
    api.get('/class-subjects').then(res => setAllSubjects(Array.isArray(res.data) ? res.data : [])).catch(() => {});

  useEffect(() => {
    fetchSubjects();
    api.get('/teachers').then(res => setTeachers(Array.isArray(res.data) ? res.data : [])).catch(() => {});
  }, []);

  const classSubjects = allSubjects.filter(s => s.class_name === selectedClass);

  const handleAdd = async () => {
    if (!newSubject.trim()) return;
    setLoading(true);
    try {
      await api.post('/class-subjects', { class: selectedClass, subject: newSubject.trim() });
      setNewSubject('');
      swal.success('বিষয় যোগ করা হয়েছে');
      fetchSubjects();
    } catch (e) { await swal.error(e.message); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    const ok = await swal.confirm('বিষয় মুছবেন?', 'এই বিষয়টি স্থায়ীভাবে মুছে যাবে।');
    if (!ok) return;
    await api.delete(`/class-subjects/${id}`);
    swal.success('বিষয় মুছে ফেলা হয়েছে');
    fetchSubjects();
  };

  const handleTeacherChange = async (subjectId, teacherId) => {
    setAssigningId(subjectId);
    try {
      const res = await api.put(`/class-subjects/${subjectId}/teacher`, { teacher_id: teacherId || null });
      const updated = res.data ?? res;
      setAllSubjects(prev => prev.map(s => s.id === subjectId ? { ...s, ...updated } : s));
    } catch (e) { await swal.error(e.message); }
    finally { setAssigningId(null); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 className="page-title">বিষয় ব্যবস্থাপনা</h1>
        <p className="page-subtitle">প্রতিটি শ্রেণির জন্য বিষয় ও শিক্ষক নির্ধারণ করুন</p>
      </div>

      {/* Class tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {CLASS_OPTIONS.map(c => (
          <button key={c.value} onClick={() => setSelectedClass(c.value)}
            style={{
              padding: '7px 16px', borderRadius: 8, border: '1.5px solid var(--border)',
              background: selectedClass === c.value ? 'var(--primary)' : '#fff',
              color: selectedClass === c.value ? '#fff' : 'var(--text)',
              fontFamily: 'Hind Siliguri, sans-serif', cursor: 'pointer', fontWeight: 500,
            }}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="card">
        <h3 style={{ color: 'var(--primary)', fontWeight: 700, marginBottom: 16 }}>
          {selectedClass} — বিষয় তালিকা
        </h3>

        {/* Add new subject */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <input
            type="text"
            className="input-field"
            placeholder="নতুন বিষয়ের নাম লিখুন..."
            value={newSubject}
            onChange={e => setNewSubject(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            style={{ flex: 1 }}
          />
          <Button icon={<FiPlus />} onClick={handleAdd} disabled={loading}>যোগ করুন</Button>
        </div>

        {/* Subject list */}
        {classSubjects.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>
            এই শ্রেণিতে কোনো বিষয় যোগ করা হয়নি।
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {classSubjects.map(s => (
              <div key={s.id} style={{
                background: 'var(--bg)', borderRadius: 10,
                border: '1px solid var(--border)', overflow: 'hidden',
              }}>
                {/* Subject name + delete */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)' }}>{s.subject}</span>
                  <button onClick={() => handleDelete(s.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4 }}>
                    <FiTrash2 size={14} />
                  </button>
                </div>

                {/* Teacher assignment */}
                <div style={{ padding: '8px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <FiUser size={12} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>শিক্ষক</span>
                  </div>
                  {s.teacher_name ? (
                    <div style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--primary)', marginBottom: 4 }}>
                      {s.teacher_name}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4, fontStyle: 'italic' }}>
                      নির্ধারিত নেই
                    </div>
                  )}
                  <select
                    value={s.teacher_id || ''}
                    disabled={assigningId === s.id}
                    onChange={e => handleTeacherChange(s.id, e.target.value)}
                    style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1.5px solid var(--border)', fontFamily: 'inherit', fontSize: '0.8rem', background: 'var(--card-bg)', cursor: 'pointer' }}
                  >
                    <option value="">— শিক্ষক নির্বাচন করুন —</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
