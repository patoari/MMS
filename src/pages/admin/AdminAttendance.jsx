import { useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import { formatDate } from '../../utils/dateFormat';
import './AdminAttendance.css';

const MONTHS_BN = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];

const STATUS_LABEL = { present: 'উপস্থিত', absent: 'অনুপস্থিত', excused: 'ছুটি' };
const STATUS_COLOR = { present: '#48bb78', absent: '#fc8181', excused: '#63b3ed' };

export default function AdminAttendance() {
  const [sessions, setSessions]     = useState([]);
  const [classes, setClasses]       = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedClass, setSelectedClass]     = useState('');
  const [selectedDate, setSelectedDate]       = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth]     = useState(new Date().toISOString().slice(0, 7));
  const [tab, setTab]               = useState('daily');   // 'daily' | 'report'
  const [dailyData, setDailyData]   = useState({});
  const [students, setStudents]     = useState([]);
  const [report, setReport]         = useState([]);
  const [reportMeta, setReportMeta] = useState(null);
  const [loading, setLoading]       = useState(false);
  const printRef = useRef();

  useEffect(() => {
    Promise.all([api.get('/sessions'), api.get('/classes')]).then(([sRes, cRes]) => {
      const sess = Array.isArray(sRes.data) ? sRes.data : [];
      const cls  = Array.isArray(cRes.data) ? cRes.data : [];
      setSessions(sess);
      setClasses(cls);
      const cur = sess.find(s => s.is_current == 1);
      if (cur) setSelectedSession(String(cur.id));
      if (cls.length) setSelectedClass(cls[0].name);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedClass || !selectedSession) return;
    if (tab === 'daily') loadDaily();
    else loadReport();
  }, [selectedClass, selectedSession, selectedDate, selectedMonth, tab]);

  const loadDaily = () => {
    setLoading(true);
    Promise.all([
      api.get(`/students?class=${encodeURIComponent(selectedClass)}&limit=200`),
      api.get(`/attendance?class=${encodeURIComponent(selectedClass)}&date=${selectedDate}&session_id=${selectedSession}`)
    ]).then(([sRes, aRes]) => {
      const list = Array.isArray(sRes.data) ? sRes.data : [];
      setStudents(list.sort((a, b) => a.roll - b.roll));
      setDailyData(aRes.data?.attendance || {});
    }).catch(() => {}).finally(() => setLoading(false));
  };

  const loadReport = () => {
    setLoading(true);
    api.get(`/attendance/report?class=${encodeURIComponent(selectedClass)}&month=${selectedMonth}&session_id=${selectedSession}`)
      .then(res => {
        setReport(res.data?.report || []);
        setReportMeta({ session: res.data?.session, month: res.data?.month, class: res.data?.class, working_days: res.data?.working_days || 0 });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open('', '_blank');
    const monthLabel = (() => {
      const [y, m] = selectedMonth.split('-');
      return `${MONTHS_BN[parseInt(m) - 1]} ${y}`;
    })();
    const sessionLabel = sessions.find(s => String(s.id) === selectedSession);
    win.document.write(`
      <!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>হাজিরা রিপোর্ট - ${selectedClass} - ${monthLabel}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;600;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Noto Sans Bengali', sans-serif; font-size: 12px; color: #1a202c; padding: 20px; }
        .print-header { text-align: center; margin-bottom: 18px; border-bottom: 2px solid #2d3748; padding-bottom: 12px; }
        .print-header h1 { font-size: 18px; font-weight: 700; color: #1a202c; }
        .print-header p  { font-size: 12px; color: #4a5568; margin-top: 4px; }
        .print-meta { display: flex; justify-content: space-between; margin-bottom: 14px; font-size: 11px; color: #4a5568; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #2d3748; color: #fff; padding: 7px 10px; text-align: left; font-size: 11px; }
        td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
        tr:nth-child(even) td { background: #f7fafc; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; }
        .badge-present { background: #c6f6d5; color: #276749; }
        .badge-absent  { background: #fed7d7; color: #c53030; }
        .badge-late    { background: #feebc8; color: #c05621; }
        .badge-excused { background: #bee3f8; color: #2b6cb0; }
        .rate-bar { display: inline-block; width: 60px; height: 8px; background: #e2e8f0; border-radius: 4px; vertical-align: middle; margin-right: 4px; overflow: hidden; }
        .rate-fill { height: 100%; background: #48bb78; border-radius: 4px; }
        .summary-row td { font-weight: 700; background: #edf2f7 !important; }
        .print-footer { margin-top: 20px; text-align: right; font-size: 10px; color: #a0aec0; }
        @media print {
          body { padding: 10px; }
          @page { margin: 1cm; }
        }
      </style>
      </head><body>
      <div class="print-header">
        <h1>মাসিক হাজিরা রিপোর্ট</h1>
        <p>${selectedClass} &nbsp;|&nbsp; ${monthLabel} &nbsp;|&nbsp; ${sessionLabel ? sessionLabel.name + ' (' + sessionLabel.year + ')' : ''}</p>
      </div>
      ${content}
      <div class="print-footer">মুদ্রণের তারিখ: ${formatDate(new Date().toISOString())}</div>
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  // Daily stats
  const dailyStats = students.reduce((acc, s) => {
    const st = dailyData[s.id]?.status || 'present';
    acc[st] = (acc[st] || 0) + 1;
    acc.total++;
    return acc;
  }, { present: 0, absent: 0, excused: 0, total: 0 });
  const dailyRate = dailyStats.total > 0 ? Math.round((dailyStats.present / dailyStats.total) * 100) : 0;

  // Report totals
  const reportTotals = report.reduce((acc, r) => {
    acc.present += Number(r.present_days);
    acc.absent  += Number(r.absent_days);
    acc.excused += Number(r.excused_days);
    acc.total   += Number(r.total_days);
    return acc;
  }, { present: 0, absent: 0, excused: 0, total: 0 });

  const monthLabel = (() => {
    const [y, m] = selectedMonth.split('-');
    return `${MONTHS_BN[parseInt(m) - 1]} ${y}`;
  })();

  return (
    <div className="adatt-container">
      {/* Controls */}
      <div className="adatt-controls-bar">
        <div className="adatt-tabs">
          <button className={`adatt-tab ${tab === 'daily' ? 'adatt-tab--active' : ''}`} onClick={() => setTab('daily')}>
            📅 দৈনিক হাজিরা
          </button>
          <button className={`adatt-tab ${tab === 'report' ? 'adatt-tab--active' : ''}`} onClick={() => setTab('report')}>
            📊 মাসিক রিপোর্ট
          </button>
        </div>
        <div className="adatt-filters">
          <select value={selectedSession} onChange={e => setSelectedSession(e.target.value)} className="adatt-select">
            {sessions.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.year}){s.is_current == 1 ? ' ★' : ''}</option>
            ))}
          </select>
          <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="adatt-select">
            {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          {tab === 'daily'
            ? <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="adatt-input" max={new Date().toISOString().split('T')[0]} />
            : <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="adatt-input" />
          }
          {tab === 'report' && (
            <button className="adatt-print-btn" onClick={handlePrint}>
              🖨️ প্রিন্ট করুন
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="adatt-loading"><div className="adatt-loader" /><p>লোড হচ্ছে...</p></div>
      ) : tab === 'daily' ? (
        <>
          {/* Daily stats */}
          <div className="adatt-stats">
            <div className="adatt-stat adatt-stat--rate">
              <div className="adatt-ring">
                <svg viewBox="0 0 36 36">
                  <path className="adatt-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path className="adatt-ring-fill" strokeDasharray={`${dailyRate}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
                <span className="adatt-ring-text">{dailyRate}%</span>
              </div>
              <p>উপস্থিতির হার</p>
            </div>
            {[['present','উপস্থিত'],['absent','অনুপস্থিত'],['excused','ছুটি'],['total','মোট']].map(([k, label]) => (
              <div key={k} className={`adatt-stat adatt-stat--${k}`}>
                <span className="adatt-stat-val">{dailyStats[k]}</span>
                <p>{label}</p>
              </div>
            ))}
          </div>

          {/* Daily table */}
          <div className="adatt-card">
            <div className="adatt-card-header">
              <span>📋 {selectedClass} — {formatDate(selectedDate)}</span>
              <span className="adatt-count">{students.length} জন শিক্ষার্থী</span>
            </div>
            {students.length === 0 ? (
              <div className="adatt-empty">কোনো শিক্ষার্থী পাওয়া যায়নি</div>
            ) : (
              <div className="adatt-table-wrap">
                <table className="adatt-table">
                  <thead>
                    <tr><th>রোল</th><th>নাম</th><th>আইডি</th><th>অবস্থা</th><th>মন্তব্য</th></tr>
                  </thead>
                  <tbody>
                    {students.map((s, i) => {
                      const status = dailyData[s.id]?.status || 'present';
                      const note   = dailyData[s.id]?.note || '—';
                      return (
                        <tr key={s.id} className={`adatt-row adatt-row--${status} ${i % 2 === 0 ? 'adatt-row--even' : ''}`}>
                          <td className="adatt-roll">{s.roll}</td>
                          <td className="adatt-name">{s.name}</td>
                          <td className="adatt-id">{s.id}</td>
                          <td>
                            <span className="adatt-badge" style={{ background: STATUS_COLOR[status] + '22', color: STATUS_COLOR[status], border: `1px solid ${STATUS_COLOR[status]}55` }}>
                              {STATUS_LABEL[status]}
                            </span>
                          </td>
                          <td className="adatt-note">{note}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Report summary stats */}
          <div className="adatt-stats">
            <div className="adatt-stat adatt-stat--present">
              <span className="adatt-stat-val">{reportTotals.present}</span><p>মোট উপস্থিত</p>
            </div>
            <div className="adatt-stat adatt-stat--absent">
              <span className="adatt-stat-val">{reportTotals.absent}</span><p>মোট অনুপস্থিত</p>
            </div>
            <div className="adatt-stat adatt-stat--excused">
              <span className="adatt-stat-val">{reportTotals.excused}</span><p>মোট ছুটি</p>
            </div>
            <div className="adatt-stat adatt-stat--total">
              <span className="adatt-stat-val">{report.length}</span><p>শিক্ষার্থী সংখ্যা</p>
            </div>
          </div>

          {/* Printable report */}
          <div className="adatt-card">
            <div className="adatt-card-header">
              <span>📊 {selectedClass} — {monthLabel} মাসের হাজিরা রিপোর্ট</span>
              <button className="adatt-print-btn-sm" onClick={handlePrint}>🖨️ প্রিন্ট</button>
            </div>

            {report.length === 0 ? (
              <div className="adatt-empty">এই মাসে কোনো হাজিরা তথ্য পাওয়া যায়নি</div>
            ) : (
              <div className="adatt-table-wrap" ref={printRef}>
                <div className="adatt-print-meta">
                  <span>শ্রেণি: <strong>{selectedClass}</strong></span>
                  <span>মাস: <strong>{monthLabel}</strong></span>
                  <span>মোট শিক্ষার্থী: <strong>{report.length}</strong></span>
                  <span>মোট কার্যদিবস: <strong>{reportMeta?.working_days ?? report[0]?.working_days ?? 0}</strong></span>
                </div>
                <table className="adatt-table">
                  <thead>
                    <tr>
                      <th>রোল</th>
                      <th>নাম</th>
                      <th>উপস্থিত</th>
                      <th>অনুপস্থিত</th>
                      <th>ছুটি</th>
                      <th>মোট দিন</th>
                      <th>উপস্থিতির হার</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.map((r, i) => {
                      const pct = Number(r.attendance_percentage) || 0;
                      const color = pct >= 75 ? '#48bb78' : pct >= 50 ? '#f6ad55' : '#fc8181';
                      return (
                        <tr key={r.id} className={`adatt-row ${i % 2 === 0 ? 'adatt-row--even' : ''}`}>
                          <td className="adatt-roll">{r.roll}</td>
                          <td className="adatt-name">{r.name}</td>
                          <td><span className="adatt-badge" style={{ background: '#c6f6d5', color: '#276749' }}>{r.present_days}</span></td>
                          <td><span className="adatt-badge" style={{ background: '#fed7d7', color: '#c53030' }}>{r.absent_days}</span></td>
                          <td><span className="adatt-badge" style={{ background: '#bee3f8', color: '#2b6cb0' }}>{r.excused_days}</span></td>
                          <td>{r.total_days}</td>
                          <td>
                            <div className="adatt-rate-wrap">
                              <div className="adatt-rate-bar">
                                <div className="adatt-rate-fill" style={{ width: `${pct}%`, background: color }} />
                              </div>
                              <span style={{ color, fontWeight: 600 }}>{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {/* Totals row */}
                    <tr className="adatt-totals-row">
                      <td colSpan={2}>মোট</td>
                      <td>{reportTotals.present}</td>
                      <td>{reportTotals.absent}</td>
                      <td>{reportTotals.excused}</td>
                      <td>{reportTotals.total}</td>
                      <td>
                        {reportTotals.total > 0
                          ? `${Math.round((reportTotals.present / reportTotals.total) * 100)}%`
                          : '—'}
                      </td>
                    </tr>
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
