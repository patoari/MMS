import { useEffect, useState } from 'react';
import api from '../../services/api';
import Badge from '../../components/Badge';

export default function StudentResult() {
  const [results, setResults] = useState([]);

  useEffect(() => {
    api.get('/results/my').then(res => setResults(Array.isArray(res.data) ? res.data : [])).catch(() => {});
  }, []);

  if (results.length === 0) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 className="page-title">আমার ফলাফল</h1>
      <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>📋</div>
        <p>এখনো কোনো ফলাফল প্রকাশিত হয়নি</p>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 className="page-title">আমার ফলাফল</h1>
      {results.map(result => (
        <div key={result.exam_id} className="card">
          <div style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', margin: '-24px -24px 24px', padding: 24, borderRadius: '12px 12px 0 0', color: '#fff' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>{result.exam_name}</h2>
            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
              {[['মোট নম্বর', `${result.total_obtained}/${result.total_marks}`], ['শতকরা', `${result.percentage}%`]].map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>{k}</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                {['বিষয়', 'পূর্ণমান', 'প্রাপ্ত নম্বর', 'গ্রেড'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(result.subjects || []).map((s, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 500 }}>{s.subject_name}</td>
                  <td style={{ padding: '10px 14px' }}>{s.total_marks}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 600 }}>{s.obtained}</td>
                  <td style={{ padding: '10px 14px' }}><Badge variant="success">{s.grade}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
