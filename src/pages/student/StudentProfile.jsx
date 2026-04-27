import { useEffect, useState } from 'react';
import api from '../../services/api';
import Badge from '../../components/Badge';

export default function StudentProfile() {
  const [student, setStudent] = useState(null);

  useEffect(() => {
    api.get('/students/me').then(res => setStudent(res.data)).catch(() => {});
  }, []);

  if (!student) return <p style={{ color: 'var(--text-muted)', padding: 32 }}>লোড হচ্ছে...</p>;

  const details = [
    ['শিক্ষার্থী আইডি', student.id],
    ['পূর্ণ নাম', student.name],
    ['শ্রেণি', student.class],
    ['রোল নম্বর', student.roll],
    ['সেকশন', student.section],
    ['অভিভাবকের নাম', student.guardian],
    ['মোবাইল নম্বর', student.phone],
    ['ঠিকানা', student.address],
    ['অবস্থা', student.status],
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 className="page-title">আমার প্রোফাইল</h1>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.2rem', fontWeight: 700 }}>
            {student.name?.[0]}
          </div>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--primary)' }}>{student.name}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{student.id}</p>
            <Badge variant="success">{student.status}</Badge>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {details.map(([key, val]) => (
            <div key={key} style={{ padding: '12px 16px', background: 'var(--bg)', borderRadius: 8 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>{key}</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)' }}>{val}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
