import React, { useState, useRef } from 'react';
import Button from '../../components/Button';
import SelectBox from '../../components/SelectBox';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { useStudents } from '../../context/StudentContext';
import { useForm } from 'react-hook-form';
import { FiPrinter, FiFileText, FiDollarSign } from 'react-icons/fi';
import api from '../../services/api';
import { getCurrentDate } from '../../utils/dateFormat';
import './MonthlyReport.css';

const MONTHS = [
  'জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন',
  'জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর',
];
const MONTH_EN = ['01','02','03','04','05','06','07','08','09','10','11','12'];
const YEARS = ['2023','2024','2025','2026'];
const YEAR_EN = { '2023':'2023','2024':'2024','2025':'2025','2026':'2026' };
const monthOptions = MONTHS.map(m => ({ value: m, label: m }));
const yearOptions  = YEARS.map(y => ({ value: y, label: y }));

const fmt = (n) => Number(n || 0).toLocaleString();

// Convert number to Bengali words
function toBanglaWords(n) {
  const num = Math.round(Number(n || 0));
  if (num === 0) return 'শূন্য টাকা মাত্র';
  
  // Complete Bengali number words (1-99)
  const banglaNumbers = {
    1: 'এক', 2: 'দুই', 3: 'তিন', 4: 'চার', 5: 'পাঁচ', 6: 'ছয়', 7: 'সাত', 8: 'আট', 9: 'নয়',
    10: 'দশ', 11: 'এগারো', 12: 'বারো', 13: 'তেরো', 14: 'চৌদ্দ', 15: 'পনেরো', 16: 'ষোলো', 17: 'সতেরো', 18: 'আঠারো', 19: 'উনিশ',
    20: 'বিশ', 21: 'একুশ', 22: 'বাইশ', 23: 'তেইশ', 24: 'চব্বিশ', 25: 'পঁচিশ', 26: 'ছাব্বিশ', 27: 'সাতাশ', 28: 'আঠাশ', 29: 'ঊনত্রিশ',
    30: 'ত্রিশ', 31: 'একত্রিশ', 32: 'বত্রিশ', 33: 'তেত্রিশ', 34: 'চৌত্রিশ', 35: 'পঁয়ত্রিশ', 36: 'ছত্রিশ', 37: 'সাঁইত্রিশ', 38: 'আটত্রিশ', 39: 'ঊনচল্লিশ',
    40: 'চল্লিশ', 41: 'একচল্লিশ', 42: 'বিয়াল্লিশ', 43: 'তেতাল্লিশ', 44: 'চুয়াল্লিশ', 45: 'পঁয়তাল্লিশ', 46: 'ছেচল্লিশ', 47: 'সাতচল্লিশ', 48: 'আটচল্লিশ', 49: 'ঊনপঞ্চাশ',
    50: 'পঞ্চাশ', 51: 'একান্ন', 52: 'বাহান্ন', 53: 'তিপ্পান্ন', 54: 'চুয়ান্ন', 55: 'পঞ্চান্ন', 56: 'ছাপ্পান্ন', 57: 'সাতান্ন', 58: 'আটান্ন', 59: 'ঊনষাট',
    60: 'ষাট', 61: 'একষট্টি', 62: 'বাষট্টি', 63: 'তেষট্টি', 64: 'চৌষট্টি', 65: 'পঁয়ষট্টি', 66: 'ছেষট্টি', 67: 'সাতষট্টি', 68: 'আটষট্টি', 69: 'ঊনসত্তর',
    70: 'সত্তর', 71: 'একাত্তর', 72: 'বাহাত্তর', 73: 'তিয়াত্তর', 74: 'চুয়াত্তর', 75: 'পঁচাত্তর', 76: 'ছিয়াত্তর', 77: 'সাতাত্তর', 78: 'আটাত্তর', 79: 'ঊনআশি',
    80: 'আশি', 81: 'একাশি', 82: 'বিরাশি', 83: 'তিরাশি', 84: 'চুরাশি', 85: 'পঁচাশি', 86: 'ছিয়াশি', 87: 'সাতাশি', 88: 'আটাশি', 89: 'ঊননব্বই',
    90: 'নব্বই', 91: 'একানব্বই', 92: 'বিরানব্বই', 93: 'তিরানব্বই', 94: 'চুরানব্বই', 95: 'পঁচানব্বই', 96: 'ছিয়ানব্বই', 97: 'সাতানব্বই', 98: 'আটানব্বই', 99: 'নিরানব্বই'
  };
  
  const convertTwoDigit = (n) => banglaNumbers[n] || '';
  
  const convertThreeDigit = (n) => {
    if (n === 0) return '';
    const h = Math.floor(n / 100);
    const rest = n % 100;
    const parts = [];
    if (h > 0) parts.push(banglaNumbers[h] + ' শত');
    if (rest > 0) parts.push(convertTwoDigit(rest));
    return parts.join(' ');
  };
  
  const parts = [];
  let rem = num;
  
  const crore = Math.floor(rem / 10000000); 
  rem %= 10000000;
  if (crore > 0) parts.push(convertTwoDigit(crore) + ' কোটি');
  
  const lakh = Math.floor(rem / 100000);
  rem %= 100000;
  if (lakh > 0) parts.push(convertTwoDigit(lakh) + ' লক্ষ');
  
  const thou = Math.floor(rem / 1000);
  rem %= 1000;
  if (thou > 0) parts.push(convertTwoDigit(thou) + ' হাজার');
  
  if (rem > 0) parts.push(convertThreeDigit(rem));
  
  return parts.join(' ') + ' টাকা মাত্র';
}


