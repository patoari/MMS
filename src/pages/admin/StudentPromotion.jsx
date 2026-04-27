import { useState, useEffect } from 'react';
import api from '../../services/api';
import Table from '../../components/Table';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import { FiArrowUp, FiCheckCircle, FiAlertCircle, FiInfo } from 'react-icons/fi';
import swal from '../../utils/swal';
import './StudentPromotion.css';

export default function StudentPromotion() {
  const [exams, setExams]     = useState([]);
  const [selected, setSelected] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [done, setDone]       = useState(false);
  const year = new Date().getFullYear();

  const fetchExams = () =>
    api.get('/promotions/annual-exams')
      .then(res => setExams(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});

  useEffect(() => { fetchExams(); }, []);

  const loadResults = (exam) => {
    setSelected(exam);
    setDone(false);
    setResults([]);
    if (exam.promoted_count > 0) {
      setLoading(true);
      api.get(`/promotions?exam_id=${exam.id}`)
        .then(res => setResults(Array.isArray(res.data) ? res.data : []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  };

  const handlePromote = async () => {
    if (!selected) return;
    const ok = await swal.confirmAction(
      'প্রমোশন নিশ্চিত করুন',
      `"${selected.name}" পরীক্ষার ভিত্তিতে শিক্ষার্থীদের প্রমোশন দেওয়া হবে।`,
      'হ্যাঁ, প্রমোশন দিন'
    );
    if (!ok) return;
    setRunning(true);
    try {
      const res = await api.post('/promotions', { exam_id: selected.id, academic_year: year });
      setResults(Array.isArray(res.data) ? res.data : []);
      setDone(true);
      swal.success('প্রমোশন সফলভাবে সম্পন্ন হয়েছে');
      fetchExams();
    } catch (e) {
      await swal.error(e.message);
    } finally {
      setRunning(false);
    }
  };

  const handleManualPromote = async (studentId, studentName) => {
    const ok = await swal.confirmAction(
      'ম্যানুয়াল প্রমোশন নিশ্চিত করুন',
      `"${studentName}" কে পরবর্তী শ্রেণিতে প্রমোট করতে চান?`,
      'হ্যাঁ, প্রমোট করুন'
    );
    if (!ok) return;
    
    try {
      await api.post('/promotions/manual', { 
        exam_id: selected.id, 
        student_id: studentId,
        academic_year: year 
      });
      swal.success('শিক্ষার্থী সফলভাবে প্রমোট হয়েছে');
      loadResults(selected);
      fetchExams();
    } catch (e) {
      await swal.error(e.message);
    }
  };

  const handleDemote = async (studentId, studentName, fromClass) => {
    const ok = await swal.confirmAction(
      'প্রমোশন বাতিল নিশ্চিত করুন',
      `"${studentName}" এর প্রমোশন বাতিল করে "${fromClass}" শ্রেণিতে ফিরিয়ে নিতে চান?`,
      'হ্যাঁ, বাতিল করুন',
      'danger'
    );
    if (!ok) return;
    
    try {
      await api.post('/promotions/demote', { 
        exam_id: selected.id, 
        student_id: studentId
      });
      swal.success('প্রমোশন বাতিল করা হয়েছে');
      loadResults(selected);
      fetchExams();
    } catch (e) {
      await swal.error(e.message);
    }
  };

  const resultColumns = [
    { header: 'র‍্যাংক',        render: r => <strong>#{r.rank_in_class}</strong> },
    { header: 'শিক্ষার্থী',     key: 'student_name' },
    { header: 'মোট নম্বর',      render: r => `${r.total_obtained}/${r.total_marks}` },
    { header: 'পাস বিষয়',      render: r => `${r.subjects_passed}/${r.subjects_total}` },
    { header: 'নতুন রোল',       render: r => r.new_roll ? `#${r.new_roll}` : '—' },
    { header: 'পূর্ববর্তী শ্রেণি', key: 'from_class' },
    { header: 'নতুন শ্রেণি',    render: r => r.to_class || '—' },
    {
      header: 'অবস্থা',
      render: r => r.is_promoted == 1
        ? <Badge variant="success"><FiCheckCircle style={{ marginRight: 4 }} />প্রমোটেড</Badge>
        : <Badge variant="danger"><FiAlertCircle style={{ marginRight: 4 }} />অনুত্তীর্ণ</Badge>
    },
    {
      header: 'অ্যাকশন',
      render: r => r.is_promoted == 0 ? (
        <Button 
          size="sm" 
          variant="success" 
          icon={<FiArrowUp />}
          onClick={() => handleManualPromote(r.student_id, r.student_name)}
        >
          প্রমোট করুন
        </Button>
      ) : (
        <Button 
          size="sm" 
          variant="danger" 
          icon={<FiAlertCircle />}
          onClick={() => handleDemote(r.student_id, r.student_name, r.from_class)}
        >
          বাতিল করুন
        </Button>
      )
    },
  ];

  return (
    <div className="promotion-page">
      <div className="promotion-header">
        <div>
          <h1 className="page-title">শিক্ষার্থী প্রমোশন</h1>
          <p className="page-subtitle">বার্ষিক পরীক্ষার ভিত্তিতে শিক্ষার্থীদের পরবর্তী শ্রেণিতে উন্নীত করুন</p>
        </div>
      </div>

      {exams.length === 0 && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 20, color: 'var(--text-muted)' }}>
          <FiInfo size={20} />
          <span>কোনো বার্ষিক পরীক্ষা পাওয়া যায়নি। পরীক্ষা তালিকা থেকে একটি পরীক্ষাকে "বার্ষিক পরীক্ষা" হিসেবে চিহ্নিত করুন এবং অবস্থা "সম্পন্ন" করুন।</span>
        </div>
      )}

      <div className="promotion-layout">
        {/* Exam list */}
        {exams.length > 0 && (
          <div className="card promotion-exam-list">
            <p className="section-label">বার্ষিক পরীক্ষাসমূহ</p>
            {exams.map(exam => (
              <div
                key={exam.id}
                className={`exam-item${selected?.id === exam.id ? ' active' : ''}`}
                onClick={() => loadResults(exam)}
              >
                <div className="exam-item-info">
                  <span className="exam-item-name">{exam.name}</span>
                  <span className="exam-item-class">{exam.class_name} · পাস: {exam.pass_mark_percent}%</span>
                </div>
                <div className="exam-item-meta">
                  {exam.promoted_count > 0
                    ? <Badge variant="success">প্রমোটেড {exam.promoted_count}</Badge>
                    : exam.result_count > 0
                      ? <Badge variant="warning">ফলাফল {exam.result_count}</Badge>
                      : <Badge variant="secondary">ফলাফল নেই</Badge>
                  }
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Right panel */}
        <div className="promotion-detail">
          {!selected && exams.length > 0 && (
            <div className="card promotion-empty">
              <FiArrowUp size={48} style={{ color: 'var(--primary)', opacity: 0.4 }} />
              <p>বাম থেকে একটি পরীক্ষা নির্বাচন করুন</p>
            </div>
          )}

          {selected && (
            <div className="card">
              <div className="promotion-detail-header">
                <div>
                  <h2 className="promotion-exam-title">{selected.name}</h2>
                  <p className="promotion-exam-sub">{selected.class_name} · পাস মার্ক: {selected.pass_mark_percent}%</p>
                </div>
                {selected.promoted_count == 0 && selected.result_count > 0 && (
                  <Button icon={<FiArrowUp />} onClick={handlePromote} disabled={running}>
                    {running ? 'প্রমোশন চলছে...' : 'প্রমোশন দিন'}
                  </Button>
                )}
              </div>

              {done && (
                <div className="promotion-success-banner">
                  <FiCheckCircle /> প্রমোশন সফলভাবে সম্পন্ন হয়েছে। শিক্ষার্থীদের শ্রেণি ও রোল নম্বর আপডেট করা হয়েছে।
                </div>
              )}

              {loading && <p className="loading-text">লোড হচ্ছে...</p>}

              {results.length > 0 && (
                <>
                  <div className="promotion-stats">
                    <div className="stat-box stat-promoted">
                      <span>{results.filter(r => r.is_promoted == 1).length}</span>
                      <label>প্রমোটেড</label>
                    </div>
                    <div className="stat-box stat-failed">
                      <span>{results.filter(r => r.is_promoted == 0).length}</span>
                      <label>অনুত্তীর্ণ</label>
                    </div>
                    <div className="stat-box stat-total">
                      <span>{results.length}</span>
                      <label>মোট</label>
                    </div>
                  </div>
                  <Table columns={resultColumns} data={results} />
                </>
              )}

              {!loading && results.length === 0 && selected.result_count == 0 && (
                <p className="empty-text">এই পরীক্ষার কোনো ফলাফল এন্ট্রি নেই।</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
