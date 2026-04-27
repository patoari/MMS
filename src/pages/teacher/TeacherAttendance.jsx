import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { FaWhatsapp } from 'react-icons/fa';
import api from '../../services/api';
import { formatDate } from '../../utils/dateFormat';
import './TeacherAttendance.css';

const STATUS = {
  present: { label: 'উপস্থিত', icon: '✓', color: 'present' },
  absent:  { label: 'অনুপস্থিত', icon: '✕', color: 'absent' },
  excused: { label: 'ছুটি', icon: 'E', color: 'excused' },
};

export default function TeacherAttendance() {
  const { user } = useAuth();
  const { settings } = useSiteSettings();
  const [assignedClass, setAssignedClass] = useState('');
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attendanceDates, setAttendanceDates] = useState([]);
  const [toast, setToast] = useState(null);
  const [holidayInfo, setHolidayInfo] = useState(null);
  const [monthlyReport, setMonthlyReport] = useState(null);
  const [absentStudents, setAbsentStudents] = useState([]);  // after save

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    api.get('/sessions').then(res => {
      const data = Array.isArray(res.data) ? res.data : [];
      setSessions(data);
      const cur = data.find(s => s.is_current == 1);
      if (cur) setSelectedSession(cur.id);
    }).catch(() => {});

    if (user?.role === 'class_teacher') {
      api.get('/teachers/me').then(res => {
        const cls = res.data?.class || '';
        setAssignedClass(cls);
        if (cls) loadStudents(cls);
      }).catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    if (assignedClass && selectedSession) {
      loadAttendance(assignedClass, selectedDate, selectedSession);
      loadAttendanceDates(assignedClass, selectedMonth, selectedSession);
      loadMonthlyReport(assignedClass, selectedMonth, selectedSession);
    }
    api.get(`/holidays/check?date=${selectedDate}`)
      .then(res => setHolidayInfo(res.data))
      .catch(() => setHolidayInfo(null));
  }, [assignedClass, selectedDate, selectedSession, selectedMonth]);

  const loadStudents = (className) => {
    setLoading(true);
    api.get(`/students?class=${encodeURIComponent(className)}&limit=200`)
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : [];
        setStudents(list.sort((a, b) => a.roll - b.roll));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const loadAttendance = (className, date, sessionId) => {
    api.get(`/attendance?class=${encodeURIComponent(className)}&date=${date}&session_id=${sessionId}`)
      .then(res => setAttendance(res.data?.attendance || {}))
      .catch(() => {});
  };

  const loadAttendanceDates = (className, month, sessionId) => {
    api.get(`/attendance/dates?class=${encodeURIComponent(className)}&month=${month}&session_id=${sessionId}`)
      .then(res => setAttendanceDates(res.data?.dates || []))
      .catch(() => {});
  };

  const loadMonthlyReport = (className, month, sessionId) => {
    api.get(`/attendance/report?class=${encodeURIComponent(className)}&month=${month}&session_id=${sessionId}`)
      .then(res => setMonthlyReport(res.data))
      .catch(() => setMonthlyReport(null));
  };

  const handleDateChange = (e) => {
    const d = e.target.value;
    setSelectedDate(d);
    setSelectedMonth(d.slice(0, 7));
  };

  const handleMonthChange = (e) => {
    const m = e.target.value;
    setSelectedMonth(m);
    setSelectedDate(`${m}-01`);
  };

  const handleStatusChange = (studentId, status) => {
    setAttendance(prev => ({ ...prev, [studentId]: { ...prev[studentId], status } }));
  };

  const handleNoteChange = (studentId, note) => {
    setAttendance(prev => ({ ...prev, [studentId]: { ...prev[studentId], note } }));
  };

  const handleMarkAll = (status) => {
    const next = {};
    students.forEach(s => { next[s.id] = { status, note: attendance[s.id]?.note || '' }; });
    setAttendance(next);
  };

  const buildAbsentWhatsAppUrl = (student) => {
    let phone = (student.phone || '').replace(/\D/g, '');
    if (!phone) return null;
    if (phone.length === 11 && phone.startsWith('0')) phone = '88' + phone;
    const schoolName = settings?.siteName || 'মাদ্রাসা';
    const date = formatDate(selectedDate);
    const lines = [
      `🏫 *${schoolName}*`,
      `📢 *অনুপস্থিতির বিজ্ঞপ্তি*`,
      `─────────────────`,
      `আসসালামু আলাইকুম,`,
      ``,
      `আপনার সন্তান *${student.name}* আজ (${date}) শ্রেণিকক্ষে অনুপস্থিত ছিল।`,
      ``,
      `📚 শ্রেণি: ${assignedClass}`,
      `🆔 আইডি: ${student.id}`,
      ``,
      `অনুগ্রহ করে বিষয়টি নিশ্চিত করুন।`,
      `─────────────────`,
      `ধন্যবাদ। 🙏`,
    ];
    return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`;
  };

  const handleSave = async () => {
    if (!assignedClass || !selectedSession) return;
    if (holidayInfo?.is_holiday) {
      showToast('ছুটির দিনে হাজিরা নেওয়া যাবে না', 'error');
      return;
    }
    // Build complete attendance map — every student gets their effective status
    const fullAttendance = {};
    students.forEach(s => {
      fullAttendance[s.id] = {
        status: attendance[s.id]?.status ?? 'present',
        note:   attendance[s.id]?.note   ?? '',
      };
    });
    setSaving(true);
    try {
      await api.post('/attendance', {
        class: assignedClass,
        date: selectedDate,
        session_id: selectedSession,
        attendance: fullAttendance
      });
      // Collect absent students with phone numbers for WhatsApp notification
      const absent = students.filter(s => fullAttendance[s.id]?.status === 'absent' && s.phone);
      setAbsentStudents(absent);
      showToast('হাজিরা সফলভাবে সংরক্ষিত হয়েছে');
      loadAttendanceDates(assignedClass, selectedMonth, selectedSession);
      loadMonthlyReport(assignedClass, selectedMonth, selectedSession);
    } catch {
      showToast('হাজিরা সংরক্ষণে ব্যর্থ হয়েছে', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Daily stats — counts for the selected date only
  const stats = students.reduce(
    (acc, s) => {
      const st = attendance[s.id]?.status || 'present';
      acc[st] = (acc[st] || 0) + 1;
      acc.total++;
      return acc;
    },
    { present: 0, absent: 0, excused: 0, total: 0 }
  );

  // Daily rate — present ÷ total students for the selected date
  const dailyRate = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;

  // Monthly rate — total present records ÷ (students × working days taken)
  // Uses backend report which already excludes holidays
  const monthlyRate = (() => {
    const report = monthlyReport?.report;
    const workingDays = monthlyReport?.working_days || 0;
    if (!report || report.length === 0 || workingDays === 0) return 0;
    const totalPresent = report.reduce((sum, r) => sum + Number(r.present_days), 0);
    const totalSlots   = report.length * workingDays;
    return Math.round((totalPresent / totalSlots) * 100);
  })();

  const workingDaysThisMonth = monthlyReport?.working_days || attendanceDates.length;

  if (!assignedClass) {
    return (
      <div className="att-container">
        <div className="att-empty">
          <div className="att-empty-icon">📋</div>
          <p>আপনার কোনো শ্রেণি নির্ধারিত নেই</p>
        </div>
      </div>
    );
  }

  const currentSession = sessions.find(s => s.id == selectedSession);

  return (
    <div className="att-container">
      {toast && <div className={`att-toast att-toast--${toast.type}`}>{toast.msg}</div>}

      {/* Header */}
      <div className="att-header">
        <div className="att-header-left">
          <h1 className="att-title">হাজিরা</h1>
          <p className="att-subtitle">
            {assignedClass}
            {currentSession && <span className="att-session-badge">{currentSession.name} ({currentSession.year})</span>}
          </p>
        </div>
        <div className="att-controls">
          <select value={selectedSession || ''} onChange={e => setSelectedSession(e.target.value)} className="att-select">
            {sessions.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.year}){s.is_current == 1 ? ' ★' : ''}
              </option>
            ))}
          </select>
          <input type="month" value={selectedMonth} onChange={handleMonthChange} className="att-input" />
          <input type="date" value={selectedDate} onChange={handleDateChange} className="att-input" max={new Date().toISOString().split('T')[0]} />
        </div>
      </div>

      {/* Holiday banner */}
      {holidayInfo?.is_holiday && (
        <div className="att-holiday-banner">
          🎉 <strong>{holidayInfo.title}</strong> — এই দিনটি ছুটির দিন। হাজিরা নেওয়া যাবে না।
        </div>
      )}

      {/* Stats, date chips and table — hidden on holidays */}
      {!holidayInfo?.is_holiday && (
      <>
      {/* Stats */}
      <div className="att-stats">
        <div className="att-stat att-stat--rate">
          <div className="att-stat-ring">
            <svg viewBox="0 0 36 36">
              <path className="att-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path className="att-ring-fill" strokeDasharray={`${dailyRate}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            </svg>
            <span className="att-ring-label">{dailyRate}%</span>
          </div>
          <p className="att-stat-name">
            {formatDate(selectedDate)} এর হার
          </p>
        </div>
        <div className="att-stat att-stat--present">
          <span className="att-stat-val">{stats.present}</span>
          <p className="att-stat-name">আজ উপস্থিত</p>
        </div>
        <div className="att-stat att-stat--absent">
          <span className="att-stat-val">{stats.absent}</span>
          <p className="att-stat-name">আজ অনুপস্থিত</p>
        </div>
        <div className="att-stat att-stat--excused">
          <span className="att-stat-val">{stats.excused}</span>
          <p className="att-stat-name">ছুটি</p>
        </div>
        <div className="att-stat att-stat--total">
          <span className="att-stat-val">{workingDaysThisMonth}</span>
          <p className="att-stat-name">কার্যদিবস</p>
        </div>
      </div>

      {/* Date chips */}
      {attendanceDates.length > 0 && (
        <div className="att-dates">
          <span className="att-dates-label">এই মাসে:</span>
          <div className="att-dates-list">
            {attendanceDates.slice(0, 12).map(d => (
              <button
                key={d.date}
                className={`att-chip ${d.date === selectedDate ? 'att-chip--active' : ''}`}
                onClick={() => setSelectedDate(d.date)}
              >
                {new Date(d.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </button>
            ))}
            {attendanceDates.length > 12 && <span className="att-chip-more">+{attendanceDates.length - 12}</span>}
          </div>
        </div>
      )}

      {/* Table card */}
      <div className="att-card">
        <div className="att-toolbar">
          <div className="att-mark-all">
            <span className="att-toolbar-label">সবাইকে চিহ্নিত করুন:</span>
            {Object.entries(STATUS).map(([key, val]) => (
              <button key={key} className={`att-mark-btn att-mark-btn--${val.color}`} onClick={() => handleMarkAll(key)}>
                {val.icon} {val.label}
              </button>
            ))}
          </div>
          <button className={`att-save-btn ${saving ? 'att-save-btn--loading' : ''}`} onClick={handleSave} disabled={saving}>
            {saving ? <span className="att-spinner" /> : '💾'}
            {saving ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
          </button>
        </div>

        {/* WhatsApp absent notification panel */}
        {absentStudents.length > 0 && (
          <div style={{ padding: '10px 16px', background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#166534' }}>
              <FaWhatsapp style={{ marginRight: 5, color: '#25D366' }} />
              {absentStudents.length} জন অনুপস্থিত — অভিভাবকদের জানান:
            </span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {absentStudents.map(s => {
                const url = buildAbsentWhatsAppUrl(s);
                return url ? (
                  <a key={s.id} href={url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: '#25D366', color: '#fff', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }}>
                    <FaWhatsapp size={13} /> {s.name}
                  </a>
                ) : null;
              })}
            </div>
            <button onClick={() => setAbsentStudents([])} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '1rem' }}>✕</button>
          </div>
        )}

        {loading ? (
          <div className="att-loading">
            <div className="att-loader" />
            <p>লোড হচ্ছে...</p>
          </div>
        ) : students.length === 0 ? (
          <div className="att-empty"><p>কোনো শিক্ষার্থী পাওয়া যায়নি</p></div>
        ) : (
          <div className="att-table-wrap">
            <table className="att-table">
              <thead>
                <tr>
                  <th>রোল</th>
                  <th>নাম</th>
                  <th>আইডি</th>
                  <th>অবস্থা</th>
                  <th>মন্তব্য</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student, idx) => {
                  const status = attendance[student.id]?.status || 'present';
                  const note = attendance[student.id]?.note || '';
                  return (
                    <tr key={student.id} className={`att-row att-row--${status} ${idx % 2 === 0 ? 'att-row--even' : ''}`}>
                      <td className="att-roll">{student.roll}</td>
                      <td className="att-name">{student.name}</td>
                      <td className="att-id">{student.id}</td>
                      <td>
                        <div className="att-status-group">
                          {Object.entries(STATUS).map(([key, val]) => (
                            <button
                              key={key}
                              className={`att-status-btn att-status-btn--${val.color} ${status === key ? 'att-status-btn--active' : ''}`}
                              onClick={() => handleStatusChange(student.id, key)}
                              title={val.label}
                            >
                              {val.icon}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={note}
                          onChange={e => handleNoteChange(student.id, e.target.value)}
                          placeholder="মন্তব্য..."
                          className="att-note"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}
