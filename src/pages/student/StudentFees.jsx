import { useEffect, useState } from 'react';
import api from '../../services/api';
import Badge from '../../components/Badge';
import Card from '../../components/Card';
import { FiDollarSign, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';

export default function StudentFees() {
  const [fees, setFees] = useState([]);

  useEffect(() => {
    api.get('/fees/my').then(res => setFees(Array.isArray(res.data) ? res.data : [])).catch(() => {});
  }, []);

  const totalPaid = fees.reduce((s, f) => s + Number(f.paid), 0);
  const totalDue  = fees.reduce((s, f) => s + (Number(f.due) > 0 ? Number(f.due) : 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 className="page-title">আমার ফি</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <Card title="মোট পরিশোধিত" value={`৳${totalPaid}`} icon={<FiCheckCircle />} color="success" />
        <Card title="বকেয়া" value={`৳${totalDue}`} icon={<FiAlertCircle />} color="danger" />
        <Card title="মোট রেকর্ড" value={fees.length} icon={<FiDollarSign />} color="primary" />
      </div>
      <div className="card">
        <h3 style={{ color: 'var(--primary)', fontWeight: 600, marginBottom: 16 }}>পেমেন্ট ইতিহাস</h3>
        {fees.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>কোনো ফি তথ্য নেই</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                {['বিভাগ', 'মাস', 'মোট', 'পরিশোধিত', 'বকেয়া', 'অবস্থা'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fees.map(f => (
                <tr key={f.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 14px' }}>{f.category}</td>
                  <td style={{ padding: '10px 14px' }}>{f.month}</td>
                  <td style={{ padding: '10px 14px' }}>৳{f.amount}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--success)', fontWeight: 600 }}>৳{f.paid}</td>
                  <td style={{ padding: '10px 14px', color: Number(f.due) > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>৳{f.due}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <Badge variant={f.status === 'পরিশোধিত' ? 'success' : f.status === 'আংশিক' ? 'warning' : 'danger'}>{f.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
