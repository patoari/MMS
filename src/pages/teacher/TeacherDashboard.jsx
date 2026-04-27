import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import { FiUsers, FiBell, FiBook, FiCheckSquare, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { useIslamicGreeting } from '../../hooks/useIslamicGreeting';
import { formatDate } from '../../utils/dateFormat';
import StudentAttendanceStats from '../../components/StudentAttendanceStats';
import './TeacherDashboard.css';

const MONTHS_BN = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];

export default function TeacherDashboard() {
  useIslamicGreeting();
  const { user } = useAuth();
  const [students, setStudents]   = useState([]);
  const [notices, setNotices]     = useState([]);
  const [teacher, setTeacher]     = useState(null);
  const [sessions, setSessions]   = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [expandedStudent, setExpandedStudent] = useState(null);

  useEffect(() => {
    api.get('/sessions').then(res => {
      const data = Array.isArray(res.data) ? res.data : [];
      setSessions(data);
      const cur = data.find(s => s.is_current == 1);
      if (cur) setSessionId(cur.id);
    }).catch(() => {});

    api.get('/teachers/me').then(res => {
      const t = res.data;
      setTeacher(t);
      const cls = t?.class || '';
      const url = (user?.role === 'class_teacher' && cls)
        ? `/students?class=${encodeURIComponent(cls)}&limit=200`
        : '/students?limit=200';
      return api.get(url);
    }).then(res => setStudents(Array.isArray(res.data) ? res.data : [])).catch(() => {});

    api.get('/notices').then(res => setNotices(Array.isArray(res.data) ? res.data.slice(0, 3) : [])).catch(() => {});
  }, []);

  const toggleStudent = (id) => setExpandedStudent(prev => prev === id ? null : id);

  const currentMonth = new Date().getMonth();
  const monthName = MONTHS_BN[currentMonth];

  return (
    <div className="td-container">
      {/* Profile card */}
      <div className="td-profile">
        <div className="td-avatar">{user?.name?.[0]}</div>
        <div>
          <h2 className="td-name">{user?.name}</h2>
          <p className="td-subject">{teacher?.subject}</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="td-cards">
        <Card title="মোট শিক্ষার্থী" value={students.length} icon={<FiUsers />} color="primary" />
        <Card
          title={user?.role === 'class_teacher' ? 'নির্ধারিত শ্রেণি' : 'আমার বিষয়'}
          value={user?.role === 'class_teacher' ? (teacher?.class || '-') : (teacher?.subject || '-')}
          icon={<FiBook />} color="gold"
        />
        <Card title="নোটিশ" value={notices.length} icon={<FiBell />} color="info" />
      </div>

      <div className="td-grid">
        {/* Notices */}
        <div className="card">
          <div className="td-section-head">
            <h3>সাম্প্রতিক নোটিশ</h3>
            <Link to="/teacher/notices">সব দেখুন</Link>
          </div>
          {notices.length === 0
            ? <p className="td-empty">কোনো নোটিশ নেই</p>
            : notices.map(n => (
              <div key={n.id} className="td-notice-item">
                <div className="td-notice-title">{n.title}</div>
                <div className="td-notice-date">{formatDate(n.created_at)}</div>
              </div>
            ))
          }
        </div>

        {/* Quick student list */}
        <div className="card">
          <div className="td-section-head">
            <h3>শিক্ষার্থী তালিকা</h3>
            <Link to="/teacher/students">সব দেখুন</Link>
          </div>
          {students.slice(0, 5).map(s => (
            <div key={s.id} className="td-student-row">
              <div className="td-student-avatar">{s.name[0]}</div>
              <div className="td-student-info">
                <div className="td-student-name">{s.name}</div>
                <div className="td-student-roll">রোল: {s.roll}</div>
              </div>
              <Badge variant="success">{s.status}</Badge>
            </div>
          ))}
        </div>
      </div>

      {/* Attendance section — class teacher only */}
      {user?.role === 'class_teacher' && students.length > 0 && (
        <div className="card">
          <div className="td-section-head">
            <h3><FiCheckSquare style={{ marginRight: 6 }} />শিক্ষার্থীদের হাজিরা — {monthName}</h3>
            <Link to="/teacher/attendance">হাজিরা নিন</Link>
          </div>
          <p className="td-att-hint">প্রতিটি শিক্ষার্থীর নামে ক্লিক করুন সাপ্তাহিক, মাসিক ও বার্ষিক হাজিরা দেখতে</p>

          <div className="td-att-list">
            {students.map(s => (
              <div key={s.id} className="td-att-item">
                <button
                  className={`td-att-toggle ${expandedStudent === s.id ? 'td-att-toggle--open' : ''}`}
                  onClick={() => toggleStudent(s.id)}
                >
                  <div className="td-att-student">
                    <span className="td-att-roll">{s.roll}</span>
                    <span className="td-att-sname">{s.name}</span>
                  </div>
                  {expandedStudent === s.id ? <FiChevronUp /> : <FiChevronDown />}
                </button>
                {expandedStudent === s.id && (
                  <div className="td-att-stats">
                    <StudentAttendanceStats studentId={s.id} sessionId={sessionId} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
