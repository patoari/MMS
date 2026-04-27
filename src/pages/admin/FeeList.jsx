import { useState, useEffect } from 'react';
import { useFees } from '../../context/FeeContext';
import { useStudents } from '../../context/StudentContext';
import api from '../../services/api';
import swal from '../../utils/swal';
import Table from '../../components/Table';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import Card from '../../components/Card';
import PaymentReceipt from '../../components/PaymentReceipt';
import AdmitCard from '../../components/AdmitCard';
import AdvancedSearchBar from '../../components/AdvancedSearchBar';
import { statusVariant } from '../../constants';
import { FiDollarSign, FiAlertCircle, FiCheckCircle, FiPlus, FiSettings, FiSearch, FiFileText, FiEdit3 } from 'react-icons/fi';
import { CLASS_OPTIONS } from '../../utils/constants';
import './FeeList.css';

// Bengali month names
const BANGLA_MONTHS = [
  'জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন',
  'জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর',
];

const currentYear = new Date().getFullYear();

const FEE_TYPE_OPTIONS = [
  { value: 'মাসিক ফি',   label: 'মাসিক ফি' },
  { value: 'পরীক্ষা ফি', label: 'পরীক্ষা ফি' },
  { value: 'সেশন ফি',    label: 'সেশন ফি' },
  { value: 'ভর্তি ফি',   label: 'ভর্তি ফি' },
  { value: 'অন্যান্য',   label: 'অন্যান্য' },
];

const statusOptions = [
  { value: 'সব', label: 'সব অবস্থা' },
  { value: 'বকেয়া', label: 'বকেয়া' },
  { value: 'আংশিক', label: 'আংশিক' },
  { value: 'পরিশোধিত', label: 'পরিশোধিত' },
  { value: 'অগ্রিম', label: 'অগ্রিম' },
];

