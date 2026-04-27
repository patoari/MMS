import { useState, useEffect } from 'react';
import api from '../../services/api';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import Table from '../../components/Table';
import Pagination from '../../components/Pagination';
import SalaryReceipt from '../../components/SalaryReceipt';
import AdvancedSearchBar from '../../components/AdvancedSearchBar';
import { FiFileText, FiSearch, FiPrinter, FiDollarSign, FiUser } from 'react-icons/fi';
import swal from '../../utils/swal';
import { formatDate } from '../../utils/dateFormat';
import './ReceiptsList.css';

export default function ReceiptsList() {
  const [studentReceipts, setStudentReceipts] = useState([]);
  const [salaryReceipts, setSalaryReceipts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // all, student, salary
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [receiptType, setReceiptType] = useState(null);
  const [page, setPage] = useState(1);
  const PER_PAGE = 15;

  useEffect(() => {
    fetchReceipts();
  }, []);

  const fetchReceipts = async () => {
    try {
      // Fetch student fee receipts
      const studentRes = await api.get('/receipts');
      setStudentReceipts(Array.isArray(studentRes.data) ? studentRes.data : []);
    } catch (e) {
      console.error('Error fetching student receipts:', e);
    }

    try {
      // Fetch salary receipts
      const salaryRes = await api.get('/salary-receipts');
      setSalaryReceipts(Array.isArray(salaryRes.data) ? salaryRes.data : []);
    } catch (e) {
      console.error('Error fetching salary receipts:', e);
    }
  };

  // Combine and format all receipts
  const allReceipts = [
    ...studentReceipts.map(r => ({
      ...r,
      type: 'student',
      receipt_id: r.receipt_no,
      name: r.student_name,
      amount: r.total_this_paid,
      date: r.created_at,
      category: r.category,
    })),
    ...salaryReceipts.map(r => ({
      ...r,
      type: 'salary',
      receipt_id: r.receipt_number,
      name: r.teacher_name,
      amount: r.amount,
      date: r.created_at,
      category: 'বেতন প্রদান',
    }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  // Filter receipts
  const filteredReceipts = allReceipts.filter(r => {
    const matchesType = typeFilter === 'all' || r.type === typeFilter;
    const matchesSearch = !searchQuery || 
      r.receipt_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.category?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const paginatedReceipts = filteredReceipts.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const handleViewReceipt = async (receipt) => {
    try {
      if (receipt.type === 'student') {
        const res = await api.get(`/receipts/${receipt.receipt_no}`);
        setSelectedReceipt(res.data);
        setReceiptType('student');
      } else {
        const res = await api.get(`/salary-receipts/${receipt.receipt_id}`);
        setSelectedReceipt(res.data);
        setReceiptType('salary');
      }
    } catch (e) {
      await swal.error('রসিদ লোড করতে সমস্যা হয়েছে');
    }
  };

  const handlePrintStudentReceipt = (receipt) => {
    const printWindow = window.open('', '_blank');
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>ফি প্রদানের রসিদ - ${receipt.receipt_no}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Hind Siliguri', sans-serif; 
            background: white;
            padding: 8mm;
          }
          @page {
            size: 52mm 190mm;
            margin: 0;
          }
          .receipt-compact {
            border: 2px solid #1a5c38;
            padding: 8px;
            display: flex;
            flex-direction: column;
            width: 52mm;
            height: 190mm;
          }
          .receipt-header { 
            text-align: center; 
            margin-bottom: 6px; 
            padding-bottom: 4px; 
            border-bottom: 1px solid #1a5c38; 
          }
          .receipt-header h1 { 
            font-size: 0.85rem; 
            color: #1a5c38; 
            margin-bottom: 2px; 
            line-height: 1.2;
          }
          .receipt-number { 
            text-align: center;
            font-size: 0.75rem; 
            color: #1a5c38; 
            font-weight: 600; 
            margin: 4px 0; 
            word-break: break-all;
          }
          .info-section { 
            font-size: 0.65rem;
            margin: 4px 0;
          }
          .info-row { 
            display: flex; 
            gap: 4px;
            margin-bottom: 3px;
          }
          .info-label { 
            font-weight: 600; 
            color: #555; 
            min-width: 50px;
            flex-shrink: 0;
          }
          .info-value {
            flex: 1;
            word-break: break-word;
          }
          .amount-box { 
            background: #f0faf4; 
            border: 1px solid #1a5c38; 
            padding: 6px; 
            text-align: center; 
            margin: 6px 0; 
            border-radius: 3px; 
          }
          .amount-label {
            font-size: 0.6rem;
            color: #666;
            margin-bottom: 2px;
          }
          .amount-value { 
            font-size: 1rem; 
            font-weight: 700; 
            color: #1a5c38; 
          }
          .receipt-footer {
            margin-top: auto;
            padding-top: 4px;
            border-top: 1px solid #ddd;
            font-size: 0.55rem;
          }
          .signature-section {
            display: flex;
            justify-content: space-between;
            margin-top: 4px;
          }
          .signature-box {
            text-align: center;
            flex: 1;
          }
          .signature-line {
            width: 100%;
            max-width: 40px;
            border-top: 1px solid #333;
            margin: 3px auto;
          }
          .date-text {
            text-align: center;
            margin-top: 3px;
            font-size: 0.5rem;
            color: #888;
          }
          @media print {
            body { padding: 0; }
            .receipt-compact {
              border: 2px solid #1a5c38;
            }
          }
        </style>
      </head>
      <body>
        <div class="receipt-compact">
          <div class="receipt-header">
            <h1>ফি প্রদানের রসিদ</h1>
          </div>
          
          <div class="receipt-number">রসিদ: ${receipt.receipt_no}</div>
          
          <div class="info-section">
            <div class="info-row">
              <span class="info-label">শিক্ষার্থী:</span>
              <span class="info-value">${receipt.student_name}</span>
            </div>
            <div class="info-row">
              <span class="info-label">শ্রেণি:</span>
              <span class="info-value">${receipt.student_class}</span>
            </div>
            <div class="info-row">
              <span class="info-label">অভিভাবক:</span>
              <span class="info-value">${receipt.guardian || 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">ফোন:</span>
              <span class="info-value">${receipt.phone || 'N/A'}</span>
            </div>
          </div>
          
          <div class="amount-box">
            <div class="amount-label">প্রদত্ত ফি</div>
            <div class="amount-value">৳${Number(receipt.total_this_paid).toLocaleString()}</div>
          </div>
          
          <div class="receipt-footer">
            <div class="signature-section">
              <div class="signature-box">
                <div class="signature-line"></div>
                <div>প্রাপক</div>
              </div>
              <div class="signature-box">
                <div class="signature-line"></div>
                <div>অভিভাবক</div>
              </div>
            </div>
            <div class="date-text">
              ${formatDate(receipt.created_at)}
            </div>
          </div>
        </div>
      </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  };

  const totalAmount = filteredReceipts.reduce((sum, r) => sum + Number(r.amount), 0);
  const studentCount = filteredReceipts.filter(r => r.type === 'student').length;
  const salaryCount = filteredReceipts.filter(r => r.type === 'salary').length;

  return (
    <div className="receipts-page">
      <div className="receipts-header">
        <div>
          <h1 className="page-title">রসিদ ব্যবস্থাপনা</h1>
          <p className="page-subtitle">সকল ফি ও বেতন প্রদানের রসিদ</p>
        </div>
      </div>

      {/* Stats */}
      <div className="receipts-stats">
        <div className="rstat-card rstat-primary">
          <FiFileText size={24} />
          <div>
            <span className="rstat-val">{filteredReceipts.length}</span>
            <span className="rstat-label">মোট রসিদ</span>
          </div>
        </div>
        <div className="rstat-card rstat-blue">
          <FiUser size={24} />
          <div>
            <span className="rstat-val">{studentCount}</span>
            <span className="rstat-label">ফি রসিদ</span>
          </div>
        </div>
        <div className="rstat-card rstat-green">
          <FiDollarSign size={24} />
          <div>
            <span className="rstat-val">{salaryCount}</span>
            <span className="rstat-label">বেতন রসিদ</span>
          </div>
        </div>
        <div className="rstat-card rstat-purple">
          <FiDollarSign size={24} />
          <div>
            <span className="rstat-val">৳{totalAmount.toLocaleString()}</span>
            <span className="rstat-label">মোট পরিমাণ</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <AdvancedSearchBar 
        context="receipts"
        onSearch={(filters) => {
          setSearchQuery(filters.q || '');
          setTypeFilter('all');
          setPage(1);
        }}
        showSessionFilter={true}
        showClassFilter={false}
        showMonthFilter={true}
        showExamFilter={false}
      />

      {/* Table */}
      <div className="receipts-table-wrapper">
        <table className="receipts-table">
          <thead>
            <tr>
              <th>রসিদ নম্বর</th>
              <th>ধরন</th>
              <th>নাম</th>
              <th>ক্যাটাগরি</th>
              <th>পরিমাণ</th>
              <th>তারিখ</th>
              <th>অ্যাকশন</th>
            </tr>
          </thead>
          <tbody>
            {paginatedReceipts.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  {searchQuery ? 'কোনো রসিদ পাওয়া যায়নি' : 'কোনো রসিদ নেই'}
                </td>
              </tr>
            ) : (
              paginatedReceipts.map(receipt => (
                <tr key={`${receipt.type}-${receipt.receipt_id}`}>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                      {receipt.receipt_id}
                    </span>
                  </td>
                  <td>
                    <Badge variant={receipt.type === 'student' ? 'info' : 'success'}>
                      {receipt.type === 'student' ? 'ফি' : 'বেতন'}
                    </Badge>
                  </td>
                  <td>{receipt.name}</td>
                  <td>{receipt.category}</td>
                  <td style={{ fontWeight: 600, color: 'var(--success)' }}>
                    ৳{Number(receipt.amount).toLocaleString()}
                  </td>
                  <td>{formatDate(receipt.date)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleViewReceipt(receipt)}
                      >
                        দেখুন
                      </Button>
                      <Button 
                        size="sm" 
                        icon={<FiPrinter />}
                        onClick={() => {
                          if (receipt.type === 'student') {
                            handlePrintStudentReceipt(receipt);
                          } else {
                            handleViewReceipt(receipt);
                          }
                        }}
                      >
                        প্রিন্ট
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination 
        page={page} 
        total={filteredReceipts.length} 
        perPage={PER_PAGE} 
        onChange={setPage} 
      />

      {/* Receipt Modal */}
      {selectedReceipt && receiptType === 'salary' && (
        <Modal 
          isOpen={true} 
          onClose={() => { setSelectedReceipt(null); setReceiptType(null); }} 
          title="বেতন প্রদানের রসিদ" 
          size="md"
        >
          <SalaryReceipt 
            receipt={selectedReceipt} 
            onClose={() => { setSelectedReceipt(null); setReceiptType(null); }} 
          />
        </Modal>
      )}

      {selectedReceipt && receiptType === 'student' && (
        <Modal 
          isOpen={true} 
          onClose={() => { setSelectedReceipt(null); setReceiptType(null); }} 
          title="ফি প্রদানের রসিদ" 
          size="md"
        >
          <div style={{ padding: 20 }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <h3 style={{ color: 'var(--primary)', marginBottom: 8 }}>রসিদ নম্বর</h3>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>
                {selectedReceipt.receipt_no}
              </div>
            </div>
            
            <div style={{ background: 'var(--bg)', padding: 16, borderRadius: 8, marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>শিক্ষার্থী</div>
                  <div style={{ fontWeight: 600 }}>{selectedReceipt.student_name}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>শ্রেণি</div>
                  <div style={{ fontWeight: 600 }}>{selectedReceipt.student_class}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>মোট প্রদত্ত</div>
                  <div style={{ fontWeight: 600, color: 'var(--success)' }}>
                    ৳{Number(selectedReceipt.total_this_paid).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>তারিখ</div>
                  <div style={{ fontWeight: 600 }}>
                    {formatDate(selectedReceipt.created_at)}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <Button 
                variant="outline" 
                onClick={() => { setSelectedReceipt(null); setReceiptType(null); }}
              >
                বন্ধ করুন
              </Button>
              <Button 
                icon={<FiPrinter />}
                onClick={() => handlePrintStudentReceipt(selectedReceipt)}
              >
                প্রিন্ট করুন
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
