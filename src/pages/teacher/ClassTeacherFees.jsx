import { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import swal from '../../utils/swal';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import Loader from '../../components/Loader';
import PaymentReceipt from '../../components/PaymentReceipt';
import { getCurrentDate } from '../../utils/dateFormat';
import { generateReceiptNo } from '../../utils';
import { statusVariant } from '../../constants';
import { FiSearch, FiDollarSign, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';

export default function ClassTeacherFees() {
  const [fees, setFees]               = useState([]);
  const [students, setStudents]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [filterStatus, setFilterStatus] = useState('সব');
  const [collectStudent, setCollectStudent] = useState(null);
  const [selectedFees, setSelectedFees]     = useState({});
  const [collecting, setCollecting]         = useState(false);
  const [activeReceipt, setActiveReceipt]   = useState(null);

  const fetchFees = () =>
    api.get('/fees').then(res => setFees(Array.isArray(res.data) ? res.data : [])).catch(() => {});

  useEffect(() => {
    Promise.all([
      api.get('/fees'),
      api.get('/teachers/me'),
    ]).then(([fRes, tRes]) => {
      setFees(Array.isArray(fRes.data) ? fRes.data : []);
      const cls = tRes.data?.class || '';
      if (cls) {
        api.get(`/students?class=${encodeURIComponent(cls)}&limit=200`)
          .then(r => setStudents(Array.isArray(r.data) ? r.data : [])).catch(() => {});
      }
    }).catch(() => swal.error('ডেটা লোড ব্যর্থ হয়েছে।'))
      .finally(() => setLoading(false));
  }, []);

  // Group fees by student
  const feesByStudent = useMemo(() => {
    const map = {};
    fees.forEach(f => {
      const sid = f.student_id || f.studentId;
      if (!map[sid]) map[sid] = [];
      map[sid].push(f);
    });
    return map;
  }, [fees]);

  // Build student rows with fee summary
  const studentRows = useMemo(() => {
    const q = search.toLowerCase();
    return students
      .map(s => {
        const sFees = feesByStudent[s.id] || [];
        const totalDue       = sFees.reduce((sum, f) => sum + Math.max(0, Number(f.due ?? (f.amount - f.paid))), 0);
        const totalCollected = sFees.reduce((sum, f) => sum + Number(f.paid), 0);
        const hasPending     = sFees.some(f => Number(f.due ?? (f.amount - f.paid)) > 0);
        return { ...s, sFees, totalDue, totalCollected, hasPending };
      })
      .filter(s => {
        const matchSearch = !q || s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
        const matchStatus = filterStatus === 'সব'
          || (filterStatus === 'বকেয়া' && s.hasPending)
          || (filterStatus === 'পরিশোধিত' && !s.hasPending);
        return matchSearch && matchStatus;
      });
  }, [students, feesByStudent, search, filterStatus]);

  const totalCollectedAll = fees.reduce((s, f) => s + Number(f.paid), 0);
  const totalDueAll       = fees.reduce((s, f) => s + Math.max(0, Number(f.due ?? (f.amount - f.paid))), 0);

  const openCollect = (student) => {
    const pendingFees = (feesByStudent[student.id] || []).filter(f => Number(f.due ?? (f.amount - f.paid)) > 0);
    const preSelected = {};
    pendingFees.forEach(f => { preSelected[f.id] = String(Number(f.due ?? (f.amount - f.paid))); });
    setSelectedFees(preSelected);
    setCollectStudent({ ...student, pendingFees });
  };

  const toggleFee = (feeId, due) => {
    setSelectedFees(prev => {
      if (prev[feeId] !== undefined) { const n = { ...prev }; delete n[feeId]; return n; }
      return { ...prev, [feeId]: String(due) };
    });
  };

  const totalSelected = Object.values(selectedFees).reduce((s, v) => s + (Number(v) || 0), 0);

  const onCollect = async () => {
    if (!collectStudent || totalSelected <= 0) return;
    setCollecting(true);
    try {
      const payments = Object.entries(selectedFees)
        .filter(([, v]) => Number(v) > 0)
        .map(([feeId, amount]) => ({ feeId, amount: Number(amount) }));

      await Promise.all(payments.map(({ feeId, amount }) =>
        api.post(`/fees/${feeId}/collect`, { amount })
      ));
      await fetchFees();

      const lineItems = payments.map(({ feeId, amount }) => {
        const fee = fees.find(f => f.id === feeId) || {};
        return { feeId, category: fee.category || '—', month: fee.month || '—',
                 feeAmount: Number(fee.amount || 0), prevPaid: Number(fee.paid || 0), thisPaid: Number(amount) };
      });

      const receipt = {
        receiptNo:    generateReceiptNo(),
        studentId:    collectStudent.id,
        studentName:  collectStudent.name,
        studentClass: collectStudent.class,
        guardian:     collectStudent.guardian || '—',
        phone:        collectStudent.phone    || '—',
        lineItems,
        totalThisPaid: payments.reduce((s, p) => s + p.amount, 0),
        date:      getCurrentDate(),
        createdAt: new Date().toISOString(),
      };

      try {
        await api.post('/receipts', {
          receipt_no: receipt.receiptNo, fee_id: payments[0]?.feeId || null,
          student_id: receipt.studentId, student_name: receipt.studentName,
          student_class: receipt.studentClass, guardian: receipt.guardian, phone: receipt.phone,
          line_items: JSON.stringify(receipt.lineItems), total_this_paid: receipt.totalThisPaid,
          paid_amount: receipt.totalThisPaid, total_amount: lineItems.reduce((s, i) => s + i.feeAmount, 0),
          total_paid: receipt.totalThisPaid,
          category: lineItems.map(i => i.category).join(', '),
          month:    lineItems.map(i => i.month).join(', '),
        });
      } catch {} // non-blocking

      swal.success('ফি সংগ্রহ সম্পন্ন হয়েছে।');
      setCollectStudent(null);
      setSelectedFees({});
      setActiveReceipt(receipt);
    } catch (err) {
      swal.error(err.message || 'ফি সংগ্রহ ব্যর্থ হয়েছে।');
    } finally {
      setCollecting(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 className="page-title">ফি সংগ্রহ</h1>
        <p className="page-subtitle">আপনার শ্রেণির শিক্ষার্থীদের ফি সংগ্রহ করুন</p>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        <SummaryCard icon={<FiCheckCircle />} label="মোট সংগ্রহ" value={`৳${totalCollectedAll.toLocaleString()}`} color="#10b981" />
        <SummaryCard icon={<FiAlertCircle />} label="মোট বকেয়া"  value={`৳${totalDueAll.toLocaleString()}`}       color="#ef4444" />
        <SummaryCard icon={<FiDollarSign />}  label="মোট শিক্ষার্থী" value={students.length}                      color="#6366f1" />
      </div>

      {/* Search + filter */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card-bg)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '8px 14px', flex: 1, minWidth: 200 }}>
          <FiSearch style={{ color: 'var(--text-muted)' }} />
          <input
            style={{ border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: '0.9rem', flex: 1 }}
            placeholder="নাম বা আইডি দিয়ে খুঁজুন..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['সব', 'বকেয়া', 'পরিশোধিত'].map(s => (
            <button key={s}
              onClick={() => setFilterStatus(s)}
              style={{ padding: '7px 14px', borderRadius: 8, border: '1.5px solid var(--border)', background: filterStatus === s ? 'var(--primary)' : 'var(--card-bg)', color: filterStatus === s ? '#fff' : 'var(--text)', fontFamily: 'inherit', fontSize: '0.85rem', cursor: 'pointer' }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Student fee table */}
      <div style={{ overflowX: 'auto', background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
              <th style={th}>রোল</th>
              <th style={th}>নাম</th>
              <th style={th}>আইডি</th>
              <th style={th}>মোট সংগ্রহ</th>
              <th style={th}>বকেয়া</th>
              <th style={th}>অবস্থা</th>
              <th style={th}>অ্যাকশন</th>
            </tr>
          </thead>
          <tbody>
            {studentRows.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>কোনো শিক্ষার্থী পাওয়া যায়নি।</td></tr>
            ) : studentRows.map(s => (
              <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={td}>{s.roll}</td>
                <td style={{ ...td, fontWeight: 500 }}>{s.name}</td>
                <td style={{ ...td, fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--primary)' }}>{s.id}</td>
                <td style={{ ...td, color: 'var(--success)', fontWeight: 600 }}>৳{s.totalCollected.toLocaleString()}</td>
                <td style={{ ...td, color: s.totalDue > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>৳{s.totalDue.toLocaleString()}</td>
                <td style={td}>
                  <Badge variant={s.hasPending ? 'danger' : 'success'}>{s.hasPending ? 'বকেয়া আছে' : 'পরিশোধিত'}</Badge>
                </td>
                <td style={td}>
                  <Button size="sm" variant="success" onClick={() => openCollect(s)}>ফি নিন</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Collect Modal */}
      <Modal isOpen={!!collectStudent} onClose={() => { setCollectStudent(null); setSelectedFees({}); }} title="ফি সংগ্রহ করুন" size="md">
        {collectStudent && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.1rem' }}>{collectStudent.name?.[0]}</div>
              <div>
                <div style={{ fontWeight: 700 }}>{collectStudent.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{collectStudent.id} · {collectStudent.class} · রোল: {collectStudent.roll}</div>
              </div>
            </div>

            {collectStudent.pendingFees.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>এই শিক্ষার্থীর কোনো বকেয়া ফি নেই।</p>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {collectStudent.pendingFees.map(f => {
                    const due     = Number(f.due ?? (f.amount - f.paid));
                    const checked = selectedFees[f.id] !== undefined;
                    return (
                      <div key={f.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 10, alignItems: 'center', padding: '10px 14px', borderRadius: 8, border: `1.5px solid ${checked ? 'var(--primary)' : 'var(--border)'}`, background: checked ? 'rgba(99,102,241,0.04)' : 'var(--card-bg)' }}>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{f.category}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{f.month}</div>
                        </div>
                        <span style={{ color: 'var(--danger)', fontWeight: 600, fontSize: '0.875rem' }}>৳{due.toLocaleString()}</span>
                        <input type="number" min={0} max={due} placeholder="৳"
                          disabled={!checked}
                          value={selectedFees[f.id] ?? ''}
                          onChange={e => setSelectedFees(p => ({ ...p, [f.id]: e.target.value }))}
                          style={{ width: 80, padding: '5px 8px', borderRadius: 6, border: '1.5px solid var(--border)', fontFamily: 'inherit', fontSize: '0.875rem', textAlign: 'right' }}
                        />
                        <input type="checkbox" checked={checked} onChange={() => toggleFee(f.id, due)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '2px solid var(--border)', marginBottom: 16 }}>
                  <span style={{ fontWeight: 600 }}>মোট পরিশোধযোগ্য</span>
                  <strong style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>৳{totalSelected.toLocaleString()}</strong>
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <Button variant="outline" onClick={() => { setCollectStudent(null); setSelectedFees({}); }}>বাতিল</Button>
                  <Button variant="success" onClick={onCollect} disabled={totalSelected <= 0 || collecting}>
                    {collecting ? 'সংগ্রহ হচ্ছে...' : 'সংগ্রহ করুন ও রশিদ তৈরি করুন'}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {activeReceipt && <PaymentReceipt receipt={activeReceipt} onClose={() => setActiveReceipt(null)} />}
    </div>
  );
}

function SummaryCard({ icon, label, value, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 20px', borderRadius: 14, background: color, color: '#fff' }}>
      <div style={{ fontSize: '1.6rem', opacity: 0.9 }}>{icon}</div>
      <div>
        <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{value}</div>
        <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>{label}</div>
      </div>
    </div>
  );
}

const th = { padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' };
const td = { padding: '12px 16px', color: 'var(--text)' };
