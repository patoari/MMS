import { useState, useEffect } from 'react';
import { useRoutine } from '../context/RoutineContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { CLASS_OPTIONS } from '../utils/constants';
import Button from '../components/Button';
import { FiPrinter } from 'react-icons/fi';
import api from '../services/api';
import './RoutinePage.css';

export default function ClassRoutinePage() {
  const { getClassRoutine, fetchClassRoutine } = useRoutine();
  const { settings } = useSiteSettings();
  const [selectedClass,   setSelected]        = useState(CLASS_OPTIONS[0]?.value || '');
  const [sessions,        setSessions]        = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);

  // Load sessions on mount
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

  useEffect(() => {
    if (selectedSession) fetchClassRoutine(selectedClass, selectedSession, true);
  }, [selectedClass, selectedSession]);

  const { columns, rows } = getClassRoutine(selectedClass, selectedSession);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const tableHtml = document.querySelector('.routine-table-wrapper')?.innerHTML || '';
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>ক্লাস রুটিন - ${selectedClass}</title>
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
          .print-logo img {
            width: 44px; height: 44px;
            object-fit: contain;
          }
          .print-institution h2 {
            font-size: 0.95rem;
            color: #1a5c38;
            margin-bottom: 1px;
          }
          .print-name-en { font-size: 0.72rem; color: #555; }
          .print-address  { font-size: 0.68rem; color: #777; }
          .print-title {
            margin-left: auto;
            text-align: right;
          }
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
            font-size: 0.72rem;
          }
          .day-cell {
            background-color: #e8f5ee;
            color: #1a5c38;
            font-weight: 700;
            white-space: nowrap;
            width: 60px;
          }
          .leisure-th, .leisure-cell { background-color: #fff8e1; }
          .leisure-badge {
            background-color: #ffc107;
            color: #000;
            padding: 1px 4px;
            border-radius: 2px;
            font-size: 0.62rem;
          }
          .period-time {
            font-size: 0.6rem;
            opacity: 0.85;
            display: block;
            margin-top: 1px;
          }
          .subject-cell div:first-child { font-weight: 600; }
          .subject-cell div:last-child  { font-size: 0.62rem; color: #444; margin-top: 1px; }
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
            <h3>ক্লাস রুটিন</h3>
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
          <h1>ক্লাস রুটিন</h1>
          <p>সাপ্তাহিক ক্লাস সময়সূচি</p>
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
            <h3>ক্লাস রুটিন</h3>
            <p>শ্রেণি: {selectedClass}</p>
          </div>
        </div>

        <div className="routine-class-select no-print">
          {/* Session selector */}
          {sessions.length > 0 && (
            <div style={{ width: '100%', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
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
          )}
          {CLASS_OPTIONS.map(c => (
            <button key={c.value} className={`class-btn${selectedClass === c.value ? ' active' : ''}`}
              onClick={() => setSelected(c.value)}>{c.label}</button>
          ))}
        </div>
        {rows.length === 0 || columns.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>এই শ্রেণির রুটিন এখনো তৈরি করা হয়নি।</p>
        ) : (
          <>
            <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <Button icon={<FiPrinter />} onClick={handlePrint}>প্রিন্ট করুন</Button>
            </div>
            <div className="routine-table-wrapper">
              <table className="routine-table">
                <thead>
                  <tr>
                    <th>দিন</th>
                    {columns.map(col => (
                      <th key={col.id} className={col.leisure ? 'leisure-th' : ''}>
                        <div>{col.label}</div>
                        {col.time && <div className="period-time">{col.time}</div>}
                        {col.leisure && <div className="leisure-badge">বিরতি</div>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.id}>
                      <td className="day-cell">{row.day}</td>
                      {columns.map(col => {
                        const cellData = row.cells[col.id];
                        const subject = typeof cellData === 'string' ? cellData : cellData?.subject;
                        const teacher = typeof cellData === 'object' ? cellData?.teacher : null;
                        
                        return (
                          <td key={col.id} className={`subject-cell${col.leisure ? ' leisure-cell' : ''}`}>
                            {col.leisure ? (
                              <span style={{ color: '#ccc' }}>—</span>
                            ) : subject ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <div style={{ fontWeight: 600 }}>{subject}</div>
                                {teacher && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{teacher}</div>}
                              </div>
                            ) : (
                              <span style={{ color: '#ccc' }}>—</span>
                            )}
                          </td>
                        );
                      })}
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
