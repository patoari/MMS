import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { formatDate } from '../utils/dateFormat';
import Badge from './Badge';
import Loader from './Loader';
import QRCode from './QRCode';
import AdmitCard from './AdmitCard';
import {
  FiUser, FiDollarSign, FiAward, FiFileText, FiX,
  FiPrinter, FiCreditCard, FiCheckSquare, FiBookOpen
} from 'react-icons/fi';
import { statusVariant, gradeVariant } from '../constants';
import StudentAttendanceStats from './StudentAttendanceStats';
import './StudentDetailDrawer.css';

const BASE_TABS = [
  { key: 'profile',    label: 'প্রোফাইল',  icon: <FiUser /> },
  { key: 'idcard',     label: 'আইডি কার্ড', icon: <FiCreditCard /> },
  { key: 'attendance', label: 'হাজিরা',     icon: <FiCheckSquare /> },
  { key: 'fees',       label: 'ফি রেকর্ড', icon: <FiDollarSign /> },
  { key: 'results',    label: 'ফলাফল',     icon: <FiAward /> },
  { key: 'receipts',   label: 'রসিদ',       icon: <FiFileText /> },
];

export default function StudentDetailDrawer({ student, onClose }) {
  const [tab, setTab]         = useState('profile');
  const [fees, setFees]       = useState([]);
  const [results, setResults] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [upcomingExams, setUpcomingExams] = useState([]); // exams with paid fee
  const [activeAdmitCard, setActiveAdmitCard] = useState(null);
  const { settings } = useSiteSettings();
  const cardRef = useRef();

  const handlePrint = async () => {
    const printWindow = window.open('', '_blank');
    const frontCard = cardRef.current;
    const backCard = frontCard.nextElementSibling;
    
    // Get the QR code canvas and convert to data URL
    const qrCanvas = backCard?.querySelector('canvas');
    let qrDataUrl = '';
    if (qrCanvas) {
      qrDataUrl = qrCanvas.toDataURL('image/png');
    }
    
    const frontHTML = frontCard.innerHTML;
    let backHTML = backCard ? backCard.innerHTML : '';
    
    // Replace canvas with img tag for printing
    if (qrDataUrl && backHTML) {
      backHTML = backHTML.replace(
        /<canvas[^>]*><\/canvas>/,
        `<img src="${qrDataUrl}" style="display: block; width: 80px; height: 80px; border: 2px solid #e2e8f0; border-radius: 4px; background: #fff;" />`
      );
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Student ID Card - ${student.name}</title>
          <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
          <style>
            @page {
              margin: 0.5cm;
              size: A4 portrait;
            }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Hind Siliguri', sans-serif; 
              background: #f5f5f5;
              padding: 0;
              margin: 0;
            }
            .print-container {
              display: flex;
              justify-content: flex-end;
              padding: 10px;
              gap: 10px;
            }
            .sdd-id-card {
              width: 210px;
              height: 330px;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 4px 24px rgba(0,0,0,0.15);
              border: 1px solid #e2e8f0;
              background: #fff;
              position: relative;
              display: flex;
              flex-direction: column;
            }
            /* Watermark */
            .sdd-id-watermark {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              opacity: 0.06;
              pointer-events: none;
              z-index: 1;
              width: 140px;
              height: 140px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .sdd-id-watermark img {
              width: 100%;
              height: 100%;
              object-fit: contain;
            }
            .sdd-id-watermark-emoji {
              font-size: 140px;
              line-height: 1;
            }
            .sdd-id-card > *:not(.sdd-id-watermark) {
              position: relative;
              z-index: 2;
            }
            .sdd-id-topbar { 
              height: 3px; 
              background: linear-gradient(90deg, #1a5c38, #c9a84c); 
            }
            .sdd-id-header {
              background: linear-gradient(135deg, #1a5c38, #0f3d25);
              padding: 6px 8px; 
              display: flex; 
              align-items: center; 
              gap: 6px;
            }
            .sdd-id-logo { 
              width: 26px; 
              height: 26px; 
              border-radius: 5px; 
              background: rgba(255,255,255,0.15); 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              font-size: 1.1rem; 
              flex-shrink: 0; 
              overflow: hidden; 
            }
            .sdd-id-logo img { 
              width: 100%; 
              height: 100%; 
              object-fit: contain; 
            }
            .sdd-id-inst { flex: 1; }
            .sdd-id-inst-name { 
              font-size: 0.62rem; 
              font-weight: 700; 
              color: #e8c97a;
              line-height: 1.2;
            }
            .sdd-id-inst-sub { 
              font-size: 0.48rem; 
              color: rgba(255,255,255,0.6); 
              direction: rtl; 
              margin-top: 1px; 
            }
            .sdd-id-type {
              background: #c9a84c; 
              color: #fff;
              text-align: center; 
              padding: 2px;
              font-size: 0.48rem; 
              font-weight: 700; 
              letter-spacing: 0.08em;
            }
            .sdd-id-body { 
              display: flex; 
              gap: 6px; 
              padding: 6px 8px;
              flex: 1;
              overflow: hidden;
            }
            .sdd-id-left { 
              display: flex; 
              flex-direction: column; 
              align-items: center; 
              gap: 4px; 
              flex-shrink: 0; 
            }
            .sdd-id-photo {
              width: 44px; 
              height: 50px; 
              border-radius: 5px;
              background: #1a5c38; 
              color: #fff;
              display: flex; 
              align-items: center; 
              justify-content: center;
              font-size: 1.3rem; 
              font-weight: 700; 
              overflow: hidden;
              border: 1.5px solid #e2e8f0;
            }
            .sdd-id-photo img { 
              width: 100%; 
              height: 100%; 
              object-fit: cover; 
            }
            .sdd-id-badge-label {
              background: #1a5c38; 
              color: #fff;
              padding: 1px 6px; 
              border-radius: 6px; 
              font-size: 0.45rem; 
              font-weight: 600;
            }
            .sdd-id-right { flex: 1; min-width: 0; }
            .sdd-id-name { 
              font-size: 0.68rem; 
              font-weight: 800; 
              color: #1a5c38;
              line-height: 1.2;
            }
            .sdd-id-num { 
              font-size: 0.5rem; 
              color: #c9a84c; 
              font-weight: 600; 
              margin-top: 1px; 
              font-family: monospace; 
            }
            .sdd-id-divider { 
              height: 1px; 
              background: #e2e8f0; 
              margin: 4px 0; 
            }
            .sdd-id-fields { 
              display: grid; 
              grid-template-columns: 1fr 1fr; 
              gap: 2px; 
            }
            .sdd-id-field { 
              display: flex; 
              flex-direction: column;
              min-width: 0;
            }
            .sdd-id-field.full { 
              grid-column: 1 / -1; 
            }
            .sdd-id-field span { 
              font-size: 0.42rem; 
              color: #6b7280; 
            }
            .sdd-id-field strong { 
              font-size: 0.52rem; 
              color: #1a1a1a;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .sdd-id-footer {
              display: flex; 
              align-items: flex-end; 
              justify-content: space-between;
              padding: 5px 8px; 
              border-top: 1px dashed #e2e8f0;
              margin-top: auto;
            }
            .sdd-id-sig { 
              text-align: center; 
            }
            .sdd-id-sig-line { 
              width: 42px; 
              border-top: 1px solid #333; 
              margin-bottom: 2px; 
            }
            .sdd-id-sig span { 
              font-size: 0.4rem; 
              color: #6b7280; 
            }
            .sdd-id-barcode { 
              display: flex; 
              flex-direction: column; 
              align-items: center; 
              gap: 2px; 
            }
            .sdd-id-barcode-bars { 
              display: flex; 
              align-items: flex-end; 
              gap: 1px; 
            }
            .sdd-id-bar { 
              width: 1.2px; 
              background: #333; 
              border-radius: 0.5px; 
            }
            .sdd-id-barcode-text { 
              font-size: 0.4rem; 
              font-family: monospace; 
              color: #6b7280; 
            }
            .sdd-id-bottom {
              background: #1a5c38; 
              color: rgba(255,255,255,0.9);
              text-align: center; 
              padding: 3px; 
              font-size: 0.46rem; 
              font-weight: 500;
            }
            /* Backside styles */
            .sdd-id-card-back {
              width: 210px;
              height: 330px;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 4px 24px rgba(0,0,0,0.15);
              border: 1px solid #e2e8f0;
              background: #fff;
              display: flex;
              flex-direction: column;
            }
            .sdd-id-back-header {
              background: linear-gradient(135deg, #1a5c38, #0f3d25);
              padding: 6px 8px;
              text-align: center;
            }
            .sdd-id-back-title {
              font-size: 0.62rem;
              font-weight: 700;
              color: #e8c97a;
              margin-bottom: 2px;
            }
            .sdd-id-back-subtitle {
              font-size: 0.45rem;
              color: rgba(255,255,255,0.8);
            }
            .sdd-id-back-body {
              padding: 6px;
              flex: 1;
              overflow: hidden;
              display: flex;
              flex-direction: column;
            }
            .sdd-id-back-section {
              margin-bottom: 3px;
              flex-shrink: 0;
            }
            .sdd-id-back-section-title {
              font-size: 0.46rem;
              font-weight: 700;
              color: #1a5c38;
              margin-bottom: 2px;
              padding-bottom: 1px;
              border-bottom: 1px solid #e2e8f0;
            }
            .sdd-id-back-rules-text {
              font-size: 0.4rem;
              color: #1a1a1a;
              line-height: 1.35;
              margin: 0;
              text-align: justify;
            }
            .sdd-id-back-contact {
              background: #f4f7f4;
              padding: 3px;
              border-radius: 5px;
              margin-bottom: 3px;
            }
            .sdd-id-back-contact-item {
              display: flex;
              align-items: center;
              gap: 3px;
              font-size: 0.4rem;
              color: #1a1a1a;
              margin-bottom: 1px;
            }
            .sdd-id-back-contact-item:last-child {
              margin-bottom: 0;
            }
            .sdd-id-back-contact-label {
              font-weight: 600;
              color: #1a5c38;
              min-width: 28px;
            }
            .sdd-id-back-emergency {
              background: #fff3cd;
              border: 1px solid #ffc107;
              padding: 3px 5px;
              border-radius: 5px;
              margin-bottom: 3px;
            }
            .sdd-id-back-emergency-title {
              font-size: 0.45rem;
              font-weight: 700;
              color: #856404;
              margin-bottom: 2px;
            }
            .sdd-id-back-emergency-text {
              font-size: 0.4rem;
              color: #856404;
              line-height: 1.2;
            }
            .sdd-id-back-qr {
              display: flex;
              justify-content: center;
              align-items: center;
              padding: 5px;
              background: #f4f7f4;
              border-radius: 5px;
              flex-shrink: 0;
              margin-top: auto;
            }
            .sdd-id-back-qr canvas {
              display: block;
              border: 2px solid #e2e8f0;
              border-radius: 4px;
              background: #fff;
            }
            .sdd-id-back-footer {
              background: #1a5c38;
              color: rgba(255,255,255,0.9);
              text-align: center;
              padding: 3px;
              font-size: 0.4rem;
              font-weight: 500;
              margin-top: auto;
            }
            .sdd-id-back-footer-note {
              font-size: 0.38rem;
              opacity: 0.8;
              margin-top: 1px;
            }
            @media print {
              body { 
                background: white; 
                padding: 0;
                margin: 0;
              }
              .print-container {
                display: flex;
                justify-content: flex-end;
                padding: 10px;
              }
              .sdd-id-card { 
                box-shadow: none; 
                page-break-inside: avoid;
                border: 1px solid #ddd;
                width: 210px;
                height: 330px;
              }
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            <div class="sdd-id-card">
              ${frontHTML}
            </div>
            ${backHTML ? `<div class="sdd-id-card-back">${backHTML}</div>` : ''}
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  // Filters
  const [feeMonth, setFeeMonth]       = useState('');
  const [feeCategory, setFeeCategory] = useState('');
  const [feeStatus, setFeeStatus]     = useState('');
  const [examFilter, setExamFilter]   = useState('');
  const [sessionFilter, setSessionFilter] = useState('');
  const [sessions, setSessions]       = useState([]);
  const [exams, setExams]             = useState([]);

  useEffect(() => {
    if (!student) return;
    setTab('profile');
    setUpcomingExams([]);
    // Load sessions for filter dropdowns
    api.get('/sessions').then(r => setSessions(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    // Load upcoming exams where student has paid exam fee
    loadUpcomingExams();
  }, [student]);

  useEffect(() => {
    if (!student) return;
    if (tab === 'fees')     loadFees();
    if (tab === 'results')  loadResults();
    if (tab === 'receipts') loadReceipts();
  }, [tab, student]);

  // Reload fees when filters change
  useEffect(() => {
    if (tab === 'fees' && student) loadFees();
  }, [feeMonth, feeCategory, feeStatus, sessionFilter]);

  // Reload results when exam filter changes
  useEffect(() => {
    if (tab === 'results' && student) loadResults();
  }, [examFilter, sessionFilter]);

  // Load exams when session changes
  useEffect(() => {
    if (!sessionFilter) { setExams([]); return; }
    api.get(`/exams?session_id=${sessionFilter}`)
      .then(r => setExams(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  }, [sessionFilter]);

  const loadUpcomingExams = async () => {
    if (!student) return;
    try {
      // Get all upcoming/ongoing exams
      const [examsRes, feesRes, sessionRes] = await Promise.all([
        api.get('/exams'),
        api.get(`/fees?student_id=${student.id}&category=${encodeURIComponent('পরীক্ষা ফি')}&limit=200`),
        api.get('/sessions'),
      ]);
      const allExams = Array.isArray(examsRes.data) ? examsRes.data : [];
      const examFees = Array.isArray(feesRes.data) ? feesRes.data : [];
      const sessions = Array.isArray(sessionRes.data) ? sessionRes.data : [];
      const currentSession = sessions.find(s => s.is_current == 1);

      // Filter: only upcoming exams where student has paid (পরিশোধিত or আংশিক with full payment)
      const upcoming = allExams.filter(exam => {
        const autoStatus = exam.auto_status || exam.status;
        if (autoStatus === 'সম্পন্ন') return false; // hide completed exams
        // Check if student has a paid exam fee for this exam
        const paidFee = examFees.find(f =>
          f.month === exam.name &&
          (f.status === 'পরিশোধিত' || f.status === 'আংশিক' || Number(f.paid) > 0)
        );
        return !!paidFee;
      });

      // Attach session year
      const sessionYear = currentSession?.year || new Date().getFullYear();
      setUpcomingExams(upcoming.map(e => ({ ...e, sessionYear })));
    } catch {
      setUpcomingExams([]);
    }
  };

  const loadFees = async () => {
    setLoading(true);
    try {
      let q = `/fees?student_id=${student.id}&limit=200`;
      if (feeCategory) q += `&category=${encodeURIComponent(feeCategory)}`;
      if (feeStatus)   q += `&status=${encodeURIComponent(feeStatus)}`;
      if (sessionFilter) q += `&session_id=${sessionFilter}`;
      const r = await api.get(q);
      let list = Array.isArray(r.data) ? r.data : [];
      // client-side month filter
      if (feeMonth) list = list.filter(f => f.month?.includes(feeMonth));
      setFees(list);
    } catch { setFees([]); }
    setLoading(false);
  };

  const loadResults = async () => {
    setLoading(true);
    try {
      let q = `/results/check?studentId=${student.id}`;
      if (examFilter)    q += `&exam_id=${examFilter}`;
      if (sessionFilter) q += `&session_id=${sessionFilter}`;
      const r = await api.pub(q);
      setResults(r.data || null);
    } catch { setResults(null); }
    setLoading(false);
  };

  const loadReceipts = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/receipts?student_id=${student.id}&limit=200`);
      setReceipts(Array.isArray(r.data) ? r.data : []);
    } catch { setReceipts([]); }
    setLoading(false);
  };

  if (!student) return null;

  const feeTotals = {
    amount: fees.reduce((s, f) => s + Number(f.amount), 0),
    paid:   fees.reduce((s, f) => s + Number(f.paid), 0),
    due:    fees.reduce((s, f) => s + (Number(f.due) > 0 ? Number(f.due) : 0), 0),
  };

  // Show admit card tab only when there are upcoming exams with paid fee
  const TABS = [
    ...BASE_TABS,
    ...(upcomingExams.length > 0
      ? [{ key: 'admitcard', label: 'প্রবেশপত্র', icon: <FiBookOpen />, badge: upcomingExams.length }]
      : []),
  ];

  return (
    <>
    <div className="sdd-overlay" onClick={onClose}>
      <div className="sdd-drawer" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="sdd-header">
          <div className="sdd-header-info">
            <div className="sdd-avatar">
              {student.photo
                ? <img src={student.photo} alt={student.name} />
                : student.name?.[0]}
            </div>
            <div>
              <div className="sdd-name">{student.name}</div>
              <div className="sdd-meta">{student.id} · {student.class} · রোল {student.roll}</div>
            </div>
          </div>
          <button className="sdd-close" onClick={onClose}><FiX /></button>
        </div>

        {/* Tabs */}
        <div className="sdd-tabs">
          {TABS.map(t => (
            <button
              key={t.key}
              className={`sdd-tab${tab === t.key ? ' active' : ''}${t.key === 'admitcard' ? ' sdd-tab-admit' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.icon} {t.label}
              {t.badge > 0 && <span className="sdd-tab-badge">{t.badge}</span>}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="sdd-body">

          {/* ── PROFILE ── */}
          {tab === 'profile' && (
            <div className="sdd-profile">
              <div className="sdd-section-title">ব্যক্তিগত তথ্য</div>
              <div className="sdd-info-grid">
                {[
                  ['শিক্ষার্থী আইডি', student.id],
                  ['পূর্ণ নাম', student.name],
                  ['শ্রেণি', student.class],
                  ['রোল', student.roll],
                  ['সেকশন', student.section],
                  ['অবস্থা', student.status],
                  ['পিতার নাম', student.father_name_bn || student.guardian],
                  ['মাতার নাম', student.mother_name_bn || '—'],
                  ['অভিভাবক', student.guardian],
                  ['মোবাইল', student.phone],
                  ['ঠিকানা', student.address],
                  ['ভর্তির তারিখ', student.admission_date || '—'],
                ].map(([k, v]) => (
                  <div key={k} className="sdd-info-row">
                    <span className="sdd-info-key">{k}</span>
                    <span className="sdd-info-val">{v || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ID CARD ── */}
          {tab === 'idcard' && (
            <div className="sdd-idcard-wrap">
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <button className="sdd-print-btn" onClick={handlePrint}>
                  <FiPrinter /> প্রিন্ট করুন
                </button>
              </div>

              {/* Front Side */}
              <div ref={cardRef} className="sdd-id-card">
                {/* Watermark */}
                <div className="sdd-id-watermark">
                  {settings.logoUrl ? (
                    <img src={settings.logoUrl} alt="watermark" />
                  ) : (
                    <div className="sdd-id-watermark-emoji">{settings.logoEmoji || '🕌'}</div>
                  )}
                </div>

                {/* Top bar */}
                <div className="sdd-id-topbar" />

                {/* Header */}
                <div className="sdd-id-header">
                  <div className="sdd-id-logo">
                    {settings.logoUrl
                      ? <img src={settings.logoUrl} alt="logo" />
                      : <span>{settings.logoEmoji || '🕌'}</span>}
                  </div>
                  <div className="sdd-id-inst">
                    <div className="sdd-id-inst-name">{settings.siteName || 'মাদ্রাসা'}</div>
                    <div className="sdd-id-inst-sub">{settings.siteNameAr || ''}</div>
                  </div>
                </div>

                <div className="sdd-id-type">STUDENT IDENTITY CARD</div>

                {/* Body */}
                <div className="sdd-id-body">
                  <div className="sdd-id-left">
                    <div className="sdd-id-photo">
                      {student.photo
                        ? <img src={student.photo} alt={student.name} />
                        : <span>{student.name?.[0]}</span>}
                    </div>
                    <div className="sdd-id-badge-label">শিক্ষার্থী</div>
                  </div>
                  <div className="sdd-id-right">
                    <div className="sdd-id-name">{student.name}</div>
                    <div className="sdd-id-num">{student.id}</div>
                    <div className="sdd-id-divider" />
                    <div className="sdd-id-fields">
                      <div className="sdd-id-field"><span>শ্রেণি</span><strong>{student.class}</strong></div>
                      <div className="sdd-id-field"><span>রোল</span><strong>{student.roll}</strong></div>
                      <div className="sdd-id-field"><span>সেকশন</span><strong>{student.section}</strong></div>
                      <div className="sdd-id-field full"><span>পিতা</span><strong>{student.father_name_bn || student.guardian}</strong></div>
                      <div className="sdd-id-field full"><span>মাতা</span><strong>{student.mother_name_bn || '—'}</strong></div>
                      <div className="sdd-id-field full"><span>মোবাইল</span><strong>{student.phone}</strong></div>
                      <div className="sdd-id-field full"><span>ঠিকানা</span><strong>{student.address}</strong></div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="sdd-id-footer">
                  <div className="sdd-id-sig"><div className="sdd-id-sig-line" /><span>অধ্যক্ষের স্বাক্ষর</span></div>
                  <div className="sdd-id-barcode">
                    <div className="sdd-id-barcode-bars">
                      {student.id.split('').slice(0, 8).map((_, i) => (
                        <div key={i} className="sdd-id-bar" style={{ height: i % 3 === 0 ? 16 : i % 2 === 0 ? 12 : 14 }} />
                      ))}
                    </div>
                    <div className="sdd-id-barcode-text">{student.id}</div>
                  </div>
                  <div className="sdd-id-sig"><div className="sdd-id-sig-line" /><span>শিক্ষার্থীর স্বাক্ষর</span></div>
                </div>

                <div className="sdd-id-bottom">{settings.idCardFooterText || settings.aboutText?.slice(0, 55) || 'ইলম ও আমলের পথে আলোকিত ভবিষ্যৎ গড়ি'}</div>
              </div>

              {/* Back Side */}
              <div className="sdd-id-card-back">
                <div className="sdd-id-back-header">
                  <div className="sdd-id-back-title">শিক্ষার্থী পরিচয়পত্র</div>
                  <div className="sdd-id-back-subtitle">Student Identity Card</div>
                </div>

                <div className="sdd-id-back-body">
                  {/* Rules Section */}
                  <div className="sdd-id-back-section">
                    <div className="sdd-id-back-section-title">নিয়মাবলী / Rules</div>
                    <p className="sdd-id-back-rules-text">
                      {settings.idCardRules || 'এই কার্ডটি সর্বদা সাথে রাখতে হবে। হারিয়ে গেলে অবিলম্বে জানাতে হবে।'}
                    </p>
                  </div>

                  {/* Contact Section */}
                  <div className="sdd-id-back-section">
                    <div className="sdd-id-back-section-title">যোগাযোগ / Contact</div>
                    <div className="sdd-id-back-contact">
                      {settings.address && (
                        <div className="sdd-id-back-contact-item">
                          <span className="sdd-id-back-contact-label">ঠিকানা:</span>
                          <span>{settings.address}</span>
                        </div>
                      )}
                      {settings.phone && (
                        <div className="sdd-id-back-contact-item">
                          <span className="sdd-id-back-contact-label">ফোন:</span>
                          <span>{settings.phone}</span>
                        </div>
                      )}
                      {settings.email && (
                        <div className="sdd-id-back-contact-item">
                          <span className="sdd-id-back-contact-label">ইমেইল:</span>
                          <span>{settings.email}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Emergency Section */}
                  <div className="sdd-id-back-emergency">
                    <div className="sdd-id-back-emergency-title">জরুরি যোগাযোগ</div>
                    <div className="sdd-id-back-emergency-text">
                      অভিভাবক: {student.guardian || '—'}<br />
                      মোবাইল: {student.phone || '—'}
                    </div>
                  </div>

                  {/* QR Code */}
                  <div className="sdd-id-back-qr">
                    <QRCode 
                      value={`${window.location.origin}/student-verify?id=${student.id}`}
                      size={70}
                    />
                  </div>
                </div>

                <div className="sdd-id-back-footer">
                  <div>{(settings.idCardBackFooter1 || 'এই কার্ডটি {siteName} এর সম্পত্তি').replace('{siteName}', settings.siteName || 'মাদ্রাসা')}</div>
                  <div className="sdd-id-back-footer-note">{settings.idCardBackFooter2 || 'পাওয়া গেলে উপরের ঠিকানায় ফেরত দিন'}</div>
                </div>
              </div>
            </div>
          )}

          {/* ── ATTENDANCE ── */}
          {tab === 'attendance' && (
            <div>
              <div style={{ marginBottom: '0.75rem', fontSize: '0.82rem', color: '#718096' }}>
                সাপ্তাহিক, মাসিক ও বার্ষিক হাজিরার অনুপাত (ছুটির দিন বাদে)
              </div>
              <StudentAttendanceStats
                studentId={student.id}
                sessionId={sessions.find(s => s.is_current == 1)?.id ?? null}
                classId={student.class_id}
              />
            </div>
          )}

          {/* ── FEES ── */}
          {tab === 'fees' && (
            <div>
              {/* Filters */}
              <div className="sdd-filters">
                <select className="sdd-filter-select" value={sessionFilter} onChange={e => setSessionFilter(e.target.value)}>
                  <option value="">সব সেশন</option>
                  {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <input className="sdd-filter-input" placeholder="মাস (যেমন: জানুয়ারি)" value={feeMonth} onChange={e => setFeeMonth(e.target.value)} />
                <select className="sdd-filter-select" value={feeCategory} onChange={e => setFeeCategory(e.target.value)}>
                  <option value="">সব বিভাগ</option>
                  {['মাসিক ফি','পরীক্ষা ফি','সেশন ফি','ভর্তি ফি'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select className="sdd-filter-select" value={feeStatus} onChange={e => setFeeStatus(e.target.value)}>
                  <option value="">সব অবস্থা</option>
                  {['পরিশোধিত','আংশিক','বকেয়া','অগ্রিম'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Summary */}
              <div className="sdd-fee-summary">
                <div className="sdd-fee-sum-item"><span>নির্ধারিত</span><strong>৳{feeTotals.amount.toLocaleString()}</strong></div>
                <div className="sdd-fee-sum-item success"><span>পরিশোধিত</span><strong>৳{feeTotals.paid.toLocaleString()}</strong></div>
                <div className="sdd-fee-sum-item danger"><span>বকেয়া</span><strong>৳{feeTotals.due.toLocaleString()}</strong></div>
              </div>

              {loading ? <Loader /> : fees.length === 0 ? (
                <p className="sdd-empty">কোনো ফি রেকর্ড নেই</p>
              ) : (
                <table className="sdd-table">
                  <thead><tr><th>বিভাগ</th><th>মাস</th><th>নির্ধারিত</th><th>পরিশোধিত</th><th>বকেয়া</th><th>তারিখ</th><th>অবস্থা</th></tr></thead>
                  <tbody>
                    {fees.map(f => (
                      <tr key={f.id}>
                        <td>{f.category}</td>
                        <td>{f.month}</td>
                        <td>৳{f.amount}</td>
                        <td style={{ color: 'var(--success)', fontWeight: 600 }}>৳{f.paid}</td>
                        <td style={{ color: Number(f.due) > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>৳{f.due}</td>
                        <td>{f.date ? formatDate(f.date) : '—'}</td>
                        <td><Badge variant={statusVariant[f.status] || 'default'}>{f.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── RESULTS ── */}
          {tab === 'results' && (
            <div>
              {/* Filters */}
              <div className="sdd-filters">
                <select className="sdd-filter-select" value={sessionFilter} onChange={e => setSessionFilter(e.target.value)}>
                  <option value="">সব সেশন</option>
                  {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select className="sdd-filter-select" value={examFilter} onChange={e => setExamFilter(e.target.value)}>
                  <option value="">সব পরীক্ষা</option>
                  {exams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>

              {loading ? <Loader /> : !results ? (
                <p className="sdd-empty">কোনো ফলাফল পাওয়া যায়নি</p>
              ) : (
                (results.exams || []).map(exam => (
                  <div key={exam.exam_id} className="sdd-exam-card">
                    <div className="sdd-exam-header">
                      <div>
                        <div className="sdd-exam-name">{exam.exam_name}</div>
                        <div className="sdd-exam-meta">
                          মোট: {exam.total_obtained}/{exam.total_marks} · {exam.percentage}% ·
                          মেধাক্রম: #{exam.rank || '—'}
                        </div>
                      </div>
                      <Badge variant={exam.passed_all ? 'success' : 'danger'}>
                        {exam.passed_all ? 'উত্তীর্ণ' : 'অনুত্তীর্ণ'}
                      </Badge>
                    </div>
                    <table className="sdd-table">
                      <thead><tr><th>বিষয়</th><th>পূর্ণমান</th><th>প্রাপ্ত</th><th>গ্রেড</th></tr></thead>
                      <tbody>
                        {(exam.subjects || []).map((s, i) => (
                          <tr key={i}>
                            <td>{s.subject_name}</td>
                            <td>{s.total_marks}</td>
                            <td style={{ fontWeight: 600 }}>{s.obtained}</td>
                            <td><Badge variant={gradeVariant(s.grade)}>{s.grade}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── RECEIPTS ── */}
          {tab === 'receipts' && (
            <div>
              {loading ? <Loader /> : receipts.length === 0 ? (
                <p className="sdd-empty">কোনো রসিদ পাওয়া যায়নি</p>
              ) : (
                <table className="sdd-table">
                  <thead><tr><th>রসিদ নং</th><th>বিভাগ</th><th>মাস</th><th>পরিমাণ</th><th>তারিখ</th></tr></thead>
                  <tbody>
                    {receipts.map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{r.receipt_no || r.id}</td>
                        <td>{r.category || '—'}</td>
                        <td>{r.month || '—'}</td>
                        <td style={{ fontWeight: 600, color: 'var(--success)' }}>৳{r.paid_amount || r.total_this_paid || 0}</td>
                        <td>{r.created_at ? formatDate(r.created_at) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── ADMIT CARD ── */}
          {tab === 'admitcard' && (
            <div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                নিচের পরীক্ষাগুলোর জন্য ফি পরিশোধিত হয়েছে। প্রবেশপত্র দেখতে বা প্রিন্ট করতে বোতামে ক্লিক করুন।
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {upcomingExams.map(exam => (
                  <div key={exam.id} style={{
                    background: 'var(--bg)',
                    border: '1.5px solid var(--border)',
                    borderRadius: 10,
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', marginBottom: 4 }}>
                        {exam.name}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: 10 }}>
                        <span>শুরু: {formatDate(exam.start_date)}</span>
                        <span>শেষ: {formatDate(exam.end_date)}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Badge variant={exam.auto_status === 'চলমান' ? 'info' : 'warning'}>
                        {exam.auto_status || exam.status}
                      </Badge>
                      <button
                        onClick={() => setActiveAdmitCard({
                          studentId:   student.id,
                          studentName: student.name,
                          class:       student.class,
                          roll:        student.roll,
                          session:     exam.sessionYear,
                          examName:    exam.name,
                          photo:       student.photo || null,
                          section:     student.section || null,
                        })}
                        style={{
                          background: 'var(--primary)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 8,
                          padding: '7px 14px',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <FiBookOpen size={14} /> প্রবেশপত্র
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>

    {/* Admit Card Modal */}
    {activeAdmitCard && (
      <AdmitCard admitData={activeAdmitCard} onClose={() => setActiveAdmitCard(null)} />
    )}
  </>
  );
}