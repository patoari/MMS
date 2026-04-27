import { useEffect, useState } from 'react';
import api from '../../services/api';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import SelectBox from '../../components/SelectBox';
import Pagination from '../../components/Pagination';
import { useForm } from 'react-hook-form';
import { FiCheckCircle } from 'react-icons/fi';
import swal from '../../utils/swal';
import { CLASS_OPTIONS } from '../../utils/constants';

export default function ResultPublish() {
  const [exams, setExams]           = useState([]);
  const [sessions, setSessions]     = useState([]);
  const [results, setResults]       = useState([]);
  const [loading, setLoading]       = useState(false);
  const [published, setPublished]   = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [page, setPage]             = useState(1);
  const PER_PAGE = 10;
  const { register, watch, setValue } = useForm();
  const selectedExam = watch('exam');
  const selectedClass = watch('class') || 'সব';
  const selectedSession = watch('session');
  const selectedExamName = exams.find(e => e.id === selectedExam)?.name || '';

  useEffect(() => {
    // Fetch sessions first
    api.get('/sessions')
      .then(res => {
        const sessionsData = Array.isArray(res.data) ? res.data : [];
        setSessions(sessionsData);
        // Set default to current session if not already set
        if (!selectedSession && sessionsData.length > 0) {
          const currentSession = sessionsData.find(s => s.is_current == 1);
          if (currentSession) {
            setValue('session', currentSession.id);
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Fetch exams when session changes
    if (!selectedSession) return;
    
    const params = new URLSearchParams();
    params.append('session_id', selectedSession);
    
    api.get(`/exams?${params}`)
      .then(res => setExams(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, [selectedSession]);

  useEffect(() => {
    if (!selectedExam) return;
    setPublished(false);
    setPage(1);
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedSession) params.append('session_id', selectedSession);
    api.get(`/results/exam/${selectedExam}?${params}`)
      .then(res => setResults(Array.isArray(res.data) ? res.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedExam, selectedSession]);

  const handlePublish = async () => {
    if (!selectedExam || results.length === 0) return;
    setPublishing(true);
    try {
      // Publish submitted marks
      await api.post('/results/publish', { exam_id: selectedExam });
      // Create notice
      await api.post('/notices', {
        title: `${selectedExamName} — ফলাফল প্রকাশিত হয়েছে`,
        content: `${selectedExamName} পরীক্ষার ফলাফল প্রকাশিত হয়েছে। "ফলাফল দেখুন" পেজ থেকে ফলাফল দেখুন।`,
        category: 'পরীক্ষা',
        is_important: 1,
        status: 'published',
      });
      setPublished(true);
      await swal.success('ফলাফল প্রকাশিত হয়েছে।');
    } catch (e) {
      await swal.error(e.message);
    } finally {
      setPublishing(false);
    }
  };

  const examOptions = exams.map(e => ({ value: e.id, label: e.name }));
  const classOptions = [{ value: 'সব', label: 'সব শ্রেণি' }, ...CLASS_OPTIONS];
  const sessionOptions = (sessions || []).map(s => ({ 
    value: s.id, 
    label: `${s.name} (${s.year})${s.is_current == 1 ? ' - বর্তমান' : ''}` 
  }));

  // Filter and rank results by class
  const filteredResults = !selectedClass || selectedClass === 'সব' 
    ? results 
    : results.filter(r => {
        // Check both 'class' and 'class_name' fields
        const studentClass = r.class || r.class_name || '';
        return studentClass === selectedClass;
      });

  // Group by class and calculate class-wise ranking
  const resultsByClass = {};
  filteredResults.forEach(r => {
    const cls = r.class || r.class_name || 'অজানা';
    if (!resultsByClass[cls]) resultsByClass[cls] = [];
    resultsByClass[cls].push(r);
  });

  // Sort each class by total marks and assign rank
  Object.keys(resultsByClass).forEach(cls => {
    resultsByClass[cls].sort((a, b) => b.total_obtained - a.total_obtained);
    resultsByClass[cls].forEach((r, idx) => {
      r.class_rank = idx + 1;
    });
  });

  // Flatten back to single array
  const rankedResults = Object.values(resultsByClass).flat();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">ফলাফল প্রকাশ</h1>
          <p className="page-subtitle">পরীক্ষার ফলাফল দেখুন ও প্রকাশ করুন</p>
        </div>
        {results.length > 0 && (
          <Button
            variant="success"
            icon={<FiCheckCircle />}
            onClick={handlePublish}
            disabled={publishing || published}
          >
            {published ? '✓ প্রকাশিত হয়েছে' : publishing ? 'প্রকাশ হচ্ছে...' : 'ফলাফল প্রকাশ করুন'}
          </Button>
        )}
      </div>

      {published && (
        <div style={{ background: '#dcfce7', color: 'var(--success)', padding: '12px 16px', borderRadius: 8, fontWeight: 500 }}>
          ✓ ফলাফল প্রকাশিত হয়েছে। শিক্ষার্থীরা এখন দেখতে পাবেন।
        </div>
      )}

      <div className="card" style={{ maxWidth: '100%', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 250px' }}>
          <SelectBox label="সেশন" name="session" options={sessionOptions} register={register} />
        </div>
        <div style={{ flex: '1 1 250px' }}>
          <SelectBox label="পরীক্ষা নির্বাচন করুন" name="exam" options={examOptions} register={register} />
        </div>
        <div style={{ flex: '1 1 200px' }}>
          <SelectBox label="শ্রেণি" name="class" options={classOptions} register={register} />
        </div>
      </div>

      {loading && <p style={{ color: 'var(--text-muted)' }}>লোড হচ্ছে...</p>}

      {!loading && selectedExam && results.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
          এই পরীক্ষার কোনো ফলাফল নেই। প্রথমে নম্বর প্রদান করুন।
        </p>
      )}

      {!loading && selectedExam && results.length > 0 && rankedResults.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
          নির্বাচিত শ্রেণিতে কোনো ফলাফল নেই।
        </p>
      )}

      {rankedResults.slice((page-1)*PER_PAGE, page*PER_PAGE).map(result => (
        <div key={result.student_id} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ 
                width: 50, 
                height: 50, 
                borderRadius: '50%', 
                background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                color: 'var(--gold-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                fontWeight: 700,
                flexShrink: 0
              }}>
                #{result.class_rank}
              </div>
              <div>
                <h3 style={{ color: 'var(--primary)', fontWeight: 700, margin: 0 }}>{result.student_name}</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  {result.student_id} · {result.class} · রোল: {result.roll}
                </p>
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>মোট / শতকরা</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--primary)' }}>
                {result.total_obtained}/{result.total_marks} ({result.percentage}%)
              </div>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>বিষয়</th>
                <th style={{ padding: '8px 12px', textAlign: 'center' }}>পূর্ণমান</th>
                <th style={{ padding: '8px 12px', textAlign: 'center' }}>প্রাপ্ত</th>
                <th style={{ padding: '8px 12px', textAlign: 'center' }}>গ্রেড</th>
              </tr>
            </thead>
            <tbody>
              {(result.subjects || []).map((s, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px' }}>{s.subject_name}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>{s.total_marks}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>{s.obtained}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                    <Badge variant="success">{s.grade}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <Pagination page={page} total={rankedResults.length} perPage={PER_PAGE} onChange={setPage} />
    </div>
  );
}
