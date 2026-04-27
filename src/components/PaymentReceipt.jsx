import { useSiteSettings } from '../context/SiteSettingsContext';
import Button from './Button';
import { FiPrinter, FiX } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import { useState, useEffect } from 'react';
import api from '../services/api';
import './PaymentReceipt.css';

export default function PaymentReceipt({ receipt, onClose }) {
  const { settings } = useSiteSettings();
  const [realTotalDue, setRealTotalDue] = useState(null); // null = loading

  // Fetch actual total due for this student across ALL fees
  useEffect(() => {
    if (!receipt?.studentId || receipt.studentId === '—') {
      setRealTotalDue(0);
      return;
    }
    api.get(`/fees/student/${receipt.studentId}`)
      .then(res => {
        const allFees = Array.isArray(res.data) ? res.data : [];
        const due = allFees.reduce((s, f) => s + Math.max(0, Number(f.amount) - Number(f.paid)), 0);
        setRealTotalDue(due);
      })
      .catch(() => setRealTotalDue(null));
  }, [receipt?.studentId]);

  if (!receipt) return null;

  const lineItems  = receipt.lineItems || [];
  const grandTotal = lineItems.reduce((s, i) => s + Number(i.feeAmount), 0);
  const totalPaid  = receipt.totalThisPaid || lineItems.reduce((s, i) => s + Number(i.thisPaid), 0);
  const totalDue   = Math.max(0, grandTotal - lineItems.reduce((s, i) => s + Number(i.prevPaid) + Number(i.thisPaid), 0));

  const buildWhatsAppUrl = () => {
    // Normalise phone: 01XXXXXXXXX → +8801XXXXXXXXX
    let phone = (receipt.phone || '').replace(/\D/g, '');
    if (phone.length === 11 && phone.startsWith('0')) phone = '88' + phone;
    if (!phone) return null;

    // Helper: build a readable fee label based on category + month
    const feeLabel = (item) => {
      const cat = item.category || '';
      const mon = (item.month && item.month !== '—') ? item.month : '';
      if (cat === 'মাসিক ফি')   return mon ? `📅 মাসিক ফি — ${mon}` : '📅 মাসিক ফি';
      if (cat === 'পরীক্ষা ফি') return mon ? `📝 পরীক্ষা ফি — ${mon}` : '📝 পরীক্ষা ফি';
      if (cat === 'সেশন ফি')    return mon ? `🗓️ সেশন ফি — ${mon}` : '🗓️ সেশন ফি';
      if (cat === 'ভর্তি ফি')   return '🎓 ভর্তি ফি';
      return mon ? `💳 ${cat} — ${mon}` : `💳 ${cat}`;
    };

    const lines = [];
    lines.push(`✅ *${settings.siteName || 'মাদ্রাসা'}*`);
    lines.push(`📋 *ফি পরিশোধের বিজ্ঞপ্তি*`);
    lines.push(`─────────────────`);
    lines.push(`👤 শিক্ষার্থী: ${receipt.studentName}`);
    lines.push(`🆔 আইডি: ${receipt.studentId}`);
    lines.push(`📚 শ্রেণি: ${receipt.studentClass}`);
    lines.push(`📆 তারিখ: ${receipt.date}`);
    lines.push(`🧾 রশিদ নং: ${receipt.receiptNo}`);
    lines.push(`─────────────────`);
    lines.push(`*ফি বিবরণ:*`);

    lineItems.forEach(item => {
      const total    = Number(item.feeAmount);
      const alrPaid  = Number(item.prevPaid);       // paid before this transaction
      const thisPaid = Number(item.thisPaid);        // paid in this transaction
      const nowPaid  = alrPaid + thisPaid;           // total paid after this transaction
      const due      = Math.max(0, total - nowPaid); // remaining due

      lines.push(``);
      lines.push(feeLabel(item));
      lines.push(`   মোট ফি:      ৳${total.toLocaleString()}`);
      lines.push(`   পরিশোধিত:   ৳${nowPaid.toLocaleString()}${thisPaid > 0 && alrPaid > 0 ? ` (এবার ৳${thisPaid.toLocaleString()})` : ''}`);
      if (due > 0) {
        lines.push(`   বকেয়া:      ৳${due.toLocaleString()}`);
      } else {
        lines.push(`   ✔️ সম্পূর্ণ পরিশোধিত`);
      }
    });

    lines.push(``);
    lines.push(`─────────────────`);
    lines.push(`💰 এই পেমেন্টে পরিশোধিত: *৳${totalPaid.toLocaleString()}*`);
    const actualDue = realTotalDue !== null ? realTotalDue : totalDue;
    if (actualDue > 0) {
      lines.push(`⚠️ মোট বকেয়া (সকল ফি): *৳${actualDue.toLocaleString()}*`);
    } else {
      lines.push(`🎉 সকল ফি পরিশোধিত হয়েছে।`);
    }
    lines.push(`─────────────────`);
    lines.push(`ধন্যবাদ। 🙏`);

    const message = encodeURIComponent(lines.join('\n'));
    return `https://wa.me/${phone}?text=${message}`;
  };

  const whatsappUrl = buildWhatsAppUrl();

  const handlePrint = () => {
    const lineRows = lineItems.map((item, i) => `
      <tr>
        <td style="text-align:center;color:#999">${i + 1}</td>
        <td><span style="background:#e8f5ee;color:#1a5c38;padding:2px 8px;border-radius:12px;font-size:0.75rem;font-weight:600">${item.category}</span></td>
        <td>${item.month}</td>
        <td style="text-align:right;font-weight:600">৳${Number(item.feeAmount).toLocaleString()}</td>
        <td style="text-align:right;font-weight:700;color:#1a5c38">৳${Number(item.thisPaid).toLocaleString()}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8"/>
  <title>রশিদ — ${receipt.receiptNo}</title>
  <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap" rel="stylesheet"/>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Hind Siliguri',sans-serif;background:#fff;padding:24px;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .card{max-width:560px;margin:0 auto;border:1.5px solid #ccc;border-radius:10px;overflow:hidden}
    .hdr{background:#1a5c38;color:#fff;padding:20px 24px 0}
    .hdr-inner{display:flex;align-items:center;gap:16px;padding-bottom:14px}
    .logo{font-size:2.6rem;line-height:1}
    .org-name{font-size:1.05rem;font-weight:700}
    .org-sub{font-size:0.78rem;opacity:.8;margin-top:3px}
    .title-band{background:rgba(0,0,0,.25);text-align:center;padding:7px;font-size:.75rem;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,.9)}
    .meta{display:flex;justify-content:space-between;padding:12px 20px;background:#f8f8f8;border-bottom:1px solid #eee}
    .meta-label{font-size:.68rem;color:#999;font-weight:700;text-transform:uppercase;letter-spacing:.5px;display:block}
    .meta-value{font-size:.9rem;font-weight:700;color:#111}
    .mono{font-family:monospace;color:#1a5c38!important}
    .divider{border:none;border-top:1px dashed #ddd;margin:0 20px}
    .section{padding:14px 20px}
    .section-title{font-size:.68rem;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:.8px;margin-bottom:10px}
    .info-row{display:flex;justify-content:space-between;font-size:.85rem;padding:3px 0}
    .info-row span{color:#666} .info-row strong{color:#111}
    table{width:100%;border-collapse:collapse;font-size:.82rem}
    th{background:#f5f5f5;padding:8px 10px;text-align:left;font-size:.7rem;font-weight:700;color:#777;text-transform:uppercase;border-bottom:1.5px solid #e0e0e0}
    td{padding:9px 10px;border-bottom:1px solid #f0f0f0;color:#333}
    tr:last-child td{border-bottom:none}
    .summary{margin:0 20px 16px;border:1.5px solid #e0e0e0;border-radius:8px;overflow:hidden}
    .sum-row{display:flex;justify-content:space-between;padding:9px 14px;font-size:.875rem;border-bottom:1px solid #f0f0f0}
    .sum-row:last-child{border-bottom:none}
    .sum-row span:first-child{color:#555}
    .sum-hl{background:#f0faf4}
    .sum-paid{color:#1a5c38!important;font-size:1.05rem!important;font-weight:700!important}
    .sum-due{color:#c0392b!important}
    .footer{padding:14px 20px 18px;border-top:1px dashed #ddd;background:#fafafa}
    .sig-area{display:flex;justify-content:space-between;margin-bottom:14px}
    .sig-area>div{display:flex;flex-direction:column;align-items:center;gap:5px}
    .sig-line{width:130px;border-top:1px solid #999}
    .sig-area p{font-size:.72rem;color:#777}
    .footer-note{text-align:center;font-size:.68rem;color:#aaa;border-top:1px solid #eee;padding-top:10px}
    @media print{body{padding:0}@page{margin:10mm}}
  </style>
</head><body>
<div class="card">
  <div class="hdr">
    <div class="hdr-inner">
      <div class="logo">${settings.logoUrl ? `<img src="${settings.logoUrl}" style="height:48px;border-radius:6px"/>` : settings.logoEmoji}</div>
      <div>
        <div class="org-name">${settings.siteName}</div>
        ${settings.siteNameAr ? `<div class="org-sub" style="direction:rtl">${settings.siteNameAr}</div>` : ''}
        <div class="org-sub">${settings.address}</div>
        <div class="org-sub">${settings.phone} | ${settings.email}</div>
      </div>
    </div>
    <div class="title-band">ফি পরিশোধের রশিদ &nbsp;/&nbsp; Fee Payment Receipt</div>
  </div>

  <div class="meta">
    <div><span class="meta-label">রশিদ নং</span><span class="meta-value mono">${receipt.receiptNo}</span></div>
    <div><span class="meta-label">তারিখ</span><span class="meta-value">${receipt.date}</span></div>
  </div>

  <hr class="divider"/>

  <div class="section">
    <div class="section-title">শিক্ষার্থীর তথ্য</div>
    <div class="info-row"><span>শিক্ষার্থী আইডি</span><strong class="mono">${receipt.studentId || '—'}</strong></div>
    <div class="info-row"><span>নাম</span><strong>${receipt.studentName || '—'}</strong></div>
    <div class="info-row"><span>শ্রেণি</span><strong>${receipt.studentClass || '—'}</strong></div>
    ${receipt.guardian && receipt.guardian !== '—' ? `<div class="info-row"><span>অভিভাবক</span><strong>${receipt.guardian}</strong></div>` : ''}
    ${receipt.phone && receipt.phone !== '—' ? `<div class="info-row"><span>মোবাইল</span><strong>${receipt.phone}</strong></div>` : ''}
  </div>

  <hr class="divider"/>

  <div class="section">
    <div class="section-title">পেমেন্ট বিবরণ</div>
    <table>
      <thead><tr><th>#</th><th>ফি বিভাগ</th><th>মাস / সময়</th><th style="text-align:right">নির্ধারিত</th><th style="text-align:right">পরিশোধিত</th></tr></thead>
      <tbody>${lineRows}</tbody>
    </table>
  </div>

  <div class="summary">
    <div class="sum-row"><span>মোট নির্ধারিত ফি</span><span>৳${grandTotal.toLocaleString()}</span></div>
    <div class="sum-row sum-hl"><span>এই পেমেন্টে পরিশোধিত</span><span class="sum-paid">৳${totalPaid.toLocaleString()}</span></div>
    ${totalDue > 0 ? `<div class="sum-row"><span>অবশিষ্ট বকেয়া</span><span class="sum-due">৳${totalDue.toLocaleString()}</span></div>` : ''}
  </div>

  <div class="footer">
    <div class="sig-area">
      <div><div class="sig-line"></div><p>গ্রহীতার স্বাক্ষর</p></div>
      <div><div class="sig-line"></div><p>কর্তৃপক্ষের স্বাক্ষর ও সিল</p></div>
    </div>
    <p class="footer-note">এই রশিদটি ভবিষ্যতের জন্য সংরক্ষণ করুন। This is a computer-generated receipt.</p>
  </div>
</div>
<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();}}</script>
</body></html>`;

    const win = window.open('', '_blank', 'width=680,height=800');
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  return (
    <div className="receipt-overlay" onClick={onClose}>
      <div className="receipt-print-root" onClick={e => e.stopPropagation()}>

        {/* Toolbar */}
        <div className="receipt-toolbar">
          <Button icon={<FiPrinter />} onClick={handlePrint}>প্রিন্ট করুন</Button>
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '8px 16px', background: realTotalDue === null ? '#aaa' : '#25D366',
                color: '#fff', borderRadius: 8, fontFamily: 'inherit',
                fontSize: '0.9rem', fontWeight: 600, textDecoration: 'none',
                pointerEvents: realTotalDue === null ? 'none' : 'auto',
              }}
            >
              <FaWhatsapp size={18} />
              {realTotalDue === null ? 'লোড হচ্ছে...' : 'WhatsApp পাঠান'}
            </a>
          )}
          <button className="receipt-close-btn" onClick={onClose}><FiX /></button>
        </div>

        {/* Receipt preview */}
        <div className="receipt-card">
          <div className="receipt-header-bg">
            <div className="receipt-header-inner">
              <div className="receipt-logo-wrap">
                {settings.logoUrl
                  ? <img src={settings.logoUrl} alt="logo" className="receipt-logo-img" onError={e => { e.target.style.display='none'; }} />
                  : <span className="receipt-logo-emoji">{settings.logoEmoji}</span>}
              </div>
              <div className="receipt-org-info">
                <h1 className="receipt-org-name">{settings.siteName}</h1>
                {settings.siteNameAr && <p className="receipt-org-arabic">{settings.siteNameAr}</p>}
                <p className="receipt-org-address">{settings.address}</p>
                <p className="receipt-org-contact">{settings.phone} &nbsp;|&nbsp; {settings.email}</p>
              </div>
            </div>
            <div className="receipt-title-band">ফি পরিশোধের রশিদ &nbsp;/&nbsp; Fee Payment Receipt</div>
          </div>

          <div className="receipt-meta-row">
            <div className="receipt-meta-item">
              <span className="receipt-meta-label">রশিদ নং</span>
              <span className="receipt-meta-value receipt-mono">{receipt.receiptNo}</span>
            </div>
            <div className="receipt-meta-item">
              <span className="receipt-meta-label">তারিখ</span>
              <span className="receipt-meta-value">{receipt.date}</span>
            </div>
          </div>

          <div className="receipt-divider-dashed" />

          <div className="receipt-section">
            <div className="receipt-section-heading">শিক্ষার্থীর তথ্য</div>
            <div className="receipt-info-grid">
              {[
                ['শিক্ষার্থী আইডি', receipt.studentId],
                ['নাম',             receipt.studentName],
                ['শ্রেণি',          receipt.studentClass],
                ...(receipt.guardian && receipt.guardian !== '—' ? [['অভিভাবক', receipt.guardian]] : []),
                ...(receipt.phone    && receipt.phone    !== '—' ? [['মোবাইল',  receipt.phone]]    : []),
              ].map(([k, v]) => (
                <div className="receipt-info-row" key={k}>
                  <span>{k}</span><strong className={k === 'শিক্ষার্থী আইডি' ? 'receipt-mono' : ''}>{v || '—'}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="receipt-divider-dashed" />

          <div className="receipt-section">
            <div className="receipt-section-heading">পেমেন্ট বিবরণ</div>
            <table className="receipt-items-table">
              <thead>
                <tr><th>#</th><th>ফি বিভাগ</th><th>মাস / সময়</th><th>নির্ধারিত</th><th>পরিশোধিত</th></tr>
              </thead>
              <tbody>
                {lineItems.map((item, i) => (
                  <tr key={item.feeId || i}>
                    <td className="receipt-td-center">{i + 1}</td>
                    <td><span className="receipt-cat-badge">{item.category}</span></td>
                    <td>{item.month}</td>
                    <td className="receipt-td-right">৳{Number(item.feeAmount).toLocaleString()}</td>
                    <td className="receipt-td-right receipt-paid-cell">৳{Number(item.thisPaid).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="receipt-summary">
            <div className="receipt-summary-rows">
              <div className="receipt-summary-row"><span>মোট নির্ধারিত ফি</span><span>৳{grandTotal.toLocaleString()}</span></div>
              <div className="receipt-summary-row receipt-summary-highlight">
                <span>এই পেমেন্টে পরিশোধিত</span>
                <span className="receipt-summary-paid">৳{totalPaid.toLocaleString()}</span>
              </div>
              {totalDue > 0 && (
                <div className="receipt-summary-row"><span>অবশিষ্ট বকেয়া</span><span className="receipt-summary-due">৳{totalDue.toLocaleString()}</span></div>
              )}
            </div>
          </div>

          <div className="receipt-footer">
            <div className="receipt-sig-area">
              <div><div className="receipt-sig-line" /><p>গ্রহীতার স্বাক্ষর</p></div>
              <div><div className="receipt-sig-line" /><p>কর্তৃপক্ষের স্বাক্ষর ও সিল</p></div>
            </div>
            <p className="receipt-footer-note">এই রশিদটি ভবিষ্যতের জন্য সংরক্ষণ করুন। This is a computer-generated receipt.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
