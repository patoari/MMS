import { useState, useEffect } from 'react';
import api from '../services/api';
import NoticeCard from '../components/NoticeCard';
import './NoticePage.css';

const categories = ['সব', 'পরীক্ষা', 'ছুটি', 'ভর্তি', 'ফি', 'রুটিন', 'সাধারণ'];

export default function NoticePage() {
  const [filter, setFilter] = useState('সব');
  const [notices, setNotices] = useState([]);

  useEffect(() => {
    api.pub('/notices').then(res => setNotices(Array.isArray(res.data) ? res.data : [])).catch(() => {});
  }, []);

  const filtered = filter === 'সব' ? notices : notices.filter(n => n.category === filter);

  return (
    <div className="notice-page">
      <div className="notice-page-container">
        <div className="notice-page-header">
          <div className="notice-page-header-arabic">نشرة الإعلانات</div>
          <h1>নোটিশ বোর্ড</h1>
          <p>সকল গুরুত্বপূর্ণ নোটিশ ও বিজ্ঞপ্তি</p>
        </div>
        <div className="notice-filters">
          {categories.map(cat => (
            <button key={cat} className={`notice-filter-btn${filter === cat ? ' active' : ''}`}
              onClick={() => setFilter(cat)}>{cat}</button>
          ))}
        </div>
        <div className="notice-grid">
          {filtered.length === 0 && (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>কোনো নোটিশ নেই।</p>
          )}
          {filtered.map(notice => <NoticeCard key={notice.id} notice={notice} />)}
        </div>
      </div>
    </div>
  );
}