export default function MonthlyReport() {
  const { register, watch } = useForm({ defaultValues: { month: 'জানুয়ারি', year: '2026' } });
  const { settings }        = useSiteSettings();
  const { allStudents }     = useStudents();

  const [tab, setTab]             = useState('fee');
  const [generated, setGenerated] = useState(false);
  const [feeData, setFeeData]         = useState({});
  const [dueCollected, setDueCollected] = useState({ dueBalance: {}, duePaidThisMonth: {} });
  const [finData, setFinData]     = useState(null);
  const [loading, setLoading]     = useState(false);
  const [voucherNo, setVoucherNo] = useState('');
  const reportRef = useRef();

  const selectedMonth = watch('month');
  const selectedYear  = watch('year');

  const generate = async () => {
    const enYear = YEAR_EN[selectedYear] || selectedYear;
    const monthLabel = `${selectedMonth} ${enYear}`; // Use English year: "জানুয়ারি 2026"
    const monthIdx = MONTHS.indexOf(selectedMonth);
    const monthKey = `${enYear}-${MONTH_EN[monthIdx] || '01'}`;

    setLoading(true);
    try {
      // Fetch fees for the exact month label (billing period, not payment date)
      const feesRes = await api.get(`/fees?month=${encodeURIComponent(monthLabel)}`);
      const periodFees = Array.isArray(feesRes.data) ? feesRes.data : [];

      // Fetch due collections — cumulative unpaid balance + prior-month payments this month
      const dueRes = await api.get(
        `/fees/due-collections?payment_month=${monthKey}&billing_month=${encodeURIComponent(monthLabel)}`
      );
      const dueBalance       = (dueRes.data?.due_balance        && typeof dueRes.data.due_balance === 'object')        ? dueRes.data.due_balance        : {};
      const duePaidThisMonth = (dueRes.data?.due_paid_this_month && typeof dueRes.data.due_paid_this_month === 'object') ? dueRes.data.due_paid_this_month : {};
      setDueCollected({ dueBalance, duePaidThisMonth });

      // Group ALL students by class — include every student regardless of whether
      // they have a fee record for this month, so due collections are always visible.
      const grouped = {};
      allStudents.forEach(s => {
        const cls = s.class || s.class_name || 'অজানা';
        if (!grouped[cls]) grouped[cls] = [];
        const studentFees = periodFees.filter(f =>
          (f.student_id || f.studentId) === s.id && f.category === 'মাসিক ফি'
        );
        const paid = studentFees.reduce((sum, f) => sum + Number(f.paid), 0);
        const due  = studentFees.reduce((sum, f) => sum + Math.max(0, Number(f.amount) - Number(f.paid)), 0);
        grouped[cls].push({ id: s.id, name: s.name, roll: s.roll, paid, due });
      });
      // Sort by roll within each class
      Object.keys(grouped).forEach(cls =>
        grouped[cls].sort((a, b) => Number(a.roll) - Number(b.roll))
      );
      setFeeData(grouped);

      // Finance voucher report (by actual payment date)
      const params = new URLSearchParams({
        month:    monthKey,
        month_bn: selectedMonth,
        year_bn:  selectedYear,
        year_en:  enYear,
      });
      const res = await api.get(`/transactions/monthly-report?${params}`);
      setFinData(res.data);
    } catch (e) {
      setFinData(null);
    } finally {
      setLoading(false);
    }

    setGenerated(true);
  };

  const handlePrint = () => {
    const printContent = reportRef.current;
    if (!printContent) return;

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Determine if we're printing fee report or voucher
    const isFeeReport = tab === 'fee';
    const pageOrientation = isFeeReport ? 'landscape' : 'portrait';

    // Get the HTML content
    const content = printContent.innerHTML;

    // Write the complete HTML document
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${isFeeReport ? 'ফি সংগ্রহ রিপোর্ট' : 'আয়-ব্যয় ভাউচার'}</title>
          <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
          <style>
            @page {
              size: A4 ${pageOrientation};
              margin: ${isFeeReport ? '8mm 6mm' : '10mm'};
            }
            
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: 'Hind Siliguri', Arial, sans-serif;
              background: white;
              color: #000;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            
            ${isFeeReport ? `
              /* Fee Report Styles */
              .mr-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding-bottom: 5px;
                border-bottom: 2px double #1a5c38;
                margin-bottom: 6px;
              }
              .mr-header-center {
                display: flex;
                align-items: center;
                gap: 10px;
                flex: 1;
                justify-content: center;
              }
              .mr-logo { font-size: 2rem; }
              .mr-logo img { height: 34px; width: 34px; object-fit: contain; }
              .mr-header-text { text-align: center; }
              .mr-header-text h1 { font-size: 0.82rem; font-weight: 800; color: #1a5c38; }
              .mr-header-text p { font-size: 0.58rem; color: #555; margin: 0; }
              .mr-period-badge {
                background: #1a5c38;
                color: #f0d080;
                padding: 3px 8px;
                border-radius: 6px;
                font-size: 0.65rem;
                font-weight: 700;
              }
              
              .mr-table-scroll { width: 100%; overflow: visible; }
              .mr-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 0.52rem;
                table-layout: fixed;
              }
              
              .mr-class-row { background: #1a5c38; }
              .mr-class-header {
                color: #f0d080;
                font-weight: 700;
                font-size: 0.56rem;
                text-align: center;
                padding: 3px 2px;
                border: 1px solid #0d3d25;
              }
              
              .mr-sub-row { background: #e8f5ee; }
              .mr-sub-th {
                color: #1a5c38;
                font-weight: 700;
                padding: 2px 1px;
                text-align: center;
                border: 1px solid #c8e6d4;
                font-size: 0.52rem;
              }
              .mr-sub-th-duecoll { color: #d97706; }
              
              .mr-row-even { background: #f9fdf9; }
              .mr-td-roll { width: 16px; text-align: center; padding: 2px 1px; border: 1px solid #e5e7eb; font-size: 0.52rem; }
              .mr-td-id { width: 56px; padding: 2px 1px; border: 1px solid #e5e7eb; font-family: monospace; font-size: 0.48rem; }
              .mr-td-fee { width: 32px; text-align: right; padding: 2px 1px; border: 1px solid #e5e7eb; font-weight: 600; }
              .mr-td-duecoll { width: 36px; text-align: right; padding: 2px 1px; border: 1px solid #e5e7eb; font-weight: 600; color: #d97706; }
              
              .mr-total-row { background: #fff3cd; }
              .mr-total-label { text-align: center; font-weight: 700; padding: 3px 2px; border: 1px solid #c8e6d4; font-size: 0.54rem; }
              .mr-total-val { text-align: right; font-weight: 800; padding: 3px 2px; border: 1px solid #c8e6d4; }
              .mr-total-duecoll { text-align: right; font-weight: 800; padding: 3px 2px; border: 1px solid #fde68a; color: #d97706; background: #fffbeb; }
              
              .mr-grand-summary {
                display: flex;
                gap: 0;
                margin-top: 6px;
                border: 2px solid #c9a84c;
                border-radius: 6px;
                overflow: hidden;
              }
              .mr-grand-item {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 8px 12px;
                background: #fffbf0;
                border-right: 1px solid #e9d89a;
              }
              .mr-grand-item:last-child { border-right: none; }
              .mr-grand-item-due { background: #fff8f0; }
              .mr-grand-item-total { background: #1a5c38; }
              .mr-grand-item-total .mr-grand-label,
              .mr-grand-item-total .mr-grand-value { color: #fff; }
              .mr-grand-label { font-size: 0.65rem; font-weight: 600; color: #555; margin-bottom: 4px; }
              .mr-grand-value { font-size: 0.82rem; font-weight: 800; color: #c9a84c; }
              .mr-grand-item-due .mr-grand-value { color: #d97706; }
              
              .report-signatures {
                display: flex;
                justify-content: space-around;
                margin-top: 14px;
                margin-bottom: 6px;
              }
              .report-sig { text-align: center; }
              .report-sig-line { width: 110px; border-bottom: 1.5px solid #333; margin: 0 auto 8px; }
              .report-sig p { font-size: 0.6rem; color: #555; }
              .report-footer-note { text-align: center; font-size: 0.58rem; color: #999; border-top: 1px solid #eee; padding-top: 4px; }
            ` : `
              /* Voucher Styles */
              .fv-letterhead { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 0; }
              .fv-bismillah { font-family: 'Amiri', serif; font-size: 1.1rem; color: #000; margin-bottom: 6px; direction: rtl; }
              .fv-logo-row { display: flex; align-items: center; justify-content: center; gap: 16px; }
              .fv-logo { width: 64px; height: 64px; object-fit: contain; }
              .fv-org { text-align: center; }
              .fv-org-bn { font-size: 1.5rem; font-weight: 900; color: #000; margin: 0; }
              .fv-org-addr { font-size: 0.78rem; color: #444; margin: 2px 0; }
              .fv-org-en { font-size: 0.9rem; font-weight: 600; color: #333; margin: 2px 0; }
              
              .fv-meta-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 16px;
                border: 1px solid #000;
                margin-top: 10px;
                font-size: 0.85rem;
                font-weight: 600;
              }
              .fv-period { font-size: 1rem; font-weight: 800; color: #000; }
              
              .fv-body { display: grid; grid-template-columns: 1fr 1fr; border: 1.5px solid #000; margin-top: 0; }
              .fv-col { padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; }
              .fv-income-col { border-right: 1.5px solid #000; }
              .fv-col-header {
                text-align: center;
                font-weight: 800;
                font-size: 0.95rem;
                color: #000;
                border-bottom: 1px solid #000;
                padding-bottom: 6px;
                margin-bottom: 4px;
              }
              
              .fv-items { display: flex; flex-direction: column; gap: 5px; }
              .fv-item-row { display: flex; align-items: baseline; gap: 4px; font-size: 0.85rem; line-height: 1.5; }
              .fv-item-num { flex-shrink: 0; font-weight: 600; min-width: 20px; }
              .fv-item-label { flex-shrink: 0; display: flex; flex-direction: column; gap: 1px; }
              .fv-voucher-tag { font-size: 0.68rem; color: #6366f1; font-weight: 600; }
              .fv-item-dashes { flex: 1; color: #999; overflow: hidden; font-size: 0.7rem; letter-spacing: 1px; }
              .fv-item-amount { flex-shrink: 0; font-weight: 700; text-align: right; min-width: 90px; }
              .fv-empty { color: #999; font-size: 0.82rem; text-align: center; padding: 8px 0; }
              
              .fv-divider { border-top: 1px solid #000; margin: 4px 0; }
              .fv-subtotal { font-weight: 800; font-size: 0.95rem; text-align: center; color: #000; }
              .fv-words { font-size: 0.78rem; color: #555; text-align: center; font-style: italic; }
              
              .fv-summary-block { display: flex; flex-direction: column; gap: 4px; margin-top: 4px; }
              .fv-summary-row { display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 600; }
              .fv-net { color: #000; font-weight: 800; }
              .fv-deficit { color: #dc2626; font-weight: 800; }
              .fv-prev { color: #92400e; }
              .fv-cumulative { font-size: 0.95rem; font-weight: 900; color: #000; }
              
              .fv-signatures { display: flex; justify-content: space-around; margin-top: 40px; padding-top: 10px; border-top: 1px solid #ddd; }
              .fv-sig { text-align: center; }
              .fv-sig-line { width: 160px; border-bottom: 1.5px dashed #333; margin: 0 auto 8px; }
              .fv-sig p { font-size: 0.8rem; color: #444; font-weight: 600; }
            `}
          </style>
        </head>
        <body>
          ${content}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    // Wait for content to load, then print
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const { dueBalance, duePaidThisMonth } = dueCollected;

  const CLASS_ORDER = ['মক্তব','হিফজ','প্রথম শ্রেণি','দ্বিতীয় শ্রেণি','তৃতীয় শ্রেণি','চতুর্থ শ্রেণি','পঞ্চম শ্রেণি','ষষ্ঠ শ্রেণি','সপ্তম শ্রেণি','অষ্টম শ্রেণি'];
  const classNames = Object.keys(feeData).filter(n => {
    const students = feeData[n] || [];
    // Show class if any student has a monthly fee OR a due collection this month
    return students.some(r =>
      Number(r.paid || 0) > 0 ||
      Number(duePaidThisMonth[r.id] || 0) > 0 ||
      Number(dueBalance[r.id] || 0) > 0
    );
  }).sort((a,b) => {
    const ai = CLASS_ORDER.indexOf(a), bi = CLASS_ORDER.indexOf(b);
    if (ai===-1&&bi===-1) return a.localeCompare(b);
    if (ai===-1) return 1; if (bi===-1) return -1; return ai-bi;
  });
  // Per-class: only keep students who have something to show
  const visibleFeeData = {};
  classNames.forEach(cls => {
    visibleFeeData[cls] = (feeData[cls] || []).filter(r =>
      Number(r.paid || 0) > 0 ||
      Number(duePaidThisMonth[r.id] || 0) > 0 ||
      Number(dueBalance[r.id] || 0) > 0
    );
  });
  const maxRows    = classNames.length > 0 ? Math.max(...classNames.map(c => (visibleFeeData[c] || []).length)) : 0;
  const grandTotal = classNames.reduce((s,c) => s + (visibleFeeData[c]||[]).reduce((ss,r) => ss+Number(r.paid||0), 0), 0);
  const grandDue   = classNames.reduce((s,c) => s + (visibleFeeData[c]||[]).reduce((ss,r) => ss+Number(r.due||0),  0), 0);
  const grandDueColl = Object.values(duePaidThisMonth || {}).reduce((s, v) => s + Number(v||0), 0);

  const today = getCurrentDate();

  return (
    <div className="monthly-report-page">
      {/* Controls */}
      <div className="report-controls no-print">
        <div>
          <h1 className="page-title">মাসিক রিপোর্ট</h1>
          <p className="page-subtitle">মাস ও বছর নির্বাচন করে রিপোর্ট তৈরি করুন</p>
        </div>
        <div className="report-controls-row">
          <SelectBox label="মাস" name="month" options={monthOptions} register={register} />
          <SelectBox label="বছর" name="year"  options={yearOptions}  register={register} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="input-label">ভাউচার নং (ঐচ্ছিক)</label>
            <input
              className="input-field"
              style={{ width: 140 }}
              placeholder="যেমন: 02"
              value={voucherNo}
              onChange={e => setVoucherNo(e.target.value)}
            />
          </div>
          <div style={{ alignSelf: 'flex-end' }}>
            <Button icon={<FiFileText />} onClick={generate} disabled={loading}>
              {loading ? 'লোড হচ্ছে...' : 'রিপোর্ট তৈরি করুন'}
            </Button>
          </div>
          {generated && (
            <div style={{ alignSelf: 'flex-end' }}>
              <Button variant="outline" icon={<FiPrinter />} onClick={handlePrint}>প্রিন্ট / PDF</Button>
            </div>
          )}
        </div>

        {/* Tab switcher */}
        {generated && (
          <div className="report-tabs no-print">
            <button className={`report-tab${tab==='fee' ? ' active' : ''}`} onClick={() => setTab('fee')}>
              <FiFileText /> ফি সংগ্রহ রিপোর্ট
            </button>
            <button className={`report-tab${tab==='finance' ? ' active' : ''}`} onClick={() => setTab('finance')}>
              <FiDollarSign /> আয়-ব্যয় ভাউচার
            </button>
          </div>
        )}
      </div>

      {/* ── FEE COLLECTION REPORT ── */}
      {generated && tab === 'fee' && (
        <>
          <div className="no-print" style={{ 
            background: '#eff6ff', 
            border: '1px solid #3b82f6', 
            borderRadius: 8, 
            padding: '10px 14px', 
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 10
          }}>
            <FiPrinter size={20} color="#3b82f6" />
            <p style={{ margin: 0, color: '#1e40af', fontSize: '0.85rem' }}>
              প্রিন্ট স্বয়ংক্রিয়ভাবে Landscape মোডে খুলবে। যদি Portrait দেখায়, ম্যানুয়ালি "Landscape" নির্বাচন করুন।
            </p>
          </div>
          <div className="report-document" ref={reportRef}>
          <div className="mr-header">
            <div className="mr-header-center">
              <div className="mr-logo">
                {settings.logoUrl ? <img src={settings.logoUrl} alt="logo" style={{ height:64,width:64,objectFit:'contain',borderRadius:8 }} /> : <span>{settings.logoEmoji}</span>}
              </div>
              <div className="mr-header-text">
                <h1>{settings.siteName}</h1>
                {settings.siteNameAr && <p style={{ direction:'rtl' }}>{settings.siteNameAr}</p>}
                <p>{settings.address}</p>
                {settings.phone && <p>{settings.phone} | {settings.email}</p>}
              </div>
            </div>
            <div className="mr-period-badge">{selectedMonth} — {YEAR_EN[selectedYear] || selectedYear} ইং</div>
          </div>
          <div className="mr-table-scroll">
            <table className="mr-table">
              <thead>
                <tr className="mr-class-row">
                  <th rowSpan={2} className="mr-class-header">ক্র.নং</th>
                  {classNames.map(cls => <th key={cls} colSpan={3} className="mr-class-header">{cls}</th>)}
                </tr>
                <tr className="mr-sub-row">
                  {classNames.map(cls => (
                    <React.Fragment key={cls}>
                      <th className="mr-sub-th">আইডি</th>
                      <th className="mr-sub-th">বেতন</th>
                      <th className="mr-sub-th mr-sub-th-duecoll" style={{color:'#d97706'}}>
                        <div>বকেয়া</div>
                        <div>আদায়</div>
                      </th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: maxRows }).map((_, i) => (
                  <tr key={i} className={i%2===0?'mr-row-even':''}>
                    <td className="mr-td-roll">{i + 1}</td>
                    {classNames.map(cls => {
                      const st = (visibleFeeData[cls]||[])[i];
                      return st ? (
                        <React.Fragment key={cls}>
                          <td className="mr-td-id">{st.id}</td>
                          <td className="mr-td-fee">{st.paid>0?st.paid:''}</td>
                          <td className="mr-td-duecoll">{(duePaidThisMonth[st.id]||0)>0?Number(duePaidThisMonth[st.id]).toLocaleString():''}</td>
                        </React.Fragment>
                      ) : (
                        <React.Fragment key={cls}>
                          <td className="mr-td-id"/><td className="mr-td-fee"/><td className="mr-td-duecoll"/>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="mr-total-row">
                  <td className="mr-total-label">মোট</td>
                  {classNames.map(cls => {
                    const t   = (visibleFeeData[cls]||[]).reduce((s,r)=>s+Number(r.paid||0),0);
                    const dcp = (visibleFeeData[cls]||[]).reduce((s,r)=>s+Number(duePaidThisMonth[r.id]||0), 0);
                    return (
                      <React.Fragment key={cls}>
                        <td className="mr-total-label"></td>
                        <td className="mr-total-val">{t.toLocaleString()}</td>
                        <td className="mr-total-duecoll">{dcp>0?dcp.toLocaleString():''}</td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Grand summary bar — full width below the table */}
          <div className="mr-grand-summary">
            <div className="mr-grand-item">
              <span className="mr-grand-label">মাসিক বেতন আদায়</span>
              <span className="mr-grand-value">৳ {grandTotal.toLocaleString()}</span>
            </div>
            {grandDueColl > 0 && (
              <div className="mr-grand-item mr-grand-item-due">
                <span className="mr-grand-label">পূর্ববর্তী বকেয়া আদায়</span>
                <span className="mr-grand-value">৳ {grandDueColl.toLocaleString()}</span>
              </div>
            )}
            <div className="mr-grand-item mr-grand-item-total">
              <span className="mr-grand-label">মোট আদায়</span>
              <span className="mr-grand-value">৳ {(grandTotal + grandDueColl).toLocaleString()}</span>
            </div>
          </div>
          <div className="report-signatures">
            {['হিসাবরক্ষক','প্রধান শিক্ষক','পরিচালনা কমিটি'].map(s => (
              <div key={s} className="report-sig"><div className="report-sig-line"/><p>{s}</p></div>
            ))}
          </div>
          <div className="report-footer-note">রিপোর্ট তৈরির তারিখ: {today} | {settings.siteName}</div>
        </div>
        </>
      )}

      {/* ── FINANCE VOUCHER ── */}
      {generated && tab === 'finance' && finData && (
        <>
          {/* Show info message if no data */}
          {finData.income_items.length === 0 && finData.expense_items.length === 0 && (
            <div className="no-print" style={{ 
              background: '#fff3cd', 
              border: '1px solid #ffc107', 
              borderRadius: 8, 
              padding: '12px 16px', 
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 10
            }}>
              <span style={{ fontSize: '1.2rem' }}>ℹ️</span>
              <div>
                <p style={{ margin: 0, color: '#856404', fontSize: '0.9rem', fontWeight: 600 }}>
                  এই মাসের জন্য কোনো আয় বা ব্যয়ের তথ্য পাওয়া যায়নি
                </p>
                <p style={{ margin: '4px 0 0 0', color: '#856404', fontSize: '0.8rem' }}>
                  দয়া করে নিশ্চিত করুন যে ফি সংগ্রহ, বেতন প্রদান বা লেনদেনের তারিখ সঠিকভাবে সেট করা আছে।
                </p>
              </div>
            </div>
          )}
          <div className="report-document finance-voucher" ref={reportRef}>
          {/* Letterhead */}
          <div className="fv-letterhead">
            <p className="fv-bismillah">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</p>
            <div className="fv-logo-row">
              {settings.logoUrl && <img src={settings.logoUrl} alt="logo" className="fv-logo" />}
              <div className="fv-org">
                <h1 className="fv-org-bn">{settings.siteName}</h1>
                <p className="fv-org-addr">{settings.address}</p>
                {settings.siteNameAr && <h2 className="fv-org-en">{settings.siteNameAr}</h2>}
              </div>
              {settings.logoUrl && <img src={settings.logoUrl} alt="logo" className="fv-logo" />}
            </div>
            <div className="fv-meta-row">
              <span>{voucherNo ? `ভাউচার নং: ${voucherNo}` : ''}</span>
              <span className="fv-period">{selectedMonth} — {selectedYear} ইং</span>
              <span>তারিখ: {today}</span>
            </div>
          </div>

          {/* Two-column body */}
          <div className="fv-body">
            {/* LEFT — Income */}
            <div className="fv-col fv-income-col">
              <div className="fv-col-header">মোট আয়</div>
              <div className="fv-items">
                {finData.income_items.map((item, i) => (
                  <div key={i} className="fv-item-row">
                    <span className="fv-item-num">{i+1}।</span>
                    <span className="fv-item-label">
                      {item.label}
                      {item.voucher_nos && <span className="fv-voucher-tag">ভাউচার: {item.voucher_nos}</span>}
                    </span>
                    <span className="fv-item-dashes">{'—'.repeat(8)}</span>
                    <span className="fv-item-amount">= {fmt(item.amount)}/-</span>
                  </div>
                ))}
                {finData.income_items.length === 0 && <p className="fv-empty">কোনো আয় নেই</p>}
              </div>
              <div className="fv-divider" />
              <div className="fv-subtotal">মোট = {fmt(finData.total_income)}/-</div>
              <div className="fv-words">({toBanglaWords(finData.total_income)})</div>
              <div className="fv-divider" />
              <div className="fv-summary-block">
                <div className="fv-summary-row"><span>মোট আয় =</span><span>{fmt(finData.total_income)}/-</span></div>
                <div className="fv-summary-row"><span>মোট ব্যয় =</span><span>{fmt(finData.total_expense)}/-</span></div>
                <div className="fv-divider" />
                {finData.net_this_month >= 0
                  ? <div className="fv-summary-row fv-net"><span>মোট উদ্বৃত্ত =</span><span>{fmt(finData.net_this_month)}/-</span></div>
                  : <div className="fv-summary-row fv-deficit"><span>মোট ঘাটতি =</span><span>{fmt(Math.abs(finData.net_this_month))}/-</span></div>
                }
                {finData.prev_balance !== 0 && (
                  <div className="fv-summary-row fv-prev">
                    <span>পূর্ববর্তী মাসের {finData.prev_balance >= 0 ? 'উদ্বৃত্ত' : 'ঘাটতি'} =</span>
                    <span>{fmt(Math.abs(finData.prev_balance))}/-</span>
                  </div>
                )}
                <div className="fv-divider" />
                <div className="fv-summary-row fv-cumulative">
                  <span>সর্বমোট {finData.cumulative_balance >= 0 ? 'উদ্বৃত্ত' : 'ঘাটতি'} =</span>
                  <span>{fmt(Math.abs(finData.cumulative_balance))}/-</span>
                </div>
              </div>
            </div>

            {/* RIGHT — Expense */}
            <div className="fv-col fv-expense-col">
              <div className="fv-col-header">মোট ব্যয়</div>
              <div className="fv-items">
                {finData.expense_items.map((item, i) => (
                  <div key={i} className="fv-item-row">
                    <span className="fv-item-num">{i+1}।</span>
                    <span className="fv-item-label">
                      {item.label}
                      {item.voucher_nos && <span className="fv-voucher-tag">ভাউচার: {item.voucher_nos}</span>}
                    </span>
                    <span className="fv-item-dashes">{'—'.repeat(8)}</span>
                    <span className="fv-item-amount">= {fmt(item.amount)}/-</span>
                  </div>
                ))}
                {finData.expense_items.length === 0 && <p className="fv-empty">কোনো ব্যয় নেই</p>}
              </div>
              <div className="fv-divider" />
              <div className="fv-subtotal">মোট = {fmt(finData.total_expense)}/-</div>
              <div className="fv-words">({toBanglaWords(finData.total_expense)})</div>
            </div>
          </div>

          {/* Signatures */}
          <div className="fv-signatures">
            {['কোষাধ্যক্ষের স্বাক্ষর','সেক্রেটারীর স্বাক্ষর','সভাপতির স্বাক্ষর'].map(s => (
              <div key={s} className="fv-sig"><div className="fv-sig-line"/><p>{s}</p></div>
            ))}
          </div>
        </div>
        </>
      )}
    </div>
  );
}
