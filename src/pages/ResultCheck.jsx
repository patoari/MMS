import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import api from '../services/api';
import { useSiteSettings } from '../context/SiteSettingsContext';
import SiteLogo from '../components/SiteLogo';
import InputField from '../components/InputField';
import SelectBox from '../components/SelectBox';
import Button from '../components/Button';
import Badge from '../components/Badge';
import { getCurrentDate } from '../utils/dateFormat';
import { gradeVariant } from '../constants';
import { FiPrinter } from 'react-icons/fi';
import './ResultCheck.css';

export default function ResultCheck() {
  const [result, setResult]     = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading]   = useState(false);
  const { register, handleSubmit, watch, formState: { errors } } = useForm();
  const { settings } = useSiteSettings();
  
  // Filter states
  const [sessions, setSessions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [exams, setExams] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  
  const selectedSession = watch('session_id');
  const selectedClass = watch('class_id');

  // Load sessions
  useEffect(() => {
    Promise.all([
      api.pub('/sessions/all'),
      api.pub('/sessions/current')
    ]).then(([sessionsRes, currentRes]) => {
      setSessions(Array.isArray(sessionsRes.data) ? sessionsRes.data : []);
      setCurrentSession(currentRes.data);
    }).catch((err) => {
      console.error('Error loading sessions:', err);
    });
  }, []);

  // Load classes
  useEffect(() => {
    api.pub('/classes').then(res => {
      setClasses(Array.isArray(res.data) ? res.data : []);
    }).catch(() => {});
  }, []);

  // Load exams when session or class changes
  useEffect(() => {
    // Load exams even if only one filter is selected
    const params = new URLSearchParams();
    if (selectedSession) params.append('session_id', selectedSession);
    if (selectedClass) params.append('class_id', selectedClass);
    
    // Only fetch if at least one filter is selected
    if (selectedSession || selectedClass) {
      api.pub(`/exams/all?${params}`).then(res => {
        setExams(Array.isArray(res.data) ? res.data : []);
      }).catch((err) => {
        console.error('Error loading exams:', err);
        setExams([]);
      });
    } else {
      // Clear exams if no filters selected
      setExams([]);
    }
  }, [selectedSession, selectedClass]);

  const onSubmit = async (data) => {
    setLoading(true); setResult(null); setNotFound(false);
    try {
      const params = new URLSearchParams();
      params.append('studentId', data.studentId);
      if (data.session_id) params.append('session_id', data.session_id);
      if (data.class_id) params.append('class_id', data.class_id);
      if (data.exam_id) params.append('exam_id', data.exam_id);
      
      const res = await api.pub(`/results/check?${params}`);
      if (res.data) setResult(res.data);
      else setNotFound(true);
    } catch { setNotFound(true); }
    finally { setLoading(false); }
  };

  const handlePrint = (exam) => {
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('পপ-আপ ব্লক করা হয়েছে। অনুগ্রহ করে পপ-আপ অনুমতি দিন।');
        return;
      }
      
      const printContent = generatePrintableCard(exam, result, settings);
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      
      setTimeout(() => {
        try {
          printWindow.print();
        } catch (error) {
          console.error('Print failed:', error);
        }
      }, 250);
    } catch (error) {
      console.error('Failed to open print window:', error);
      alert('প্রিন্ট করতে ব্যর্থ হয়েছে।');
    }
  };

  const generatePrintableCard = (exam, resultData, siteSettings) => {
    const passedSubjects = exam.subjects_passed || 0;
    const totalSubjects = exam.subjects_total || exam.subjects?.length || 0;
    const isPassed = passedSubjects === totalSubjects;
    
    return `
<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <title>ফলাফল কার্ড - ${result.student_name}</title>
  <style>
    @media print {
      @page { margin: 0.5cm; size: A4 portrait; }
      body { margin: 0; }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Hind Siliguri', 'Noto Sans Bengali', sans-serif;
      padding: 10px;
      background: #fff;
      font-size: 12px;
    }
    .result-card {
      max-width: 100%;
      margin: 0 auto;
      border: 2px solid #1a5c38;
      border-radius: 6px;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .card-header {
      background: linear-gradient(135deg, #1a5c38, #2d8659);
      color: #fff;
      padding: 12px;
      text-align: center;
    }
    .bismillah {
      font-size: 1rem;
      font-family: 'Amiri', serif;
      direction: rtl;
      margin-bottom: 6px;
      letter-spacing: 0.5px;
    }
    .institution {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin-bottom: 6px;
    }
    .logo { width: 35px; height: 35px; }
    .inst-name { font-size: 1.1rem; font-weight: 700; }
    .inst-address { font-size: 0.7rem; opacity: 0.9; margin-top: 2px; }
    .card-title {
      font-size: 1rem;
      font-weight: 700;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid rgba(255,255,255,0.3);
    }
    .card-body { padding: 12px; }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-bottom: 10px;
      padding: 8px;
      background: #f8f9fa;
      border-radius: 4px;
      font-size: 0.85rem;
    }
    .info-item { display: flex; gap: 6px; }
    .info-label { font-weight: 600; color: #555; }
    .info-value { color: #1a1a1a; }
    .subjects-table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
      font-size: 0.85rem;
    }
    .subjects-table th,
    .subjects-table td {
      padding: 6px 8px;
      text-align: left;
      border: 1px solid #ddd;
    }
    .subjects-table th {
      background: #1a5c38;
      color: #fff;
      font-weight: 600;
      font-size: 0.8rem;
    }
    .subjects-table tbody tr:nth-child(even) {
      background: #f8f9fa;
    }
    .summary-box {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin: 10px 0;
      padding: 10px;
      background: #f0f7f4;
      border-radius: 4px;
      border: 2px solid #1a5c38;
    }
    .summary-item {
      text-align: center;
    }
    .summary-label {
      font-size: 0.75rem;
      color: #666;
      margin-bottom: 2px;
    }
    .summary-value {
      font-size: 1.1rem;
      font-weight: 700;
      color: #1a5c38;
    }
    .result-status {
      text-align: center;
      padding: 10px;
      margin: 10px 0;
      border-radius: 4px;
      font-size: 1rem;
      font-weight: 700;
    }
    .result-status.passed {
      background: #d4edda;
      color: #155724;
      border: 2px solid #28a745;
    }
    .result-status.failed {
      background: #f8d7da;
      color: #721c24;
      border: 2px solid #dc3545;
    }
    .signature-section {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
      margin-top: 15px;
      padding-top: 12px;
      border-top: 1px dashed #ddd;
    }
    .signature-box {
      text-align: center;
    }
    .signature-line {
      border-top: 1px solid #333;
      margin: 25px auto 6px;
      width: 120px;
    }
    .signature-label {
      font-size: 0.7rem;
      color: #666;
      font-weight: 600;
    }
    .footer {
      text-align: center;
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px solid #ddd;
      font-size: 0.7rem;
      color: #888;
    }
    .grade-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 3px;
      font-weight: 600;
      font-size: 0.8rem;
    }
    .grade-success { background: #d4edda; color: #155724; }
    .grade-primary { background: #cce5ff; color: #004085; }
    .grade-warning { background: #fff3cd; color: #856404; }
    .grade-danger { background: #f8d7da; color: #721c24; }
  </style>
</head>
<body>
  <div class="result-card">
    <div class="card-header">
      <div class="bismillah">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</div>
      <div class="institution">
        ${siteSettings.logoUrl ? `<img src="${siteSettings.logoUrl}" alt="Logo" class="logo" />` : ''}
        <div>
          <div class="inst-name">${siteSettings.siteName || 'মাদ্রাসা'}</div>
          ${siteSettings.address ? `<div class="inst-address">${siteSettings.address}</div>` : ''}
        </div>
      </div>
      <div class="card-title">ফলাফল কার্ড</div>
    </div>
    
    <div class="card-body">
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">শিক্ষার্থী:</span>
          <span class="info-value">${resultData.student_name}</span>
        </div>
        <div class="info-item">
          <span class="info-label">আইডি:</span>
          <span class="info-value">${resultData.student_id}</span>
        </div>
        <div class="info-item">
          <span class="info-label">শ্রেণি:</span>
          <span class="info-value">${resultData.class_name}</span>
        </div>
        <div class="info-item">
          <span class="info-label">পরীক্ষা:</span>
          <span class="info-value">${exam.exam_name}</span>
        </div>
        <div class="info-item">
          <span class="info-label">মেধা ক্রম:</span>
          <span class="info-value">
            ${exam.rank ? `#${exam.rank}` : 'N/A'}
            ${exam.total_students ? ` / ${exam.total_students}` : ''}
          </span>
        </div>
      </div>

      <table class="subjects-table">
        <thead>
          <tr>
            <th>বিষয়</th>
            <th style="text-align: center; width: 80px;">পূর্ণমান</th>
            <th style="text-align: center; width: 80px;">প্রাপ্ত</th>
            <th style="text-align: center; width: 60px;">গ্রেড</th>
          </tr>
        </thead>
        <tbody>
          ${exam.subjects.map(s => {
            const percent = s.total_marks > 0 ? (s.obtained / s.total_marks * 100) : 0;
            const passed = percent >= (exam.pass_mark_percent || 33);
            const gradeClass = s.grade === 'F' ? 'grade-danger' : 
                              s.grade.startsWith('A') ? 'grade-success' : 
                              s.grade === 'B' ? 'grade-primary' : 'grade-warning';
            return `
            <tr>
              <td>${s.subject_name}</td>
              <td style="text-align: center;">${s.total_marks}</td>
              <td style="text-align: center; font-weight: 600; color: ${passed ? '#28a745' : '#dc3545'};">${s.obtained}</td>
              <td style="text-align: center;">
                <span class="grade-badge ${gradeClass}">${s.grade}</span>
              </td>
            </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <div class="summary-box">
        <div class="summary-item">
          <div class="summary-label">মোট নম্বর</div>
          <div class="summary-value">${exam.total_obtained}/${exam.total_marks}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">শতকরা</div>
          <div class="summary-value">${exam.percentage}%</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">উত্তীর্ণ বিষয়</div>
          <div class="summary-value">${passedSubjects}/${totalSubjects}</div>
        </div>
      </div>

      <div class="result-status ${isPassed ? 'passed' : 'failed'}">
        ${isPassed ? '✓ উত্তীর্ণ' : '✗ অনুত্তীর্ণ'}
      </div>

      <div class="signature-section">
        <div class="signature-box">
          <div class="signature-line"></div>
          <div class="signature-label">শ্রেণি শিক্ষক</div>
        </div>
        <div class="signature-box">
          <div class="signature-line"></div>
          <div class="signature-label">অভিভাবক</div>
        </div>
        <div class="signature-box">
          <div class="signature-line"></div>
          <div class="signature-label">প্রধান শিক্ষক</div>
        </div>
      </div>

      <div class="footer">
        <p>তারিখ: ${getCurrentDate()} | অভিভাবকের স্বাক্ষরসহ ফেরত দিতে হবে</p>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();
  };

  return (
    <div className="result-check-page">
      <div className="result-check-container">
        <div className="result-check-header">
          <h1>ফলাফল দেখুন</h1>
          <p>শিক্ষার্থী আইডি দিয়ে ফলাফল খুঁজুন</p>
        </div>

        <div className="result-search-card">
          <form onSubmit={handleSubmit(onSubmit)} className="result-search-form">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <SelectBox
                label="শিক্ষাবর্ষ"
                name="session_id"
                register={register}
                options={[
                  { value: '', label: 'সকল সেশন' },
                  ...sessions.map(s => ({
                    value: s.id,
                    label: `${s.name} ${s.is_current ? '(বর্তমান)' : ''}`
                  }))
                ]}
              />
              
              <SelectBox
                label="শ্রেণি"
                name="class_id"
                register={register}
                options={[
                  { value: '', label: 'সকল শ্রেণি' },
                  ...classes.map(c => ({
                    value: c.id,
                    label: c.name
                  }))
                ]}
              />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <SelectBox
                label="পরীক্ষা"
                name="exam_id"
                register={register}
                options={[
                  { value: '', label: 'সকল পরীক্ষা' },
                  ...exams.map(e => ({
                    value: e.id,
                    label: e.name
                  }))
                ]}
              />
              
              <InputField
                label="শিক্ষার্থী আইডি"
                name="studentId"
                placeholder="যেমন: MMS-2026-001"
                register={register}
                error={errors.studentId}
                required
              />
            </div>
            
            <Button type="submit" size="lg" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'খোঁজা হচ্ছে...' : 'ফলাফল খুঁজুন'}
            </Button>
          </form>
        </div>

        {notFound && (
          <div className="result-not-found">
            <span>😔</span>
            <p>কোনো ফলাফল পাওয়া যায়নি। আইডি সঠিক কিনা যাচাই করুন।</p>
          </div>
        )}

        {result && (
          <div>
            {/* Student info */}
            <div className="result-card" style={{ marginBottom: 20 }}>
              <div className="result-card-header">
                <div>
                  <h2>{result.student_name}</h2>
                  <p>আইডি: {result.student_id} | শ্রেণি: {result.class_name}</p>
                </div>
              </div>
            </div>

            {/* One card per exam */}
            {(result.exams || []).map(exam => (
              <div key={exam.exam_id} className="result-card" style={{ marginBottom: 16 }}>
                <div className="result-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ 
                        width: 60, 
                        height: 60, 
                        borderRadius: '50%', 
                        background: 'rgba(255,255,255,0.2)',
                        border: '2px solid rgba(255,255,255,0.4)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.4rem',
                        fontWeight: 700,
                        flexShrink: 0
                      }}>
                        #{exam.rank || '?'}
                      </div>
                      <div>
                        <h3 style={{ color: '#fff', fontWeight: 700, fontSize: '1.2rem', margin: 0 }}>{exam.exam_name}</h3>
                        {exam.session_name && (
                          <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.9)', margin: '2px 0 0' }}>
                            শিক্ষাবর্ষ: {exam.session_name}
                          </p>
                        )}
                        {exam.total_students && (
                          <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', margin: '4px 0 0' }}>
                            মোট {exam.total_students} জন শিক্ষার্থীর মধ্যে
                          </p>
                        )}
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      icon={<FiPrinter />}
                      onClick={() => handlePrint(exam)}
                      style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', color: '#fff' }}
                    >
                      প্রিন্ট করুন
                    </Button>
                  </div>
                  <div className="result-summary">
                    <div className="result-summary-item">
                      <span>মোট নম্বর</span>
                      <strong>{exam.total_obtained}/{exam.total_marks}</strong>
                    </div>
                    <div className="result-summary-item">
                      <span>শতকরা</span>
                      <strong>{exam.percentage}%</strong>
                    </div>
                  </div>
                </div>
                <div className="result-subjects">
                  <table className="result-table">
                    <thead>
                      <tr><th>বিষয়</th><th>পূর্ণমান</th><th>প্রাপ্ত</th><th>গ্রেড</th></tr>
                    </thead>
                    <tbody>
                      {(exam.subjects || []).map((s, i) => (
                        <tr key={i}>
                          <td>{s.subject_name}</td>
                          <td>{s.total_marks}</td>
                          <td>{s.obtained}</td>
                          <td><Badge variant={gradeVariant(s.grade)}>{s.grade}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