export default function FeeList() {
  const { fees, collectMultiple, addFeeRecord, feeSettings, updateFeeSetting, saveAllFeeSettings, totalCollected, totalDue, receipts } = useFees();
  const { allStudents } = useStudents();

  // Multi-collect modal state
  const [collectStudent, setCollectStudent] = useState(null); // student object
  const [selectedFees, setSelectedFees]     = useState({});   // { feeId: amountString }
  const [paymentDate, setPaymentDate]       = useState(new Date().toISOString().split('T')[0]); // actual payment date

  const [addModal, setAddModal]           = useState(false);
  const [settingsModal, setSettingsModal] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState(null);
  const [activeAdmitCard, setActiveAdmitCard] = useState(null);
  const [waiverModal, setWaiverModal]     = useState(false);
  const [waiverFee, setWaiverFee]         = useState(null);
  const [waiverType, setWaiverType]       = useState('reduce'); // 'reduce' or 'free'
  const [waiverAmount, setWaiverAmount]   = useState('');
  const [waiverReason, setWaiverReason]   = useState('');

  // Generate monthly fees state
  const [genModal, setGenModal]     = useState(false);
  const [genMonth, setGenMonth]     = useState('');
  const [genYear, setGenYear]       = useState(String(currentYear));
  const [genLoading, setGenLoading] = useState(false);

  // Add fee form state
  const [addFeeType,    setAddFeeType]    = useState('');
  const [addOtherLabel, setAddOtherLabel] = useState('');
  const [addMonth,      setAddMonth]      = useState('');
  const [addExam,       setAddExam]       = useState('');
  const [addAmounts,    setAddAmounts]    = useState({}); // { className: amountString }
  const [addYear,       setAddYear]       = useState(String(currentYear));

  // Exam list state
  const [exams, setExams] = useState([]);

  // Fetch exams from API
  const fetchExams = async () => {
    try {
      const response = await api.get('/exams/all');
      if (response.data?.data) {
        setExams(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch exams:', error);
    }
  };

  // Load exams when modal opens
  useEffect(() => {
    if (addModal && addFeeType === 'পরীক্ষা ফি') {
      fetchExams();
    }
  }, [addModal, addFeeType]);

  const generateMonthlyFees = async () => {
    if (!genMonth) return swal.error('মাস নির্বাচন করুন');
    const monthLabel = `${genMonth} ${genYear}`;
    const ok = await swal.confirm(
      `${monthLabel} মাসের ফি তৈরি করবেন?`,
      'প্রতিটি শ্রেণির নির্ধারিত মাসিক ফি অনুযায়ী সকল সক্রিয় শিক্ষার্থীর জন্য ফি রেকর্ড তৈরি হবে।',
      'তৈরি করুন'
    );
    if (!ok) return;
    setGenLoading(true);
    try {
      const res = await api.post('/fees/generate-monthly', { month: monthLabel });
      setGenModal(false);
      await swal.success(res.data?.message || 'মাসিক ফি তৈরি হয়েছে');
      window.location.reload();
    } catch (e) {
      await swal.error(e.message || 'ফি তৈরি করতে ব্যর্থ হয়েছে');
    } finally {
      setGenLoading(false);
    }
  };

  const resetAddForm = () => {
    setAddFeeType(''); setAddOtherLabel('');
    setAddMonth(''); setAddExam(''); setAddAmounts({}); setAddYear(String(currentYear));
  };

  const [filterCategory, setFilterCategory] = useState('সব');
  const [filterStatus, setFilterStatus]     = useState('সব');
  const [searchQuery, setSearchQuery]       = useState('');
  const [searchMode, setSearchMode]         = useState('student');
  const [page, setPage]                     = useState(1);
  const [searchResults, setSearchResults]   = useState(null); // null = not searched yet
  const [searching, setSearching]           = useState(false);
  const PER_PAGE = 15;

  // ── Open collect modal for a student ──────────────────────
  const openCollect = (studentId) => {
    const student = allStudents.find(s => s.id === studentId) || { id: studentId };
    const studentFees = fees.filter(f =>
      (f.student_id || f.studentId) === studentId && Number(f.due) > 0
    );
    // pre-select all pending fees with their due amount
    const preSelected = {};
    studentFees.forEach(f => { preSelected[f.id] = String(Number(f.due)); });
    setSelectedFees(preSelected);
    setCollectStudent({ ...student, pendingFees: studentFees });
  };

  const toggleFee = (feeId, due) => {
    setSelectedFees(prev => {
      if (prev[feeId] !== undefined) {
        const next = { ...prev };
        delete next[feeId];
        return next;
      }
      return { ...prev, [feeId]: String(due) };
    });
  };

  const totalSelected = Object.values(selectedFees).reduce((s, v) => s + (Number(v) || 0), 0);

  const openWaiver = (fee) => {
    setWaiverFee(fee);
    setWaiverType('reduce');
    setWaiverAmount('');
    setWaiverReason('');
    setWaiverModal(true);
  };

  const applyWaiver = async () => {
    if (!waiverFee) return;
    
    try {
      const newAmount = waiverType === 'free' ? 0 : Number(waiverAmount);
      
      if (waiverType === 'reduce' && (!newAmount || newAmount >= Number(waiverFee.amount))) {
        await swal.error('হ্রাসকৃত পরিমাণ মূল পরিমাণের চেয়ে কম হতে হবে');
        return;
      }
      
      // Update fee amount
      await api.put(`/fees/${waiverFee.id}`, {
        amount: newAmount,
        waiver_reason: waiverReason || (waiverType === 'free' ? 'সম্পূর্ণ মওকুফ' : 'আংশিক মওকুফ')
      });
      
      // Refresh fees
      window.location.reload();
      
      await swal.success(waiverType === 'free' ? 'ফি সম্পূর্ণ মওকুফ করা হয়েছে' : 'ফি হ্রাস করা হয়েছে');
      setWaiverModal(false);
      setWaiverFee(null);
    } catch (err) {
      await swal.error(err.message || 'ফি মওকুফ করতে ব্যর্থ হয়েছে');
    }
  };

  const onCollect = async () => {
    if (!collectStudent || totalSelected <= 0) return;
    const payments = Object.entries(selectedFees)
      .filter(([, v]) => Number(v) > 0)
      .map(([feeId, amount]) => ({ feeId, amount: Number(amount) }));

    const receipt = await collectMultiple(payments, {
      studentId:    collectStudent.id,
      studentName:  collectStudent.name,
      studentClass: collectStudent.class,
      guardian:     collectStudent.guardian,
      phone:        collectStudent.phone,
    }, paymentDate); // Pass payment date
    
    // Check if any exam fee was fully paid
    const examFeesPaid = payments.filter(({ feeId, amount }) => {
      const fee = fees.find(f => f.id === feeId);
      return fee && fee.category === 'পরীক্ষা ফি' && Number(amount) >= Number(fee.due);
    });

    setCollectStudent(null);
    setSelectedFees({});
    setPaymentDate(new Date().toISOString().split('T')[0]); // Reset to today
    setActiveReceipt(receipt);

    // Generate admit card if exam fee was paid
    if (examFeesPaid.length > 0) {
      const examFee = fees.find(f => f.id === examFeesPaid[0].feeId);
      const student = allStudents.find(s => s.id === collectStudent.id);
      
      // Get session info
      let sessionYear = new Date().getFullYear();
      try {
        const sessionRes = await api.get('/sessions');
        const currentSession = sessionRes.data?.find(s => s.is_current == 1);
        if (currentSession) {
          sessionYear = currentSession.year;
        }
      } catch {}

      const admitData = {
        studentId: collectStudent.id,
        studentName: collectStudent.name,
        class: collectStudent.class,
        roll: student?.roll || '--',
        session: sessionYear,
        examName: examFee?.month || 'পরীক্ষা',
        photo: student?.photo || null,
        version: student?.version || null,
        section: student?.section || null,
        group: student?.group || null,
        shift: student?.shift || null,
      };

      // Show admit card after a short delay
      setTimeout(() => {
        setActiveAdmitCard(admitData);
      }, 1000);
    }
  };

  const onAddFee = () => {
    if (!addFeeType) return;
    const category = addFeeType === 'অন্যান্য' ? addOtherLabel : addFeeType;
    let month = '';
    if (addFeeType === 'মাসিক ফি')        month = addMonth ? `${addMonth} ${addYear}` : '';
    else if (addFeeType === 'পরীক্ষা ফি') month = addExam;
    else if (addFeeType === 'সেশন ফি')    month = `শিক্ষাবর্ষ ${addYear}`;
    else if (addFeeType === 'ভর্তি ফি')   month = addYear;
    else                                   month = addMonth || addYear;

    if (!month || !category) return;

    // For each class that has an amount entered, create fee records for all students in that class
    Object.entries(addAmounts).forEach(([className, amtStr]) => {
      const amt = Number(amtStr);
      if (!amt) return;
      allStudents.filter(s => s.class === className).forEach(s => {
        addFeeRecord({ student_id: s.id, category, month, amount: amt });
      });
    });
    resetAddForm();
    setAddModal(false);
  };

  // ── Filtering ──────────────────────────────────────────────
  const q = searchQuery.trim().toLowerCase();

  // When a search was performed, use server results; otherwise use context fees
  const sourceData = searchResults !== null ? searchResults : fees;

  const filtered = sourceData.filter(f => {
    const matchCategory = filterCategory === 'সব' || f.category === filterCategory;
    const matchStatus   = filterStatus   === 'সব' || f.status   === filterStatus;
    return matchCategory && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  // Reset to page 1 when filters/search change
  const setFilter = (fn) => { fn(); setPage(1); };

  const receiptResult = searchMode === 'receipt' && q
    ? receipts.find(r => r.receiptNo.toLowerCase().includes(q))
    : null;

  const columns = [
    { header: 'শিক্ষার্থী', render: r => (
      <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 600 }}>
        {r.student_id || r.studentId || '—'}
      </span>
    )},
    { header: 'শ্রেণি', key: 'class' },
    { header: 'বিভাগ', render: r => <Badge variant="primary">{r.category}</Badge> },
    { header: 'মাস/সময়', key: 'month' },
    { header: 'নির্ধারিত', render: r => `৳${r.amount}` },
    { header: 'পরিশোধিত', render: r => (
      <span style={{ color: Number(r.paid) > Number(r.amount) ? 'var(--info)' : Number(r.paid) > 0 ? 'var(--success)' : 'var(--text-muted)', fontWeight: 600 }}>
        ৳{r.paid}
      </span>
    )},
    { header: 'বকেয়া', render: r => (
      <span style={{ color: Number(r.due) > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
        ৳{Math.max(0, Number(r.due))}
      </span>
    )},
    { header: 'অবস্থা', render: r => (
      r.status === 'কোনো ফি নেই'
        ? <Badge variant="secondary">কোনো ফি নেই</Badge>
        : <Badge variant={statusVariant[r.status] || 'default'}>{r.status}</Badge>
    )},
    { header: 'অ্যাকশন', render: r => (
      <div style={{ display: 'flex', gap: 6 }}>
        <Button size="sm" variant="success"
          onClick={() => openCollect(r.student_id || r.studentId)}
          disabled={!( r.student_id || r.studentId) || r.status === 'কোনো ফি নেই'}
        >
          ফি নিন
        </Button>
        {r.status !== 'কোনো ফি নেই' && (
          <Button size="sm" variant="outline" icon={<FiEdit3 />}
            onClick={() => openWaiver(r)}
            title="ফি মওকুফ/হ্রাস করুন"
          />
        )}
      </div>
    )},
  ];

  return (
    <div className="fee-list-page">
      <div className="page-top">
        <div>
          <h1 className="page-title">ফি ব্যবস্থাপনা</h1>
          <p className="page-subtitle">ভর্তি ফি, মাসিক ফি ও পরীক্ষা ফি সংগ্রহ</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="outline" icon={<FiSettings />} onClick={() => setSettingsModal(true)}>ফি নির্ধারণ</Button>
          <Button variant="outline" icon={<FiDollarSign />} onClick={() => setGenModal(true)}>মাসিক ফি তৈরি</Button>
          <Button icon={<FiPlus />} onClick={() => setAddModal(true)}>ফি যোগ করুন</Button>
        </div>
      </div>

      <div className="fee-stats">
        <Card title="মোট সংগ্রহ" value={`৳${totalCollected.toLocaleString()}`} icon={<FiCheckCircle />} color="success" />
        <Card title="মোট বকেয়া" value={`৳${totalDue.toLocaleString()}`} icon={<FiAlertCircle />} color="danger" />
        <Card title="মোট রেকর্ড" value={fees.length} icon={<FiDollarSign />} color="primary" />
      </div>

      {/* Search + Filters */}
      <AdvancedSearchBar 
        context="fees"
        onSearch={async (filters) => {
          const q = (filters.q || '').trim();
          setSearchQuery(q);
          setFilterCategory('সব');
          setFilterStatus('সব');
          setPage(1);
          if (q) {
            setSearching(true);
            try {
              const params = new URLSearchParams();
              params.append('search', q);
              if (filters.session_id) params.append('session_id', filters.session_id);
              const res = await api.get(`/fees?${params}`);
              setSearchResults(Array.isArray(res.data) ? res.data : []);
            } catch {
              setSearchResults([]);
            } finally {
              setSearching(false);
            }
          } else {
            setSearchResults(null);
          }
        }}
        showSessionFilter={true}
        showClassFilter={true}
        showMonthFilter={false}
        showExamFilter={false}
      />

      {searchMode === 'student' && (
        <div className="card">
          {searching
            ? <p style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>খোঁজা হচ্ছে...</p>
            : <>
                <Table columns={columns} data={paginated} emptyMessage="কোনো শিক্ষার্থী পাওয়া যায়নি" />

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="fee-pagination">
                    <span className="fee-pagination-info">
                      {filtered.length} টি রেকর্ড — পৃষ্ঠা {safePage} / {totalPages}
                    </span>
                    <div className="fee-pagination-controls">
                      <button className="fee-page-btn" onClick={() => setPage(1)}        disabled={safePage === 1}>«</button>
                      <button className="fee-page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}>‹</button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                        .reduce((acc, p, idx, arr) => {
                          if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…');
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((p, i) => p === '…'
                          ? <span key={`e${i}`} className="fee-page-ellipsis">…</span>
                          : <button key={p} className={`fee-page-btn${p === safePage ? ' active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                        )
                      }
                      <button className="fee-page-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>›</button>
                      <button className="fee-page-btn" onClick={() => setPage(totalPages)} disabled={safePage === totalPages}>»</button>
                    </div>
                  </div>
                )}
              </>
          }
        </div>
      )}

      {/* ── Multi-Fee Collect Modal ── */}
      <Modal
        isOpen={!!collectStudent}
        onClose={() => { setCollectStudent(null); setSelectedFees({}); }}
        title="ফি সংগ্রহ করুন"
        size="md"
      >
        {collectStudent && (
          <div className="collect-modal-body">
            {/* Student info strip */}
            <div className="collect-student-info">
              <div className="collect-student-avatar">{(collectStudent.name || '?')[0]}</div>
              <div>
                <div className="collect-student-name">{collectStudent.name || collectStudent.id}</div>
                <div className="collect-student-meta">
                  {collectStudent.id} &nbsp;·&nbsp; {collectStudent.class}
                  {collectStudent.guardian && <> &nbsp;·&nbsp; অভিভাবক: {collectStudent.guardian}</>}
                </div>
              </div>
            </div>

            {/* Fee rows */}
            {collectStudent.pendingFees.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>
                এই শিক্ষার্থীর কোনো বকেয়া ফি নেই।
              </p>
            ) : (
              <>
                <div className="collect-fee-list">
                  <div className="collect-fee-header">
                    <span>বিভাগ / মাস</span>
                    <span>বকেয়া</span>
                    <span>পরিমাণ</span>
                    <span>নির্বাচন</span>
                  </div>
                  {collectStudent.pendingFees.map(f => {
                    const checked = selectedFees[f.id] !== undefined;
                    return (
                      <div key={f.id} className={`collect-fee-row${checked ? ' selected' : ''}`}>
                        <div className="collect-fee-info">
                          <span className="collect-fee-cat">{f.category}</span>
                          <span className="collect-fee-month">{f.month}</span>
                        </div>
                        <span className="collect-fee-due">৳{Number(f.due).toLocaleString()}</span>
                        <input
                          type="number"
                          className="collect-fee-amount-input"
                          value={selectedFees[f.id] ?? ''}
                          min={0}
                          max={Number(f.due)}
                          placeholder="৳"
                          disabled={!checked}
                          onChange={e => setSelectedFees(prev => ({ ...prev, [f.id]: e.target.value }))}
                        />
                        <input
                          type="checkbox"
                          className="collect-fee-check"
                          checked={checked}
                          onChange={() => toggleFee(f.id, Number(f.due))}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Total */}
                <div className="collect-total-row">
                  <span>মোট পরিশোধযোগ্য</span>
                  <strong className="collect-total-amount">৳{totalSelected.toLocaleString()}</strong>
                </div>

                {/* Payment Date */}
                <div style={{ marginTop: 16, padding: '12px', background: 'var(--bg)', borderRadius: 8 }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                    পরিশোধের তারিখ
                  </label>
                  <input
                    type="date"
                    className="input-field"
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    style={{ width: '100%' }}
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6, marginBottom: 0 }}>
                    যে তারিখে টাকা প্রদান করা হয়েছে সেই তারিখ নির্বাচন করুন। এটি মাসিক রিপোর্টে ব্যবহৃত হবে।
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
                  <Button variant="outline" type="button" onClick={() => { setCollectStudent(null); setSelectedFees({}); setPaymentDate(new Date().toISOString().split('T')[0]); }}>বাতিল</Button>
                  <Button variant="success" onClick={onCollect} disabled={totalSelected <= 0}>
                    সংগ্রহ করুন ও রশিদ তৈরি করুন
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* ── Add Fee Modal ── */}
      <Modal isOpen={addModal} onClose={() => { resetAddForm(); setAddModal(false); }} title="নতুন ফি যোগ করুন" size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Fee type */}
          <div className="add-fee-field">
            <label className="add-fee-label">ফি বিভাগ <span className="req">*</span></label>
            <select className="add-fee-select" value={addFeeType} onChange={e => { setAddFeeType(e.target.value); setAddMonth(''); setAddExam(''); }}>
              <option value="">-- ফি বিভাগ নির্বাচন করুন --</option>
              {FEE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Other label */}
          {addFeeType === 'অন্যান্য' && (
            <div className="add-fee-field">
              <label className="add-fee-label">ফি-র নাম লিখুন <span className="req">*</span></label>
              <input className="add-fee-input" placeholder="যেমন: বার্ষিক ক্রীড়া ফি" value={addOtherLabel} onChange={e => setAddOtherLabel(e.target.value)} />
            </div>
          )}

          {/* Period / month field — dynamic */}
          {addFeeType === 'মাসিক ফি' && (
            <div className="add-fee-field">
              <label className="add-fee-label">মাস ও বছর <span className="req">*</span></label>
              <div style={{ display: 'flex', gap: 10 }}>
                <select className="add-fee-select" value={addMonth} onChange={e => setAddMonth(e.target.value)} style={{ flex: 2 }}>
                  <option value="">-- মাস নির্বাচন করুন --</option>
                  {BANGLA_MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <input className="add-fee-input" type="number" value={addYear} onChange={e => setAddYear(e.target.value)} style={{ flex: 1, minWidth: 80 }} placeholder="বছর" />
              </div>
            </div>
          )}

          {addFeeType === 'পরীক্ষা ফি' && (
            <div className="add-fee-field">
              <label className="add-fee-label">পরীক্ষা নির্বাচন করুন <span className="req">*</span></label>
              <select className="add-fee-select" value={addExam} onChange={e => setAddExam(e.target.value)}>
                <option value="">-- পরীক্ষা নির্বাচন করুন --</option>
                {exams.length > 0 ? (
                  exams.map(exam => (
                    <option key={exam.id} value={exam.name}>
                      {exam.name} {exam.class_name && exam.class_name !== 'সকল শ্রেণি' ? `(${exam.class_name})` : ''}
                    </option>
                  ))
                ) : (
                  <option disabled>কোনো পরীক্ষা পাওয়া যায়নি</option>
                )}
              </select>
            </div>
          )}

          {(addFeeType === 'সেশন ফি' || addFeeType === 'ভর্তি ফি') && (
            <div className="add-fee-field">
              <label className="add-fee-label">শিক্ষাবর্ষ <span className="req">*</span></label>
              <input className="add-fee-input" type="number" value={addYear} onChange={e => setAddYear(e.target.value)} placeholder="যেমন: 2024" />
            </div>
          )}

          {addFeeType === 'অন্যান্য' && (
            <div className="add-fee-field">
              <label className="add-fee-label">মাস / সময়কাল <span className="req">*</span></label>
              <input className="add-fee-input" value={addMonth} onChange={e => setAddMonth(e.target.value)} placeholder="যেমন: জানুয়ারি 2024" />
            </div>
          )}

          {/* Class-wise amount inputs */}
          <div className="add-fee-field">
            <label className="add-fee-label">
              পরিমাণ (টাকা) — শ্রেণিভিত্তিক <span className="req">*</span>
              <span className="add-fee-hint-inline">কমপক্ষে একটি শ্রেণির পরিমাণ দিন</span>
            </label>
            <div className="add-fee-class-grid">
              {CLASS_OPTIONS.map(c => (
                <div key={c.value} className="add-fee-class-row">
                  <span className="add-fee-class-name">{c.label}</span>
                  <input
                    className={`add-fee-input add-fee-class-input${addAmounts[c.value] ? ' has-value' : ''}`}
                    type="number"
                    min="0"
                    placeholder="৳"
                    value={addAmounts[c.value] || ''}
                    onChange={e => setAddAmounts(prev => ({
                      ...prev,
                      [c.value]: e.target.value,
                    }))}
                  />
                  {addAmounts[c.value] && (
                    <span className="add-fee-class-count">
                      {allStudents.filter(s => s.class === c.value).length} জন
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button variant="outline" type="button" onClick={() => { resetAddForm(); setAddModal(false); }}>বাতিল</Button>
            <Button
              onClick={onAddFee}
              disabled={!addFeeType ||
                Object.values(addAmounts).every(v => !Number(v)) ||
                (addFeeType === 'মাসিক ফি' && !addMonth) ||
                (addFeeType === 'পরীক্ষা ফি' && !addExam) ||
                (addFeeType === 'অন্যান্য' && (!addOtherLabel || !addMonth))
              }
            >যোগ করুন</Button>
          </div>
        </div>
      </Modal>

      {/* ── Fee Settings Modal ── */}
      <Modal isOpen={settingsModal} onClose={() => setSettingsModal(false)} title="শ্রেণিভিত্তিক ফি নির্ধারণ" size="lg">
        <div className="fee-settings-table-wrap">
          <table className="fee-settings-table">
            <thead>
              <tr>
                <th>শ্রেণি</th>
                <th>ভর্তি ফি (৳)</th>
                <th>সেশন ফি (৳)</th>
                <th>মাসিক ফি (৳)</th>
                <th>পরীক্ষা ফি (৳)</th>
              </tr>
            </thead>
            <tbody>
              {feeSettings.map(s => (
                <tr key={s.class || s.class_id}>
                  <td className="fee-settings-class">{s.class}</td>
                  {['admission', 'session', 'monthly', 'exam'].map(key => (
                    <td key={key}>
                      <input type="number" className="fee-settings-input" value={s[key]}
                        onChange={e => updateFeeSetting(s.class_id || s.class, key, e.target.value)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <Button
            onClick={async () => {
              setSettingsSaving(true);
              try {
                await saveAllFeeSettings();
                await swal.success('ফি নির্ধারণ সংরক্ষিত হয়েছে');
                setSettingsModal(false);
              } catch (e) {
                await swal.error(e.message || 'সংরক্ষণ ব্যর্থ হয়েছে');
              } finally {
                setSettingsSaving(false);
              }
            }}
            disabled={settingsSaving}
          >
            {settingsSaving ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
          </Button>
        </div>
      </Modal>

      {/* ── Receipt ── */}
      {activeReceipt && <PaymentReceipt receipt={activeReceipt} onClose={() => setActiveReceipt(null)} />}

      {/* ── Admit Card ── */}
      {activeAdmitCard && <AdmitCard admitData={activeAdmitCard} onClose={() => setActiveAdmitCard(null)} />}

      {/* ── Fee Waiver/Reduction Modal ── */}
      <Modal
        isOpen={waiverModal}
        onClose={() => { setWaiverModal(false); setWaiverFee(null); }}
        title="ফি মওকুফ/হ্রাস করুন"
        size="sm"
      >
        {waiverFee && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Fee Info */}
            <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 4 }}>শিক্ষার্থী</div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>{waiverFee.student_id || waiverFee.studentId}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.9rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>বিভাগ: </span>
                  <strong>{waiverFee.category}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>মাস: </span>
                  <strong>{waiverFee.month}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>মূল পরিমাণ: </span>
                  <strong style={{ color: 'var(--primary)' }}>৳{waiverFee.amount}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>বকেয়া: </span>
                  <strong style={{ color: 'var(--danger)' }}>৳{waiverFee.due}</strong>
                </div>
              </div>
            </div>

            {/* Waiver Type */}
            <div>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: 8, display: 'block' }}>
                মওকুফের ধরন <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ 
                  flex: 1, 
                  padding: '12px', 
                  border: `2px solid ${waiverType === 'reduce' ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: waiverType === 'reduce' ? 'rgba(99,102,241,0.05)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <input 
                    type="radio" 
                    name="waiverType" 
                    value="reduce" 
                    checked={waiverType === 'reduce'}
                    onChange={() => setWaiverType('reduce')}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600 }}>আংশিক মওকুফ</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ফি হ্রাস করুন</div>
                  </div>
                </label>
                <label style={{ 
                  flex: 1, 
                  padding: '12px', 
                  border: `2px solid ${waiverType === 'free' ? 'var(--success)' : 'var(--border)'}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: waiverType === 'free' ? 'rgba(16,185,129,0.05)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <input 
                    type="radio" 
                    name="waiverType" 
                    value="free" 
                    checked={waiverType === 'free'}
                    onChange={() => setWaiverType('free')}
                    style={{ accentColor: 'var(--success)' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600 }}>সম্পূর্ণ মওকুফ</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ফি মুক্ত করুন</div>
                  </div>
                </label>
              </div>
            </div>

            {/* New Amount (only for reduce) */}
            {waiverType === 'reduce' && (
              <div>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: 6, display: 'block' }}>
                  নতুন পরিমাণ (৳) <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="number"
                  className="add-fee-input"
                  value={waiverAmount}
                  onChange={e => setWaiverAmount(e.target.value)}
                  placeholder="নতুন ফি পরিমাণ লিখুন"
                  min={0}
                  max={Number(waiverFee.amount) - 1}
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  মূল পরিমাণ: ৳{waiverFee.amount} | হ্রাস: ৳{waiverAmount ? (Number(waiverFee.amount) - Number(waiverAmount)) : 0}
                </div>
              </div>
            )}

            {/* Reason */}
            <div>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: 6, display: 'block' }}>
                কারণ (ঐচ্ছিক)
              </label>
              <textarea
                className="add-fee-input"
                rows={3}
                value={waiverReason}
                onChange={e => setWaiverReason(e.target.value)}
                placeholder="মওকুফের কারণ লিখুন (যেমন: আর্থিক অসচ্ছলতা, মেধাবী শিক্ষার্থী, ইত্যাদি)"
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            {/* Warning */}
            <div style={{ 
              padding: 12, 
              background: 'rgba(239,68,68,0.1)', 
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 6,
              fontSize: '0.85rem',
              color: '#991b1b'
            }}>
              ⚠️ সতর্কতা: এই পরিবর্তন স্থায়ী এবং পূর্বাবস্থায় ফেরানো যাবে না।
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <Button variant="outline" onClick={() => { setWaiverModal(false); setWaiverFee(null); }}>
                বাতিল
              </Button>
              <Button 
                variant={waiverType === 'free' ? 'success' : 'primary'}
                onClick={applyWaiver}
                disabled={waiverType === 'reduce' && (!waiverAmount || Number(waiverAmount) >= Number(waiverFee.amount))}
              >
                {waiverType === 'free' ? 'সম্পূর্ণ মওকুফ করুন' : 'হ্রাস করুন'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Generate Monthly Fees Modal */}
      <Modal isOpen={genModal} onClose={() => setGenModal(false)} title="মাসিক ফি স্বয়ংক্রিয়ভাবে তৈরি করুন" size="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            প্রতিটি শ্রেণির নির্ধারিত মাসিক ফি অনুযায়ী সকল সক্রিয় শিক্ষার্থীর জন্য ফি রেকর্ড তৈরি হবে। যাদের ফি আগে থেকেই আছে তাদের বাদ দেওয়া হবে।
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: 6, display: 'block' }}>
                মাস <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <select
                className="add-fee-input"
                value={genMonth}
                onChange={e => setGenMonth(e.target.value)}
              >
                <option value="">-- মাস নির্বাচন --</option>
                {BANGLA_MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: 6, display: 'block' }}>বছর</label>
              <input
                type="number"
                className="add-fee-input"
                value={genYear}
                onChange={e => setGenYear(e.target.value)}
                min={2020} max={2100}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button variant="outline" onClick={() => setGenModal(false)}>বাতিল</Button>
            <Button onClick={generateMonthlyFees} disabled={genLoading || !genMonth}>
              {genLoading ? 'তৈরি হচ্ছে...' : 'ফি তৈরি করুন'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
