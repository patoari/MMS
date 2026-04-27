import { useState, useEffect } from 'react';
import api from '../../services/api';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import { formatDate } from '../../utils/dateFormat';
import Pagination from '../../components/Pagination';
import SalaryReceipt from '../../components/SalaryReceipt';
import { FiDollarSign, FiCheckCircle, FiAlertCircle, FiPlus, FiFilter, FiUsers, FiFileText } from 'react-icons/fi';
import swal from '../../utils/swal';
import './SalaryList.css';

const BANGLA_MONTHS = [
  'জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন',
  'জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর',
];

const currentYear  = new Date().getFullYear();
const currentMonth = BANGLA_MONTHS[new Date().getMonth()];

export default function SalaryList() {
  const [salaries, setSalaries]   = useState([]);
  const [teachers, setTeachers]   = useState([]);
  const [filterMonth, setFilter]  = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [payModal, setPayModal]   = useState(null);
  const [receiptModal, setReceiptModal] = useState(null);
  const [receiptSearchModal, setReceiptSearchModal] = useState(false);
  const [receiptSearchQuery, setReceiptSearchQuery] = useState('');
  const [genModal, setGenModal]   = useState(false);
  const [genMonth, setGenMonth]   = useState(currentMonth);
  const [genYear, setGenYear]     = useState(String(currentYear));
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('নগদ');
  const [remarks, setRemarks]     = useState('');
  const [generating, setGen]      = useState(false);
  const [page, setPage]           = useState(1);
  const PER_PAGE = 12;

  const fetchSalaries = (month = filterMonth) =>
    api.get(`/salaries${month ? `?month=${encodeURIComponent(month)}` : ''}`)
      .then(res => setSalaries(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});

  const fetchTeachers = () =>
    api.get('/teachers').then(res => setTeachers(Array.isArray(res.data) ? res.data : [])).catch(() => {});

  useEffect(() => { fetchSalaries(); fetchTeachers(); }, []);

  const applyFilter = (month) => { setFilter(month); setPage(1); fetchSalaries(month); };

  // Generate salary records for all active teachers for a month
  const handleGenerate = async () => {
    const monthLabel = `${genMonth} ${genYear}`;
    const ok = await swal.confirmAction(
      'বেতন তৈরি করবেন?',
      `${monthLabel} মাসের জন্য সকল সক্রিয় শিক্ষকের বেতন রেকর্ড তৈরি হবে।`,
      'হ্যাঁ, তৈরি করুন'
    );
    if (!ok) return;
    setGen(true);
    try {
      await api.post('/salaries/generate', { month: monthLabel });
      swal.success(`${monthLabel} মাসের বেতন রেকর্ড তৈরি হয়েছে`);
      setGenModal(false);
      applyFilter(monthLabel);
    } catch (e) { await swal.error(e.message); }
    finally { setGen(false); }
  };

  const openPay = (r) => { 
    setPayModal(r); 
    setPayAmount(String(Number(r.amount) - Number(r.paid))); 
    setPayMethod('নগদ');
    setRemarks('');
  };

  const handlePay = async () => {
    const amt = Number(payAmount);
    if (!amt || amt <= 0) { await swal.error('সঠিক পরিমাণ দিন'); return; }
    try {
      const res = await api.post(`/salaries/${payModal.id}/pay`, { 
        amount: amt,
        payment_method: payMethod,
        remarks: remarks
      });
      
      // Fetch the receipt details
      if (res.data?.receipt_number) {
        const receiptRes = await api.get(`/salary-receipts/search/${res.data.receipt_number}`);
        setReceiptModal(receiptRes.data);
      }
      
      swal.success('বেতন প্রদান সম্পন্ন হয়েছে');
      setPayModal(null);
      fetchSalaries();
    } catch (e) { await swal.error(e.message); }
  };

  const handleReceiptSearch = async () => {
    if (!receiptSearchQuery.trim()) {
      await swal.error('রসিদ নম্বর দিন');
      return;
    }
    try {
      const res = await api.get(`/salary-receipts/search/${receiptSearchQuery.trim()}`);
      setReceiptModal(res.data);
      setReceiptSearchModal(false);
      setReceiptSearchQuery('');
    } catch (e) {
      await swal.error('রসিদ পাওয়া যায়নি');
    }
  };

  // Filter salaries by search query
  const filteredSalaries = salaries.filter(s => 
    s.teacher_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.month?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPaid    = filteredSalaries.reduce((s, r) => s + Number(r.paid), 0);
  const totalDue     = filteredSalaries.reduce((s, r) => s + Math.max(0, Number(r.amount) - Number(r.paid)), 0);
  const totalAmount  = filteredSalaries.reduce((s, r) => s + Number(r.amount), 0);
  const paidCount    = filteredSalaries.filter(r => r.status === 'পরিশোধিত').length;

  // Unique months for filter
  const allMonths = [...new Set(salaries.map(r => r.month))].sort().reverse();

  return (
    <div className="salary-page">
      <div className="salary-header">
        <div>
          <h1 className="page-title">বেতন ব্যবস্থাপনা</h1>
          <p className="page-subtitle">শিক্ষক ও কর্মচারীদের মাসিক বেতন পরিচালনা</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button icon={<FiFileText />} variant="outline" onClick={() => setReceiptSearchModal(true)}>রসিদ খুঁজুন</Button>
          <Button icon={<FiPlus />} onClick={() => setGenModal(true)}>মাসিক বেতন তৈরি করুন</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="salary-stats">
        <div className="sstat-card sstat-blue">
          <div className="sstat-icon"><FiDollarSign /></div>
          <div><span className="sstat-val">৳{totalAmount.toLocaleString()}</span><span className="sstat-label">মোট বেতন</span></div>
        </div>
        <div className="sstat-card sstat-green">
          <div className="sstat-icon"><FiCheckCircle /></div>
          <div><span className="sstat-val">৳{totalPaid.toLocaleString()}</span><span className="sstat-label">পরিশোধিত</span></div>
        </div>
        <div className="sstat-card sstat-red">
          <div className="sstat-icon"><FiAlertCircle /></div>
          <div><span className="sstat-val">৳{totalDue.toLocaleString()}</span><span className="sstat-label">বকেয়া</span></div>
        </div>
        <div className="sstat-card sstat-purple">
          <div className="sstat-icon"><FiUsers /></div>
          <div><span className="sstat-val">{paidCount}/{filteredSalaries.length}</span><span className="sstat-label">পরিশোধ সম্পন্ন</span></div>
        </div>
      </div>

      {/* Search bar */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          className="input-field"
          placeholder="শিক্ষকের নাম বা মাস দিয়ে খুঁজুন..."
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
          style={{ maxWidth: 400 }}
        />
      </div>

      {/* Month filter */}
      <div className="salary-filter-bar">
        <FiFilter size={15} style={{ color: 'var(--text-muted)' }} />
        <button className={`salary-month-btn${!filterMonth ? ' active' : ''}`} onClick={() => applyFilter('')}>সব মাস</button>
        {allMonths.map(m => (
          <button key={m} className={`salary-month-btn${filterMonth === m ? ' active' : ''}`} onClick={() => applyFilter(m)}>{m}</button>
        ))}
      </div>

      {/* Progress bar */}
      {totalAmount > 0 && (
        <div className="salary-progress-wrap">
          <div className="salary-progress-label">
            <span>পরিশোধের অগ্রগতি</span>
            <span>{Math.round((totalPaid / totalAmount) * 100)}%</span>
          </div>
          <div className="salary-progress-bar">
            <div className="salary-progress-fill" style={{ width: `${Math.min(100, (totalPaid / totalAmount) * 100)}%` }} />
          </div>
        </div>
      )}

      {/* Salary cards */}
      <div className="salary-grid">
        {filteredSalaries.length === 0 && (
          <p style={{ color: 'var(--text-muted)', gridColumn: '1/-1', textAlign: 'center', padding: 40 }}>
            {searchQuery ? 'কোনো ফলাফল পাওয়া যায়নি' : 'কোনো বেতন রেকর্ড নেই। "মাসিক বেতন তৈরি করুন" বাটনে ক্লিক করুন।'}
          </p>
        )}
        {filteredSalaries.slice((page-1)*PER_PAGE, page*PER_PAGE).map(r => {
          const due = Math.max(0, Number(r.amount) - Number(r.paid));
          const pct = Number(r.amount) > 0 ? Math.round((Number(r.paid) / Number(r.amount)) * 100) : 0;
          return (
            <div key={r.id} className={`salary-card${r.status === 'পরিশোধিত' ? ' paid' : ''}`}>
              <div className="sc-top">
                <div className="sc-avatar">{r.teacher_name?.[0] || 'T'}</div>
                <div className="sc-info">
                  <div className="sc-name">{r.teacher_name}</div>
                  <div className="sc-month">{r.month}</div>
                </div>
                <Badge variant={r.status === 'পরিশোধিত' ? 'success' : due > 0 ? 'danger' : 'warning'}>
                  {r.status}
                </Badge>
              </div>

              <div className="sc-amounts">
                <div className="sc-amt-row">
                  <span>মোট বেতন</span><strong>৳{Number(r.amount).toLocaleString()}</strong>
                </div>
                <div className="sc-amt-row">
                  <span>পরিশোধিত</span>
                  <strong style={{ color: 'var(--success)' }}>৳{Number(r.paid).toLocaleString()}</strong>
                </div>
                {due > 0 && (
                  <div className="sc-amt-row">
                    <span>বকেয়া</span>
                    <strong style={{ color: 'var(--danger)' }}>৳{due.toLocaleString()}</strong>
                  </div>
                )}
              </div>

              <div className="sc-progress">
                <div className="sc-progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="sc-pct">{pct}% পরিশোধিত</div>

              {r.paid_date && <div className="sc-date">তারিখ: {formatDate(r.paid_date)}</div>}

              {r.status !== 'পরিশোধিত' && (
                <Button size="sm" variant="success" icon={<FiDollarSign />} onClick={() => openPay(r)} style={{ width: '100%', marginTop: 4 }}>
                  বেতন দিন
                </Button>
              )}
            </div>
          );
        })}
      </div>
      <Pagination page={page} total={filteredSalaries.length} perPage={PER_PAGE} onChange={setPage} />

      {/* Generate Modal */}
      <Modal isOpen={genModal} onClose={() => setGenModal(false)} title="মাসিক বেতন রেকর্ড তৈরি করুন" size="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            নির্বাচিত মাসের জন্য সকল সক্রিয় শিক্ষকের বেতন রেকর্ড স্বয়ংক্রিয়ভাবে তৈরি হবে।
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 2 }}>
              <label className="input-label">মাস</label>
              <select className="input-field" value={genMonth} onChange={e => setGenMonth(e.target.value)}>
                {BANGLA_MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="input-label">বছর</label>
              <input className="input-field" type="number" value={genYear} onChange={e => setGenYear(e.target.value)} />
            </div>
          </div>
          <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 12 }}>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
              সক্রিয় শিক্ষক: <strong>{teachers.filter(t => t.status === 'সক্রিয়').length} জন</strong>
            </p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              মোট বেতন: <strong>৳{teachers.filter(t => t.status === 'সক্রিয়').reduce((s, t) => s + Number(t.salary || 0), 0).toLocaleString()}</strong>
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button variant="outline" onClick={() => setGenModal(false)} type="button">বাতিল</Button>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? 'তৈরি হচ্ছে...' : 'বেতন রেকর্ড তৈরি করুন'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Pay Modal */}
      <Modal isOpen={!!payModal} onClose={() => setPayModal(null)} title="বেতন প্রদান করুন" size="sm">
        {payModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="pay-info-box">
              <div className="pay-info-row"><span>শিক্ষক</span><strong>{payModal.teacher_name}</strong></div>
              <div className="pay-info-row"><span>মাস</span><strong>{payModal.month}</strong></div>
              <div className="pay-info-row"><span>মোট বেতন</span><strong>৳{Number(payModal.amount).toLocaleString()}</strong></div>
              <div className="pay-info-row"><span>ইতোমধ্যে পরিশোধিত</span><strong style={{ color: 'var(--success)' }}>৳{Number(payModal.paid).toLocaleString()}</strong></div>
              <div className="pay-info-row"><span>বকেয়া</span><strong style={{ color: 'var(--danger)' }}>৳{Math.max(0, Number(payModal.amount) - Number(payModal.paid)).toLocaleString()}</strong></div>
            </div>
            <div>
              <label className="input-label">প্রদানের পরিমাণ (৳)</label>
              <input
                type="number" className="input-field"
                value={payAmount}
                max={Number(payModal.amount) - Number(payModal.paid)}
                min={1}
                onChange={e => setPayAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="input-label">প্রদানের মাধ্যম</label>
              <select className="input-field" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                <option value="নগদ">নগদ</option>
                <option value="ব্যাংক ট্রান্সফার">ব্যাংক ট্রান্সফার</option>
                <option value="চেক">চেক</option>
                <option value="মোবাইল ব্যাংকিং">মোবাইল ব্যাংকিং</option>
              </select>
            </div>
            <div>
              <label className="input-label">মন্তব্য (ঐচ্ছিক)</label>
              <textarea 
                className="input-field" 
                rows={3}
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="কোনো বিশেষ মন্তব্য থাকলে লিখুন..."
              />
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <Button variant="outline" onClick={() => setPayModal(null)} type="button">বাতিল</Button>
              <Button variant="success" icon={<FiCheckCircle />} onClick={handlePay}>বেতন প্রদান করুন</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Receipt Modal */}
      <Modal isOpen={!!receiptModal} onClose={() => setReceiptModal(null)} title="বেতন প্রদানের রসিদ" size="md">
        {receiptModal && <SalaryReceipt receipt={receiptModal} onClose={() => setReceiptModal(null)} />}
      </Modal>

      {/* Receipt Search Modal */}
      <Modal isOpen={receiptSearchModal} onClose={() => setReceiptSearchModal(false)} title="রসিদ খুঁজুন" size="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            রসিদ নম্বর দিয়ে পূর্বের বেতন প্রদানের রসিদ খুঁজুন এবং প্রিন্ট করুন।
          </p>
          <div>
            <label className="input-label">রসিদ নম্বর</label>
            <input
              type="text"
              className="input-field"
              placeholder="যেমন: RCP-20260413-001"
              value={receiptSearchQuery}
              onChange={e => setReceiptSearchQuery(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleReceiptSearch()}
            />
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button variant="outline" onClick={() => setReceiptSearchModal(false)}>বাতিল</Button>
            <Button icon={<FiFileText />} onClick={handleReceiptSearch}>রসিদ খুঁজুন</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
