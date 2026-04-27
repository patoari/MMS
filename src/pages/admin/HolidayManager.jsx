import { useEffect, useState } from 'react';
import api from '../../services/api';
import './HolidayManager.css';

const MONTHS_BN = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
const DAYS_BN   = ['রবিবার','সোমবার','মঙ্গলবার','বুধবার','বৃহস্পতিবার','শুক্রবার','শনিবার'];

export default function HolidayManager() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [holidays, setHolidays]   = useState([]);
  const [fridays, setFridays]     = useState([]);
  const [form, setForm]           = useState({ date: '', title: '', type: 'holiday' });
  const [saving, setSaving]       = useState(false);
  const [toast, setToast]         = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => { loadHolidays(); }, [selectedMonth]);

  const loadHolidays = () => {
    api.get(`/holidays?month=${selectedMonth}`)
      .then(res => {
        setHolidays(res.data?.holidays || []);
        setFridays(res.data?.fridays || []);
      })
      .catch(() => {});
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.date || !form.title.trim()) return;
    setSaving(true);
    try {
      await api.post('/holidays', form);
      showToast('ছুটির দিন যোগ করা হয়েছে');
      setForm({ date: '', title: '', type: 'holiday' });
      loadHolidays();
    } catch (err) {
      showToast(err?.response?.data?.message || 'ব্যর্থ হয়েছে', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (date, title) => {
    if (!window.confirm(`"${title}" মুছে ফেলবেন?`)) return;
    try {
      await api.delete(`/holidays/${date}`);
      showToast('মুছে ফেলা হয়েছে');
      loadHolidays();
    } catch {
      showToast('মুছতে ব্যর্থ', 'error');
    }
  };

  // Build calendar grid
  const [year, month] = selectedMonth.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();
  const holidaySet = new Set(holidays.map(h => h.date));
  const fridaySet  = new Set(fridays);
  const holidayMap = Object.fromEntries(holidays.map(h => [h.date, h]));

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
    cells.push({ d, dateStr });
  }

  return (
    <div className="hm-container">
      {toast && <div className={`hm-toast hm-toast--${toast.type}`}>{toast.msg}</div>}

      <div className="hm-layout">
        {/* Left: Calendar */}
        <div className="hm-left">
          <div className="hm-card">
            <div className="hm-card-header">
              <span>📅 ছুটির ক্যালেন্ডার</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="hm-month-input"
              />
            </div>
            <div className="hm-cal-title">
              {MONTHS_BN[month - 1]} {year}
            </div>
            <div className="hm-cal-grid">
              {DAYS_BN.map(d => <div key={d} className="hm-cal-dow">{d.slice(0, 3)}</div>)}
              {cells.map((cell, i) => {
                if (!cell) return <div key={`e-${i}`} className="hm-cal-cell hm-cal-cell--empty" />;
                const isFriday  = fridaySet.has(cell.dateStr);
                const isDeclared = holidaySet.has(cell.dateStr);
                const h = holidayMap[cell.dateStr];
                return (
                  <div
                    key={cell.dateStr}
                    className={`hm-cal-cell ${isFriday ? 'hm-cal-cell--friday' : ''} ${isDeclared ? 'hm-cal-cell--holiday' : ''}`}
                    title={isFriday ? 'শুক্রবার (স্বয়ংক্রিয় ছুটি)' : h?.title || ''}
                  >
                    <span className="hm-cal-day">{cell.d}</span>
                    {isFriday && <span className="hm-cal-tag hm-cal-tag--fri">শুক্র</span>}
                    {isDeclared && <span className="hm-cal-tag hm-cal-tag--hol">ছুটি</span>}
                  </div>
                );
              })}
            </div>
            <div className="hm-legend">
              <span className="hm-legend-item"><span className="hm-legend-dot hm-legend-dot--fri" />শুক্রবার (স্বয়ংক্রিয়)</span>
              <span className="hm-legend-item"><span className="hm-legend-dot hm-legend-dot--hol" />ঘোষিত ছুটি</span>
            </div>
          </div>
        </div>

        {/* Right: Form + List */}
        <div className="hm-right">
          {/* Add form */}
          <div className="hm-card">
            <div className="hm-card-header">➕ নতুন ছুটি যোগ করুন</div>
            <form className="hm-form" onSubmit={handleAdd}>
              <div className="hm-form-row">
                <div className="hm-field">
                  <label>তারিখ</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="hm-input"
                    required
                  />
                </div>
                <div className="hm-field">
                  <label>ধরন</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="hm-input">
                    <option value="holiday">ছুটির দিন</option>
                    <option value="event">বিশেষ দিন</option>
                  </select>
                </div>
              </div>
              <div className="hm-field">
                <label>কারণ / শিরোনাম</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="যেমন: ঈদুল ফিতর, জাতীয় দিবস..."
                  className="hm-input"
                  required
                />
              </div>
              <button type="submit" className="hm-submit-btn" disabled={saving}>
                {saving ? 'যোগ হচ্ছে...' : '✓ যোগ করুন'}
              </button>
            </form>
          </div>

          {/* Holiday list */}
          <div className="hm-card">
            <div className="hm-card-header">
              <span>📋 {MONTHS_BN[month - 1]} মাসের ছুটির তালিকা</span>
              <span className="hm-badge">{holidays.length + fridays.length} দিন</span>
            </div>

            {fridays.length === 0 && holidays.length === 0 ? (
              <div className="hm-empty">এই মাসে কোনো ছুটি নেই</div>
            ) : (
              <div className="hm-list">
                {/* Fridays */}
                {fridays.map(date => (
                  <div key={date} className="hm-list-item hm-list-item--friday">
                    <div className="hm-list-date">
                      <span className="hm-list-day">{new Date(date + 'T00:00:00').getDate()}</span>
                      <span className="hm-list-dow">{DAYS_BN[new Date(date + 'T00:00:00').getDay()]}</span>
                    </div>
                    <div className="hm-list-info">
                      <span className="hm-list-title">শুক্রবার</span>
                      <span className="hm-list-type hm-list-type--auto">স্বয়ংক্রিয়</span>
                    </div>
                  </div>
                ))}
                {/* Declared holidays */}
                {holidays.map(h => (
                  <div key={h.date} className="hm-list-item hm-list-item--declared">
                    <div className="hm-list-date">
                      <span className="hm-list-day">{new Date(h.date + 'T00:00:00').getDate()}</span>
                      <span className="hm-list-dow">{DAYS_BN[new Date(h.date + 'T00:00:00').getDay()]}</span>
                    </div>
                    <div className="hm-list-info">
                      <span className="hm-list-title">{h.title}</span>
                      <span className={`hm-list-type hm-list-type--${h.type}`}>
                        {h.type === 'holiday' ? 'ছুটির দিন' : 'বিশেষ দিন'}
                      </span>
                    </div>
                    <button className="hm-del-btn" onClick={() => handleDelete(h.date, h.title)} title="মুছুন">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
