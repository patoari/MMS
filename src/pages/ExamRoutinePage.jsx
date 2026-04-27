import { useState, useEffect } from 'react';
import { useRoutine } from '../context/RoutineContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { CLASS_OPTIONS } from '../utils/constants';
import Button from '../components/Button';
import { FiPrinter } from 'react-icons/fi';
import api from '../services/api';
import './RoutinePage.css';

export default function ExamRoutinePage() {
  const { getExamRoutine, fetchExamRoutine } = useRoutine();
  const { settings } = useSiteSettings();
  const [selectedClass,   setSelectedClass]   = useState(CLASS_OPTIONS[0]?.value || '');
  const [sessions,        setSessions]        = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [exams,           setExams]           = useState([]);
  const [selectedExam,    setSelectedExam]    = useState(null);

  // Load sessions
  useEffect(() => {
    api.pub('/sessions/all')
      .then(res => {
        if (Array.isArray(res.data)) {
          setSessions(res.data);
          const cur = res.data.find(s => s.is_current);
          if (cur) setSelectedSession(cur.id);
        }
      }).catch(() => {});
  }, []);

  // Load exams for selected session
  useEffect(() => {
    if (!selectedSession) { setExams([]); setSelectedExam(null); return; }
    api.pub(`/exams/all?session_id=${selectedSession}`)
      .then(res => {
        if (Array.isArray(res.data)) {
          setExams(res.data);
          if (res.data.length > 0) setSelectedExam(res.data[0].id);
          else setSelectedExam(null);
        }
      }).catch(() => {});
  }, [selectedSession]);

  useEffect(() => {
    if (selectedSession) fetchExamRoutine(selectedClass, selectedSession, selectedExam, true);
  }, [selectedClass, selectedSession, selectedExam]);

  const { columns, rows } = getExamRoutine(selectedClass, selectedSession, selectedExam);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const tableHtml = document.querySelector('.exam-routine-table-wrapper').innerHTML;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>পরীক্ষার রুটিন - ${selectedClass}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: A4 landscape; margin: 8mm; }
          body {
            font-family: 'Hind Siliguri', sans-serif;
            background: white;
            width: 277mm;
          }
          .print-header {
            display: flex;
            align-items: center;
            gap: 10px;
            padding-bottom: 6px;
            border-bottom: 2px solid #1a5c38;
            margin-bottom: 6px;
          }
          .print-logo img { width: 44px; height: 44px; object-fit: contain; }
          .print-institution h2 { font-size: 0.95rem; color: #1a5c38; margin-bottom: 1px; }
          .print-name-en { font-size: 0.72rem; color: #555; }
          .print-address  { font-size: 0.68rem; color: #777; }
          .print-title { margin-left: auto; text-align: right; }
          .print-title h3 { font-size: 0.9rem; color: #1a5c38; }
          .print-title p  { font-size: 0.75rem; color: #555; }
          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }
          th, td {
            border: 1px solid #aaa;
            padding: 4px 5px;
            text-align: center;
            font-size: 0.72rem;
            word-break: break-word;
          }
          th {
            background-color: #1a5c38;
            color: white;
            font-weight: 600;
          }
          .subject-name { text-align: left; font-weight: 500; }
        </style>
      </head>
      <body>
        <div class="print-header">
          <div class="print-logo">
            ${settings.logoUrl ? `<img src="${settings.logoUrl}" alt="Logo" />` : ''}
          </div>
          <div class="print-institution">
            <h2>${settings.siteName}</h2>
            ${settings.siteNameEn ? `<p class="print-name-en">${settings.siteNameEn}</p>` : ''}
            ${settings.address ? `<p class="print-address">${settings.address}</p>` : ''}
          </div>
          <div class="print-title">
            <h3>পরীক্ষার রুটিন</h3>
            <p>শ্রেণি: ${selectedClass}</p>
          </div>
        </div>
        ${tableHtml}
      </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <div className="routine-page">
      <div className="routine-container">
        <div className="routine-header no-print">
          <h1>পরীক্ষার রুটিন</h1>
          <p>পরীক্ষার সময়সূচি</p>
        </div>

        {/* Print Header - Only visible when printing */}
        <div className="print-header">
          <div className="print-logo">
            {settings.logoUrl && <img src={settings.logoUrl} alt="Logo" />}
          </div>
          <div className="print-institution">
            <h2>{settings.siteName}</h2>
            {settings.siteNameEn && <p className="print-name-en">{settings.siteNameEn}</p>}
            {settings.address && <p className="print-address">{settings.address}</p>}
          </div>
          <div className="print-title">
            <h3>পরীক্ষার রুটিন</h3>
            <p>শ্রেণি: {selectedClass}</p>
          </div>
        </div>

        {/* Class Filter Tabs */}
        <div className="routine-class-select no-print">
          {/* Session selector */}
          {sessions.length > 0 && (
            <div style={{ width: '100%', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>সেশন:</span>
                <select
                  value={selectedSession || ''}
                  onChange={e => setSelectedSession(e.target.value ? Number(e.target.value) : null)}
                  style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: '0.875rem', fontFamily: 'inherit', cursor: 'pointer' }}
                >
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>{s.name}{s.is_current ? ' (চলমান)' : ''}</option>
                  ))}
                </select>
              </div>
              {exams.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>পরীক্ষা:</span>
                  <select
                    value={selectedExam || ''}
                    onChange={e => setSelectedExam(e.target.value || null)}
                    style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: '0.875rem', fontFamily: 'inherit', cursor: 'pointer' }}
                  >
                    {exams.map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
          {CLASS_OPTIONS.map(c => (
            <button
              key={c.value}
              className={`class-btn${selectedClass === c.value ? ' active' : ''}`}
              onClick={() => setSelectedClass(c.value)}
            >
              {c.label}
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
            {selectedClass} এর পরীক্ষার রুটিন এখনো তৈরি করা হয়নি।
          </p>
        ) : (
          <>
            <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <Button icon={<FiPrinter />} onClick={handlePrint}>প্রিন্ট করুন</Button>
            </div>
            <div className="exam-routine-table-wrapper">
              <table className="routine-table">
                <thead>
                  <tr>
                    {columns.map(col => <th key={col.id}>{col.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.id}>
                      {columns.map(col => (
                        <td key={col.id} className={col.id === 'e3' ? 'subject-name' : ''}>
                          {row.cells[col.id] || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
