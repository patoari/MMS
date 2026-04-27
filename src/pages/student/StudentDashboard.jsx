import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import Badge from '../../components/Badge';
import Card from '../../components/Card';
import AdmitCard from '../../components/AdmitCard';
import { FiUser, FiAward, FiDollarSign, FiFileText } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { useIslamicGreeting } from '../../hooks/useIslamicGreeting';
import { formatDate } from '../../utils/dateFormat';

export default function StudentDashboard() {
  useIslamicGreeting();
  const { user } = useAuth();
  const [student, setStudent]       = useState(null);
  const [results, setResults]       = useState([]);
  const [notices, setNotices]       = useState([]);
  const [fees, setFees]             = useState([]);
  const [admitCards, setAdmitCards] = useState([]);
  const [activeAdmit, setActiveAdmit] = useState(null);

  useEffect(() => {
    api.get('/students/me').then(res => setStudent(res.data)).catch(() => {});
    api.get('/results/my').then(res => setResults(Array.isArray(res.data) ? res.data : [])).catch(() => {});
    api.get('/fees/my').then(res => setFees(Array.isArray(res.data) ? res.data : [])).catch(() => {});
    api.get('/notices').then(res => setNotices(Array.isArray(res.data) ? res.data.slice(0, 3) : [])).catch(() => {});
    api.get('/fees/my-admit-cards').then(res => setAdmitCards(Array.isArray(res.data) ? res.data : [])).catch(() => {});
  }, []);

  const totalDue = fees.reduce((s, f) => s + Number(f.due > 0 ? f.due : 0), 0);
  const latestResult = results[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', borderRadius: 14, padding: 24, color: '#fff', display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 700 }}>
          {student?.name?.[0] || user?.name?.[0]}
        </div>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 4 }}>{student?.name || user?.name}</h2>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.875rem' }}>আইডি: {student?.id}</p>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.875rem' }}>শ্রেণি: {student?.class} | রোল: {student?.roll}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <Card title="শ্রেণি" value={student?.class || '-'} icon={<FiUser />} color="primary" />
        <Card title="রোল নম্বর" value={student?.roll || '-'} icon={<FiAward />} color="gold" />
        <Card title="বকেয়া ফি" value={`৳${totalDue}`} icon={<FiDollarSign />} color={totalDue > 0 ? 'danger' : 'success'} />
        <Card title="পরীক্ষা" value={results.length} icon={<FiAward />} color="info" />
      </div>

      {/* Admit Cards */}
      {admitCards.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <FiFileText size={18} style={{ color: 'var(--primary)' }} />
            <h3 style={{ color: 'var(--primary)', fontWeight: 600 }}>আমার প্রবেশপত্র</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {admitCards.map((ac, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', background: 'var(--bg)', borderRadius: 10,
                border: '1px solid var(--border)'
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text)' }}>{ac.examName}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 3 }}>
                    {ac.startDate && ac.endDate
                      ? `${formatDate(ac.startDate)} — ${formatDate(ac.endDate)}`
                      : ac.startDate ? formatDate(ac.startDate) : ''}
                    {ac.status === 'চলমান' && (
                      <Badge variant="success" style={{ marginLeft: 8 }}>চলমান</Badge>
                    )}
                    {ac.status === 'আসন্ন' && (
                      <Badge variant="warning" style={{ marginLeft: 8 }}>আসন্ন</Badge>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setActiveAdmit({
                    studentId:   ac.studentId,
                    studentName: ac.studentName,
                    class:       ac.class,
                    roll:        ac.roll,
                    section:     ac.section,
                    photo:       ac.photo,
                    examName:    ac.examName,
                    session:     new Date().getFullYear(),
                  })}
                  style={{
                    padding: '8px 18px', background: 'var(--primary)', color: '#fff',
                    border: 'none', borderRadius: 8, fontFamily: 'inherit',
                    fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6
                  }}
                >
                  <FiFileText size={14} /> প্রবেশপত্র দেখুন
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeAdmit && (
        <AdmitCard admitData={activeAdmit} onClose={() => setActiveAdmit(null)} />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ color: 'var(--primary)', fontWeight: 600 }}>সর্বশেষ ফলাফল</h3>
            <Link to="/student/result" style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>বিস্তারিত</Link>
          </div>
          {latestResult ? (
            (latestResult.subjects || []).slice(0, 4).map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.875rem' }}>{s.subject_name}</span>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{s.obtained}/{s.total_marks}</span>
                  <Badge variant="success">{s.grade}</Badge>
                </div>
              </div>
            ))
          ) : <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>কোনো ফলাফল নেই।</p>}
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ color: 'var(--primary)', fontWeight: 600 }}>নোটিশ</h3>
            <Link to="/student/notices" style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>সব দেখুন</Link>
          </div>
          {notices.map(n => (
            <div key={n.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                {n.is_important == 1 && <Badge variant="danger">গুরুত্বপূর্ণ</Badge>}
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{n.title}</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDate(n.created_at)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
