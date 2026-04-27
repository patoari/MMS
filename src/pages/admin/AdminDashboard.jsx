import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiUsers, FiDollarSign, FiAlertCircle, FiBell, FiTrendingUp,
  FiTrendingDown, FiActivity, FiUser, FiArrowRight,
} from 'react-icons/fi';
import Badge from '../../components/Badge';
import { useStudents } from '../../context/StudentContext';
import api from '../../services/api';
import { useIslamicGreeting } from '../../hooks/useIslamicGreeting';
import { formatDate } from '../../utils/dateFormat';
import './AdminDashboard.css';

const fmt = (n) => `৳${Number(n || 0).toLocaleString()}`;

function StatCard({ icon, label, value, sub, color, to }) {
  const inner = (
    <div className={`dash-stat-card dash-stat-${color}`}>
      <div className="dsc-icon">{icon}</div>
      <div className="dsc-body">
        <div className="dsc-value">{value}</div>
        <div className="dsc-label">{label}</div>
        {sub && <div className="dsc-sub">{sub}</div>}
      </div>
    </div>
  );
  return to ? <Link to={to} style={{ textDecoration: 'none' }}>{inner}</Link> : inner;
}

function Bar({ value, max, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="dash-progress-bar">
      <div className="dash-progress-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export default function AdminDashboard() {
  useIslamicGreeting();
  const { students } = useStudents();
  const [fin, setFin]         = useState(null);
  const [notices, setNotices] = useState([]);
  const [teachers, setTeachers] = useState([]);

  useEffect(() => {
    api.get('/transactions/summary').then(r => setFin(r.data)).catch(() => {});
    api.get('/notices').then(r => setNotices(Array.isArray(r.data) ? r.data.slice(0, 4) : [])).catch(() => {});
    api.get('/teachers').then(r => setTeachers(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  const today = formatDate(new Date().toISOString());

  const totalIncome  = Number(fin?.total_income  || 0);
  const totalExpense = Number(fin?.total_expense || 0);
  const net          = Number(fin?.net           || 0);
  const feeDue       = Number(fin?.fee_due       || 0);
  const salaryDue    = Number(fin?.salary_due    || 0);
  const incomeCats   = fin?.income_categories  || [];
  const expenseCats  = fin?.expense_categories || [];
  const trend        = fin?.trend              || [];
  const maxTrend     = Math.max(...trend.map(t => Math.max(Number(t.income), Number(t.expense))), 1);
  const activeTeachers = teachers.filter(t => t.status === 'সক্রিয়').length;

  return (
    <div className="admin-dashboard">

      {/* Welcome */}
      <div className="dashboard-welcome">
        <div>
          <h1>আস-সালামু আলাইকুম 👋</h1>
          <p>ধামালকোট মোহাম্মাদীয়া মাদ্রাসা ব্যবস্থাপনা সিস্টেমে স্বাগতম</p>
        </div>
        <div className="dashboard-date">আজকের তারিখ: {today}</div>
      </div>

      {/* 8 stat cards */}
      <div className="dash-stats-grid">
        <StatCard icon={<FiUsers />}        label="মোট শিক্ষার্থী"  value={students.length}                       sub="সক্রিয়"                    color="primary" to="/admin/students" />
        <StatCard icon={<FiUser />}         label="মোট শিক্ষক"      value={activeTeachers || teachers.length}     sub="সক্রিয়"                    color="indigo"  to="/admin/teachers" />
        <StatCard icon={<FiTrendingUp />}   label="মোট আয়"          value={fmt(totalIncome)}                      sub="ফি + অনুদান সহ"             color="success" to="/admin/transactions" />
        <StatCard icon={<FiTrendingDown />} label="মোট ব্যয়"         value={fmt(totalExpense)}                     sub="বেতন + সকল ব্যয়"           color="danger"  to="/admin/transactions" />
        <StatCard icon={<FiActivity />}     label="নিট ব্যালেন্স"    value={fmt(Math.abs(net))}                    sub={net >= 0 ? 'উদ্বৃত্ত' : 'ঘাটতি'} color={net >= 0 ? 'teal' : 'orange'} />
        <StatCard icon={<FiAlertCircle />}  label="বকেয়া ফি"         value={fmt(feeDue)}                           sub="আদায় বাকি"                  color="warning" to="/admin/fees" />
        <StatCard icon={<FiDollarSign />}   label="বকেয়া বেতন"       value={fmt(salaryDue)}                        sub="প্রদান বাকি"                 color="rose"    to="/admin/salary" />
        <StatCard icon={<FiBell />}         label="নোটিশ"            value={notices.length}                        sub="সক্রিয়"                    color="gold"    to="/admin/notices" />
      </div>

      {/* Finance panels */}
      <div className="dash-finance-row">

        {/* Income breakdown */}
        <div className="dash-card">
          <div className="dash-card-header">
            <span><FiTrendingUp /> আয়ের উৎস</span>
            <Link to="/admin/transactions" className="dash-link">বিস্তারিত <FiArrowRight size={12} /></Link>
          </div>
          {incomeCats.length === 0
            ? <p className="dash-empty">কোনো তথ্য নেই</p>
            : (
              <div className="dash-breakdown-list">
                {incomeCats.map(({ category, total, source }) => (
                  <div key={category} className="dash-breakdown-row">
                    <div className="dbr-dot" style={{ background: source === 'fee' ? '#6366f1' : '#10b981' }} />
                    <span className="dbr-label">{category}</span>
                    <Bar value={total} max={totalIncome || 1} color={source === 'fee' ? '#6366f1' : '#10b981'} />
                    <span className="dbr-val">{fmt(total)}</span>
                  </div>
                ))}
                <div className="dash-due-row"><span>বকেয়া ফি</span><strong>{fmt(feeDue)}</strong></div>
              </div>
            )
          }
        </div>

        {/* Expense breakdown */}
        <div className="dash-card">
          <div className="dash-card-header">
            <span><FiTrendingDown /> ব্যয়ের খাত</span>
            <Link to="/admin/transactions" className="dash-link">বিস্তারিত <FiArrowRight size={12} /></Link>
          </div>
          {expenseCats.length === 0
            ? <p className="dash-empty">কোনো তথ্য নেই</p>
            : (
              <div className="dash-breakdown-list">
                {expenseCats.map(({ category, total, source }) => (
                  <div key={category} className="dash-breakdown-row">
                    <div className="dbr-dot" style={{ background: source === 'salary' ? '#ef4444' : '#f87171' }} />
                    <span className="dbr-label">{category}</span>
                    <Bar value={total} max={totalExpense || 1} color={source === 'salary' ? '#ef4444' : '#f87171'} />
                    <span className="dbr-val">{fmt(total)}</span>
                  </div>
                ))}
                <div className="dash-due-row"><span>বকেয়া বেতন</span><strong>{fmt(salaryDue)}</strong></div>
              </div>
            )
          }
        </div>

        {/* Net + trend */}
        <div className="dash-card">
          <div className="dash-card-header"><span><FiActivity /> সারসংক্ষেপ</span></div>
          <div className="dash-compare">
            <div className="dash-compare-item">
              <div className="dci-top"><span className="dci-label">মোট আয়</span><span className="dci-val income">{fmt(totalIncome)}</span></div>
              <Bar value={totalIncome} max={Math.max(totalIncome, totalExpense) || 1} color="#10b981" />
            </div>
            <div className="dash-compare-item">
              <div className="dci-top"><span className="dci-label">মোট ব্যয়</span><span className="dci-val expense">{fmt(totalExpense)}</span></div>
              <Bar value={totalExpense} max={Math.max(totalIncome, totalExpense) || 1} color="#ef4444" />
            </div>
            <div className={`dash-net-box ${net >= 0 ? 'positive' : 'negative'}`}>
              <span>নিট ব্যালেন্স</span>
              <strong>{fmt(Math.abs(net))} {net >= 0 ? '(উদ্বৃত্ত)' : '(ঘাটতি)'}</strong>
            </div>
          </div>

          {/* Mini trend */}
          {trend.length > 0 && (
            <>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 8 }}>মাসিক ধারা</div>
              <div className="dash-trend-chart">
                {trend.map(t => (
                  <div key={t.month_key} className="dtc-col">
                    <div className="dtc-bar-wrap">
                      <div style={{ width: '100%', display: 'flex', alignItems: 'flex-end', gap: 1, height: '100%' }}>
                        <div className="dtc-bar" style={{ height: `${Math.round((Number(t.income) / maxTrend) * 100)}%`, background: '#10b981' }} />
                        <div className="dtc-bar" style={{ height: `${Math.round((Number(t.expense) / maxTrend) * 100)}%`, background: '#ef4444' }} />
                      </div>
                    </div>
                    <div className="dtc-label">{t.month_key?.slice(5)}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#10b981', marginRight: 4 }} />আয়</span>
                <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#ef4444', marginRight: 4 }} />ব্যয়</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="dashboard-grid-2">
        <div className="dash-card">
          <div className="dash-card-header">
            <span><FiUsers /> সাম্প্রতিক শিক্ষার্থী</span>
            <Link to="/admin/students" className="dash-link">সব দেখুন <FiArrowRight size={12} /></Link>
          </div>
          <div className="student-list">
            {students.slice(0, 5).map(s => (
              <div key={s.id} className="student-list-item">
                <div className="student-avatar">{s.name?.[0]}</div>
                <div className="student-info">
                  <div className="student-name">{s.name}</div>
                  <div className="student-meta">{s.id} · {s.class_name || s.class}</div>
                </div>
                <Badge variant="success">{s.status || 'সক্রিয়'}</Badge>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="dash-card">
            <div className="dash-card-header">
              <span><FiBell /> সাম্প্রতিক নোটিশ</span>
              <Link to="/admin/notices" className="dash-link">সব দেখুন <FiArrowRight size={12} /></Link>
            </div>
            <div className="notice-list">
              {notices.map(n => (
                <div key={n.id} className="notice-list-item">
                  <div className="notice-list-dot" style={{ background: n.is_important == 1 ? 'var(--danger)' : 'var(--primary)' }} />
                  <div>
                    <div className="notice-list-title">{n.title}</div>
                    <div className="notice-list-date">{formatDate(n.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick finance table */}
          <div className="dash-card">
            <div className="dash-card-header">
              <span><FiDollarSign /> আয় ও ব্যয় সারসংক্ষেপ</span>
              <Link to="/admin/transactions" className="dash-link">বিস্তারিত <FiArrowRight size={12} /></Link>
            </div>
            <table className="dash-cat-table">
              <thead><tr><th>বিভাগ</th><th>ধরন</th><th>পরিমাণ</th></tr></thead>
              <tbody>
                {[...incomeCats.slice(0, 4), ...expenseCats.slice(0, 4)].map((c, i) => (
                  <tr key={i}>
                    <td>{c.category}</td>
                    <td><Badge variant={incomeCats.includes(c) ? 'success' : 'danger'}>{incomeCats.includes(c) ? 'আয়' : 'ব্যয়'}</Badge></td>
                    <td style={{ fontWeight: 600, color: incomeCats.includes(c) ? 'var(--success)' : 'var(--danger)' }}>{fmt(c.total)}</td>
                  </tr>
                ))}
                {incomeCats.length === 0 && expenseCats.length === 0 && (
                  <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 16 }}>কোনো তথ্য নেই</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
