import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import Table from '../../components/Table';
import Badge from '../../components/Badge';

export default function TeacherStudents() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [assignedClass, setAssignedClass] = useState('');

  useEffect(() => {
    if (user?.role === 'class_teacher') {
      // Fetch teacher profile to get assigned class
      api.get('/teachers/me').then(res => {
        const cls = res.data?.class || '';
        setAssignedClass(cls);
        const url = cls
          ? `/students?class=${encodeURIComponent(cls)}&limit=200`
          : '/students?limit=200';
        return api.get(url);
      }).then(res => setStudents(Array.isArray(res.data) ? res.data : [])).catch(() => {});
    } else {
      api.get('/students?limit=200').then(res => setStudents(Array.isArray(res.data) ? res.data : [])).catch(() => {});
    }
  }, [user]);

  const columns = [
    { header: 'রোল', key: 'roll' },
    { header: 'নাম', key: 'name' },
    { header: 'আইডি', key: 'id' },
    { header: 'শ্রেণি', key: 'class' },
    { header: 'অভিভাবক', key: 'guardian' },
    { header: 'অবস্থা', render: r => <Badge variant="success">{r.status}</Badge> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 className="page-title">শিক্ষার্থী তালিকা</h1>
        <p className="page-subtitle">
          {assignedClass ? `${assignedClass} — ` : ''}মোট {students.length} জন শিক্ষার্থী
        </p>
      </div>
      <div className="card"><Table columns={columns} data={students} /></div>
    </div>
  );
}
