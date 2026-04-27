import { useEffect, useState } from 'react';
import api from '../services/api';
import './StudentAttendanceStats.css';

const MONTHS_BN = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];

function RateRing({ rate, size = 72, stroke = 4 }) {
  const r   = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const pct  = rate ?? null;
  const fill = pct !== null ? (circ * pct) / 100 : 0;
  const color = pct === null ? '#cbd5e0' : pct >= 75 ? '#48bb78' : pct >= 50 ? '#f6ad55' : '#fc8181';

  return (
    <div className="sas-ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#edf2f7" strokeWidth={stroke} />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={`${fill} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <span className="sas-ring-label" style={{ color }}>
        {pct !== null ? `${pct}%` : '—'}
      </span>
    </div>
  );
}

export default function StudentAttendanceStats({ studentId, sessionId, classId }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!studentId) return;
    setLoading(true);
    let url = `/attendance/student-stats?student_id=${encodeURIComponent(studentId)}`;
    if (sessionId) url += `&session_id=${sessionId}`;
    if (classId)   url += `&class_id=${classId}`;
    api.get(url)
      .then(res => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [studentId, sessionId, classId]);

  if (loading) return <div className="sas-loading"><div className="sas-loader" /></div>;
  if (!data)   return <div className="sas-empty">হাজিরার তথ্য পাওয়া যায়নি</div>;

  const { weekly, monthly, yearly } = data;
  const monthName = MONTHS_BN[parseInt(monthly.month?.split('-')[1]) - 1] || '';

  const panels = [
    {
      key: 'weekly',
      label: 'সাপ্তাহিক',
      sublabel: 'গত 7 দিন',
      rate: weekly.rate,
      rows: [
        { label: 'উপস্থিত',        val: weekly.present,       color: '#48bb78' },
        { label: 'অনুপস্থিত',      val: weekly.absent,        color: '#fc8181' },
        { label: 'ছুটি',            val: weekly.excused,       color: '#63b3ed' },
        { label: 'কার্যদিবস',      val: weekly.working_days,  color: '#667eea' },
        { label: 'হাজিরা নেওয়া হয়নি', val: weekly.not_recorded, color: '#a0aec0' },
      ],
    },
    {
      key: 'monthly',
      label: 'মাসিক',
      sublabel: monthName,
      rate: monthly.rate,
      rows: [
        { label: 'উপস্থিত',        val: monthly.present,       color: '#48bb78' },
        { label: 'অনুপস্থিত',      val: monthly.absent,        color: '#fc8181' },
        { label: 'ছুটি',            val: monthly.excused,       color: '#63b3ed' },
        { label: 'কার্যদিবস',      val: monthly.working_days,  color: '#667eea' },
        { label: 'হাজিরা নেওয়া হয়নি', val: monthly.not_recorded, color: '#a0aec0' },
      ],
    },
    {
      key: 'yearly',
      label: 'বার্ষিক',
      sublabel: yearly.year,
      rate: yearly.rate,
      rows: [
        { label: 'উপস্থিত',        val: yearly.present,       color: '#48bb78' },
        { label: 'অনুপস্থিত',      val: yearly.absent,        color: '#fc8181' },
        { label: 'ছুটি',            val: yearly.excused,       color: '#63b3ed' },
        { label: 'কার্যদিবস',      val: yearly.working_days,  color: '#667eea' },
        { label: 'হাজিরা নেওয়া হয়নি', val: yearly.not_recorded, color: '#a0aec0' },
      ],
    },
  ];

  return (
    <div className="sas-container">
      {panels.map(p => (
        <div key={p.key} className="sas-panel">
          <div className="sas-panel-head">
            <div>
              <div className="sas-panel-title">{p.label}</div>
              <div className="sas-panel-sub">{p.sublabel}</div>
            </div>
            <RateRing rate={p.rate} />
          </div>
          <div className="sas-rows">
            {p.rows.map(row => (
              <div key={row.label} className="sas-row">
                <span className="sas-row-label">{row.label}</span>
                <span className="sas-row-val" style={{ color: row.color }}>{row.val}</span>
              </div>
            ))}
          </div>
          {p.rate === null && p.rows.find(r => r.label === 'কার্যদিবস')?.val > 0 && (
            <div className="sas-no-data">এই সময়ে হাজিরা নেওয়া হয়নি</div>
          )}
        </div>
      ))}
    </div>
  );
}
