import { useState, useEffect } from 'react';
import api from '../../services/api';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import { formatDate } from '../../utils/dateFormat';
import { FiTrendingUp, FiTrendingDown, FiActivity, FiFilter, FiTrash2 } from 'react-icons/fi';
import swal from '../../utils/swal';
import Pagination from '../../components/Pagination';
import './Transactions.css';

const INCOME_CATS  = ['দান/অনুদান','সরকারি অনুদান','ব্যাংক সুদ','অন্যান্য আয়'];
const EXPENSE_CATS = ['কর্মচারী বেতন','বোর্ডিং খাবার','বিদ্যুৎ বিল','পানি বিল','গ্যাস বিল','মেরামত ও রক্ষণাবেক্ষণ','স্টেশনারি ও বই','পরিবহন','চিকিৎসা','অনুষ্ঠান ব্যয়','অন্যান্য ব্যয়'];

const fmt = (n) => `৳${Number(n || 0).toLocaleString()}`;

const SOURCE_LABEL = { fee: 'ছাত্র ফি', salary: 'বেতন', manual: 'ম্যানুয়াল' };
const SOURCE_COLOR = { fee: 'info', salary: 'danger', manual: 'secondary' };

export default function Transactions() {
  const [ledger, setLedger]       = useState([]);
  const [summary, setSummary]     = useState(null);
  const [showModal, setModal]     = useState(false);
  const [typeFilter, setType]     = useState('all');
  const [loading, setLoading]     = useState(true);
  const [customCat, setCustomCat] = useState('');
  const [page, setPage]           = useState(1);
  const PER_PAGE = 20;
  const [form, setForm]         = useState({
    type: 'income', category: '', amount: '', description: '',
    date: new Date().toISOString().slice(0, 10), voucher_no: '',
  });

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      api.get('/transactions/ledger').then(res => setLedger(Array.isArray(res.data) ? res.data : [])),
      api.get('/transactions/summary').then(res => setSummary(res.data)),
    ]).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  const openModal = (type = 'income') => {
    setForm({ type, category: '', amount: '', description: '', date: new Date().toISOString().slice(0, 10), voucher_no: '' });
    setCustomCat('');
    setModal(true);
  };

  const onSave = async () => {
    const finalCategory = form.category === '__custom__' ? customCat.trim() : form.category;
    if (!finalCategory || !form.amount || !form.date) { await swal.error('সব তথ্য পূরণ করুন'); return; }
    try {
      await api.post('/transactions', { ...form, category: finalCategory, amount: Number(form.amount) });
      swal.success('লেনদেন সংরক্ষিত হয়েছে');
      setModal(false); fetchAll();
    } catch (e) { await swal.error(e.message); }
  };

  const onDelete = async (idx) => {
    const row = ledger[idx];
    if (row.source !== 'manual') { await swal.error('শুধুমাত্র ম্যানুয়াল এন্ট্রি মুছা যাবে।'); return; }
    const ok = await swal.confirm('লেনদেন মুছবেন?', 'এই রেকর্ডটি স্থায়ীভাবে মুছে যাবে।');
    if (!ok) return;
    // find id from manual transactions list
    try {
      const manual = await api.get('/transactions');
      const match = (manual.data || []).find(t =>
        t.category === row.category && t.amount == row.amount && t.date === row.date
      );
      if (match) { await api.delete(`/transactions/${match.id}`); swal.success('মুছে ফেলা হয়েছে'); fetchAll(); }
    } catch (e) { await swal.error(e.message); }
  };

  const totalIncome  = Number(summary?.total_income  || 0);
  const totalExpense = Number(summary?.total_expense || 0);
  const net          = Number(summary?.net           || 0);
  const feeDue       = Number(summary?.fee_due       || 0);
  const salaryDue    = Number(summary?.salary_due    || 0);

  const incomeCats  = summary?.income_categories  || [];
  const expenseCats = summary?.expense_categories || [];
  const trend       = summary?.trend              || [];
  const maxTrend    = Math.max(...trend.map(t => Math.max(Number(t.income), Number(t.expense))), 1);

  const filtered = typeFilter === 'all' ? ledger : ledger.filter(t => t.type === typeFilter);
  const paginated = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE);

  return (
    <div className="txn-page">
      <div className="txn-header">
        <div>
          <h1 className="page-title">আয় ও ব্যয় ব্যবস্থাপনা</h1>
          <p className="page-subtitle">ছাত্র ফি, বেতন ও সকল ধরনের আয়-ব্যয়ের সম্পূর্ণ হিসাব</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="outline" icon={<FiTrendingUp />} onClick={() => openModal('income')}>আয় যোগ করুন</Button>
          <Button icon={<FiTrendingDown />} onClick={() => openModal('expense')}>ব্যয় যোগ করুন</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="txn-stats">
        <div className="txn-stat-card txn-income">
          <FiTrendingUp size={26} />
          <div><span className="txn-stat-val">{fmt(totalIncome)}</span><span className="txn-stat-label">মোট আয় (ফি + অনুদান)</span></div>
        </div>
        <div className="txn-stat-card txn-expense">
          <FiTrendingDown size={26} />
          <div><span className="txn-stat-val">{fmt(totalExpense)}</span><span className="txn-stat-label">মোট ব্যয় (বেতন + অন্যান্য)</span></div>
        </div>
        <div className={`txn-stat-card ${net >= 0 ? 'txn-surplus' : 'txn-deficit'}`}>
          <FiActivity size={26} />
          <div><span className="txn-stat-val">{fmt(Math.abs(net))}</span><span className="txn-stat-label">{net >= 0 ? 'নিট উদ্বৃত্ত' : 'নিট ঘাটতি'}</span></div>
        </div>
        <div className="txn-stat-card txn-due">
          <FiActivity size={26} />
          <div>
            <span className="txn-stat-val">{fmt(feeDue + salaryDue)}</span>
            <span className="txn-stat-label">মোট বকেয়া (ফি + বেতন)</span>
          </div>
        </div>
      </div>

      {/* Category breakdown + trend */}
      <div className="txn-breakdown-row">
        <div className="txn-breakdown-card">
          <h3 className="txn-breakdown-title income-title"><FiTrendingUp /> আয়ের উৎস</h3>
          {incomeCats.length === 0
            ? <p className="txn-empty">কোনো তথ্য নেই</p>
            : incomeCats.map(c => (
              <div key={c.category} className="txn-cat-row">
                <span>{c.category}</span>
                <div className="txn-cat-bar-wrap">
                  <div className="txn-cat-bar income-bar" style={{ width: `${Math.min(100, (c.total / totalIncome) * 100)}%` }} />
                </div>
                <span className="txn-cat-val income-val">{fmt(c.total)}</span>
              </div>
            ))
          }
          <div className="txn-due-row"><span>বকেয়া ফি</span><span className="txn-due-val">{fmt(feeDue)}</span></div>
        </div>

        <div className="txn-breakdown-card">
          <h3 className="txn-breakdown-title expense-title"><FiTrendingDown /> ব্যয়ের খাত</h3>
          {expenseCats.length === 0
            ? <p className="txn-empty">কোনো তথ্য নেই</p>
            : expenseCats.map(c => (
              <div key={c.category} className="txn-cat-row">
                <span>{c.category}</span>
                <div className="txn-cat-bar-wrap">
                  <div className="txn-cat-bar expense-bar" style={{ width: `${Math.min(100, (c.total / totalExpense) * 100)}%` }} />
                </div>
                <span className="txn-cat-val expense-val">{fmt(c.total)}</span>
              </div>
            ))
          }
          <div className="txn-due-row"><span>বকেয়া বেতন</span><span className="txn-due-val">{fmt(salaryDue)}</span></div>
        </div>

        {/* Trend chart */}
        <div className="txn-breakdown-card">
          <h3 className="txn-breakdown-title" style={{ color: 'var(--primary)' }}><FiActivity /> মাসিক ধারা</h3>
          {trend.length === 0
            ? <p className="txn-empty">কোনো তথ্য নেই</p>
            : (
              <div className="txn-trend-chart">
                {trend.map(t => (
                  <div key={t.month_key} className="ttc-col">
                    <div className="ttc-bars">
                      <div className="ttc-bar income-bar" style={{ height: `${Math.round((Number(t.income) / maxTrend) * 100)}%` }} title={`আয়: ${fmt(t.income)}`} />
                      <div className="ttc-bar expense-bar" style={{ height: `${Math.round((Number(t.expense) / maxTrend) * 100)}%` }} title={`ব্যয়: ${fmt(t.expense)}`} />
                    </div>
                    <div className="ttc-label">{t.month_key?.slice(5)}</div>
                  </div>
                ))}
              </div>
            )
          }
          <div className="txn-trend-legend">
            <span><span className="legend-dot income-dot" />আয়</span>
            <span><span className="legend-dot expense-dot" />ব্যয়</span>
          </div>
        </div>
      </div>

      {/* Unified ledger table */}
      <div className="txn-list-card">
        <div className="txn-list-header">
          <div className="txn-filter-tabs">
            <FiFilter size={14} style={{ color: 'var(--text-muted)' }} />
            {[['all','সব'],['income','আয়'],['expense','ব্যয়']].map(([v, l]) => (
              <button key={v} className={`txn-tab${typeFilter === v ? ' active' : ''}`} onClick={() => { setType(v); setPage(1); }}>{l}</button>
            ))}
          </div>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{filtered.length} টি রেকর্ড</span>
        </div>

        <div className="txn-table-wrap">
          {loading ? <p style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>লোড হচ্ছে...</p> : (
            <table className="txn-table">
              <thead>
                <tr><th>তারিখ</th><th>ভাউচার নং</th><th>ধরন</th><th>বিভাগ</th><th>বিবরণ</th><th>উৎস</th><th>পরিমাণ</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>কোনো রেকর্ড নেই</td></tr>
                )}
                {paginated.map((t, i) => (
                  <tr key={i}>
                    <td>{formatDate(t.date)}</td>
                    <td style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.82rem' }}>{t.voucher_no || '—'}</td>
                    <td><Badge variant={t.type === 'income' ? 'success' : 'danger'}>{t.type === 'income' ? 'আয়' : 'ব্যয়'}</Badge></td>
                    <td>{t.category}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem', maxWidth: 200 }}>{t.description || '—'}</td>
                    <td><Badge variant={SOURCE_COLOR[t.source] || 'secondary'}>{SOURCE_LABEL[t.source] || t.source}</Badge></td>
                    <td className={`txn-amount ${t.type === 'income' ? 'income-val' : 'expense-val'}`}>
                      {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
                    </td>
                    <td>
                      {t.source === 'manual' && (
                        <button className="txn-del-btn" onClick={() => onDelete(i)}><FiTrash2 size={14} /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <Pagination page={page} total={filtered.length} perPage={PER_PAGE} onChange={p => { setPage(p); }} />
      </div>

      {/* Add Modal */}
      <Modal isOpen={showModal} onClose={() => setModal(false)} title={form.type === 'income' ? 'নতুন আয় যোগ করুন' : 'নতুন ব্যয় যোগ করুন'} size="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="input-label">ধরন</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[['income','আয়'],['expense','ব্যয়']].map(([v, l]) => (
                <button key={v} type="button"
                  className={`txn-type-btn${form.type === v ? ' active-' + v : ''}`}
                  onClick={() => { setForm(f => ({ ...f, type: v, category: '' })); setCustomCat(''); }}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="input-label">বিভাগ *</label>
            <select className="input-field" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              <option value="">— নির্বাচন করুন —</option>
              {(form.type === 'income' ? INCOME_CATS : EXPENSE_CATS).map(c => <option key={c} value={c}>{c}</option>)}
              <option value="__custom__">অন্য (নিজে লিখুন)</option>
            </select>
          </div>
          {form.category === '__custom__' && (
            <div>
              <label className="input-label">বিভাগের নাম *</label>
              <input
                className="input-field"
                placeholder="বিভাগ লিখুন"
                value={customCat}
                onChange={e => setCustomCat(e.target.value)}
                autoFocus
              />
            </div>
          )}
          <div>
            <label className="input-label">পরিমাণ (৳) *</label>
            <input className="input-field" type="number" min="1" placeholder="0.00"
              value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          </div>
          <div>
            <label className="input-label">তারিখ *</label>
            <input className="input-field" type="date" value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div>
            <label className="input-label">বিবরণ (ঐচ্ছিক)</label>
            <input className="input-field" placeholder="সংক্ষিপ্ত বিবরণ..."
              value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className="input-label">ভাউচার নং (ঐচ্ছিক)</label>
            <input className="input-field" placeholder="যেমন: 02, V-2026-01"
              value={form.voucher_no} onChange={e => setForm(f => ({ ...f, voucher_no: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button variant="outline" onClick={() => setModal(false)} type="button">বাতিল</Button>
            <Button onClick={onSave}>সংরক্ষণ করুন</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
