import { useState, useEffect } from 'react';
import api from '../../services/api';
import Badge from '../../components/Badge';
import { formatDate } from '../../utils/dateFormat';

const categoryColors = {
  'পরীক্ষা': '#1a5c38', 'ছুটি': '#b8860b', 'ভর্তি': '#1a4a8a',
  'ফি': '#8b1a1a', 'রুটিন': '#2e6da4', 'সাধারণ': '#555',
};

const categories = ['সব', 'পরীক্ষা', 'ছুটি', 'ভর্তি', 'ফি', 'রুটিন', 'সাধারণ'];

export default function TeacherNotices() {
  const [notices,  setNotices]  = useState([]);
  const [filter,   setFilter]   = useState('সব');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api.pub('/notices?status=published')
      .then(res => setNotices(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, []);

  const filtered = filter === 'সব' ? notices : notices.filter(n => n.category === filter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 className="page-title">নোটিশ বোর্ড</h1>
        <p className="page-subtitle">সকল প্রকাশিত নোটিশ ও বিজ্ঞপ্তি</p>
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {categories.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)} style={{
            padding: '6px 16px', borderRadius: 20, border: '1.5px solid var(--border)',
            background: filter === cat ? 'var(--primary)' : 'var(--surface)',
            color: filter === cat ? '#fff' : 'var(--text)',
            fontFamily: 'inherit', fontSize: '0.85rem', cursor: 'pointer', fontWeight: filter === cat ? 600 : 400,
          }}>{cat}</button>
        ))}
      </div>

      {/* Notice list */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <p style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>কোনো নোটিশ নেই।</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg)', borderBottom: '1.5px solid var(--border)' }}>
                {['শিরোনাম','বিভাগ','তারিখ','গুরুত্ব'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((n, i) => (
                <tr key={n.id}
                  onClick={() => setExpanded(expanded === n.id ? null : n.id)}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', background: expanded === n.id ? '#f0faf4' : i % 2 === 0 ? '#fff' : 'var(--bg)' }}
                >
                  <td style={{ padding: '12px 16px', fontWeight: 500, color: categoryColors[n.category] || '#333' }}>{n.title}</td>
                  <td style={{ padding: '12px 16px' }}><Badge variant="primary">{n.category}</Badge></td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{formatDate(n.created_at)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {n.is_important == 1 ? <Badge variant="danger">গুরুত্বপূর্ণ</Badge> : <Badge>সাধারণ</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Expanded notice detail */}
      {expanded && (() => {
        const n = notices.find(x => x.id === expanded);
        if (!n) return null;
        return (
          <div className="card" style={{ padding: 24, borderLeft: `4px solid ${categoryColors[n.category] || '#1a5c38'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <Badge variant="primary" style={{ marginBottom: 6 }}>{n.category}</Badge>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>{n.title}</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>{formatDate(n.created_at)}</p>
              </div>
              <button onClick={() => setExpanded(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
            </div>
            <p style={{ fontSize: '0.9rem', lineHeight: 1.8, color: 'var(--text)', whiteSpace: 'pre-wrap' }}
              dangerouslySetInnerHTML={{ __html: n.content }} />
          </div>
        );
      })()}
    </div>
  );
}
