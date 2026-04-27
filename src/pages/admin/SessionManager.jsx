import { useState, useEffect } from 'react';
import { FiPlus, FiCheck, FiLock, FiUnlock, FiRefreshCw, FiBarChart2, FiUsers, FiBookOpen, FiDollarSign } from 'react-icons/fi';
import api from '../../services/api';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import InputField from '../../components/InputField';
import Badge from '../../components/Badge';
import swal from '../../utils/swal';
import { useForm } from 'react-hook-form';
import { formatDate } from '../../utils/dateFormat';
import './SessionManager.css';

export default function SessionManager() {
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const sessionsRes = await api.get('/sessions');
      setSessions(Array.isArray(sessionsRes.data) ? sessionsRes.data : []);

      // current session may not exist yet — treat 404 as null, not an error
      try {
        const currentRes = await api.pub('/sessions/current');
        setCurrentSession(currentRes.data);
      } catch {
        setCurrentSession(null);
      }
    } catch {
      await swal.error('সেশন লোড করতে ব্যর্থ হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  const onAddSession = async (data) => {
    try {
      await api.post('/sessions', data);
      await swal.success('নতুন সেশন তৈরি হয়েছে');
      setShowAddModal(false);
      reset();
      loadSessions();
    } catch (e) {
      await swal.error(e.message || 'সেশন তৈরি করতে ব্যর্থ হয়েছে');
    }
  };

  const handleActivate = async (id, name) => {
    const confirmed = await swal.confirm(
      `সেশন সক্রিয় করবেন?`,
      `আপনি কি "${name}" সেশনে স্যুইচ করতে চান? বর্তমান সেশনের স্ন্যাপশট তৈরি হবে।`,
      'সক্রিয় করুন'
    );
    
    if (!confirmed) return;

    try {
      await api.post(`/sessions/${id}/activate`);
      await swal.success('সেশন সক্রিয় করা হয়েছে');
      loadSessions();
      // Reload page to refresh all data
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      await swal.error(e.message || 'সেশন সক্রিয় করতে ব্যর্থ হয়েছে');
    }
  };

  const handleLock = async (id, name) => {
    const confirmed = await swal.confirm(
      `সেশন লক করবেন?`,
      `"${name}" সেশন লক করলে এতে কোনো পরিবর্তন করা যাবে না। স্ন্যাপশট তৈরি হবে।`,
      'লক করুন'
    );
    
    if (!confirmed) return;

    try {
      await api.post(`/sessions/${id}/lock`);
      await swal.success('সেশন লক করা হয়েছে');
      loadSessions();
    } catch (e) {
      await swal.error(e.message || 'সেশন লক করতে ব্যর্থ হয়েছে');
    }
  };

  const handleSnapshot = async (id, name) => {
    const confirmed = await swal.confirm(
      `স্ন্যাপশট তৈরি করবেন?`,
      `"${name}" সেশনের বর্তমান ডেটার স্ন্যাপশট তৈরি হবে।`,
      'তৈরি করুন'
    );
    
    if (!confirmed) return;

    try {
      await api.post(`/sessions/${id}/snapshot`);
      await swal.success('স্ন্যাপশট তৈরি হয়েছে');
    } catch (e) {
      await swal.error(e.message || 'স্ন্যাপশট তৈরি করতে ব্যর্থ হয়েছে');
    }
  };

  const loadStatistics = async (id) => {
    try {
      const res = await api.get(`/sessions/${id}/statistics`);
      setStatistics(res.data);
      setSelectedSession(sessions.find(s => s.id === id));
    } catch {
      await swal.error('পরিসংখ্যান লোড করতে ব্যর্থ হয়েছে');
    }
  };

  if (loading) {
    return <div className="page-loading">লোড হচ্ছে...</div>;
  }

  return (
    <div className="session-manager-page">
      <div className="page-top">
        <div>
          <h1 className="page-title">শিক্ষাবর্ষ ব্যবস্থাপনা</h1>
          <p className="page-subtitle">
            বর্তমান সেশন: <strong>{currentSession?.name || '—'}</strong>
          </p>
        </div>
        <Button icon={<FiPlus />} onClick={() => setShowAddModal(true)}>
          নতুন সেশন
        </Button>
      </div>

      <div className="sessions-grid">
        {sessions.map(session => (
          <div 
            key={session.id} 
            className={`session-card ${session.is_current ? 'current' : ''} ${session.is_locked ? 'locked' : ''}`}
          >
            <div className="session-card-header">
              <div>
                <h3 className="session-name">{session.name}</h3>
                <p className="session-dates">
                  {formatDate(session.start_date)} - {formatDate(session.end_date)}
                </p>
              </div>
              <div className="session-badges">
                {session.is_current && <Badge variant="success">বর্তমান</Badge>}
                {session.is_locked && <Badge variant="warning"><FiLock size={12} /> লকড</Badge>}
              </div>
            </div>

            <div className="session-card-actions">
              {!session.is_current && !session.is_locked && (
                <Button 
                  size="sm" 
                  variant="primary" 
                  icon={<FiCheck />}
                  onClick={() => handleActivate(session.id, session.name)}
                >
                  সক্রিয় করুন
                </Button>
              )}
              
              {!session.is_current && !session.is_locked && (
                <Button 
                  size="sm" 
                  variant="warning" 
                  icon={<FiLock />}
                  onClick={() => handleLock(session.id, session.name)}
                >
                  লক করুন
                </Button>
              )}
              
              <Button 
                size="sm" 
                variant="outline" 
                icon={<FiRefreshCw />}
                onClick={() => handleSnapshot(session.id, session.name)}
              >
                স্ন্যাপশট
              </Button>
              
              <Button 
                size="sm" 
                variant="outline" 
                icon={<FiBarChart2 />}
                onClick={() => loadStatistics(session.id)}
              >
                পরিসংখ্যান
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Session Modal */}
      <Modal 
        isOpen={showAddModal} 
        onClose={() => { setShowAddModal(false); reset(); }} 
        title="নতুন শিক্ষাবর্ষ যোগ করুন"
        size="md"
      >
        <form onSubmit={handleSubmit(onAddSession)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <InputField 
            label="সেশনের নাম *" 
            name="name" 
            register={register} 
            error={errors.name} 
            required 
            placeholder="যেমন: 2027"
          />
          
          <InputField 
            label="বছর *" 
            name="year" 
            type="number" 
            register={register} 
            error={errors.year} 
            required 
            placeholder="2027"
          />
          
          <InputField 
            label="শুরুর তারিখ *" 
            name="start_date" 
            type="date" 
            register={register} 
            error={errors.start_date} 
            required 
          />
          
          <InputField 
            label="শেষের তারিখ *" 
            name="end_date" 
            type="date" 
            register={register} 
            error={errors.end_date} 
            required 
          />

          <div className="info-box">
            <strong>নোট:</strong> নতুন সেশন তৈরি হলে তা স্বয়ংক্রিয়ভাবে সক্রিয় হবে না। আপনাকে ম্যানুয়ালি সক্রিয় করতে হবে।
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
            <Button variant="outline" type="button" onClick={() => { setShowAddModal(false); reset(); }}>
              বাতিল
            </Button>
            <Button type="submit">সংরক্ষণ করুন</Button>
          </div>
        </form>
      </Modal>

      {/* Statistics Modal */}
      <Modal 
        isOpen={!!statistics} 
        onClose={() => { setStatistics(null); setSelectedSession(null); }} 
        title={`পরিসংখ্যান - ${selectedSession?.name || ''}`}
        size="lg"
      >
        {statistics && (
          <div className="statistics-grid">
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'var(--primary-light)' }}>
                <FiUsers size={24} color="var(--primary)" />
              </div>
              <div className="stat-content">
                <div className="stat-value">{statistics.total_students}</div>
                <div className="stat-label">মোট শিক্ষার্থী</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#e0f2fe' }}>
                <FiUsers size={24} color="#0284c7" />
              </div>
              <div className="stat-content">
                <div className="stat-value">{statistics.total_teachers}</div>
                <div className="stat-label">মোট শিক্ষক</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#fef3c7' }}>
                <FiBookOpen size={24} color="#d97706" />
              </div>
              <div className="stat-content">
                <div className="stat-value">{statistics.total_exams}</div>
                <div className="stat-label">মোট পরীক্ষা</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#dcfce7' }}>
                <FiDollarSign size={24} color="#16a34a" />
              </div>
              <div className="stat-content">
                <div className="stat-value">{statistics.fees?.total_fees || 0}</div>
                <div className="stat-label">মোট ফি রেকর্ড</div>
              </div>
            </div>

            <div className="stat-card full-width">
              <h4 style={{ marginBottom: 12, color: 'var(--text)' }}>ফি সংগ্রহ</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>মোট ফি</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)' }}>
                    ৳{Number(statistics.fees?.total_amount || 0).toLocaleString('en-BD')}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>সংগৃহীত</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--success)' }}>
                    ৳{Number(statistics.fees?.total_paid || 0).toLocaleString('en-BD')}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>বকেয়া</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--danger)' }}>
                    ৳{Number(statistics.fees?.total_due || 0).toLocaleString('en-BD')}
                  </div>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#f3e8ff' }}>
                <FiBarChart2 size={24} color="#9333ea" />
              </div>
              <div className="stat-content">
                <div className="stat-value">{statistics.total_results}</div>
                <div className="stat-label">মোট ফলাফল</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#ffe4e6' }}>
                <FiDollarSign size={24} color="#e11d48" />
              </div>
              <div className="stat-content">
                <div className="stat-value">{statistics.total_receipts}</div>
                <div className="stat-label">মোট রসিদ</div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
