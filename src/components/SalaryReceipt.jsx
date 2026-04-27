import { useSiteSettings } from '../context/SiteSettingsContext';

export default function SalaryReceipt({ receipt, onClose }) {
  const { settings } = useSiteSettings();

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>বেতন প্রদানের রসিদ - ${receipt.receipt_number}</title>
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
          .receipt-name-en { 
            font-size: 0.6rem; 
            color: #666; 
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
            min-width: 45px;
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
            <h1>${settings.siteName}</h1>
            ${settings.siteNameEn ? `<p class="receipt-name-en">${settings.siteNameEn}</p>` : ''}
          </div>
          
          <div class="receipt-number">রসিদ: ${receipt.receipt_number}</div>
          
          <div class="info-section">
            <div class="info-row">
              <span class="info-label">শিক্ষক:</span>
              <span class="info-value">${receipt.teacher_name}</span>
            </div>
            <div class="info-row">
              <span class="info-label">মাস:</span>
              <span class="info-value">${receipt.month}</span>
            </div>
            <div class="info-row">
              <span class="info-label">তারিখ:</span>
              <span class="info-value">${receipt.payment_date}</span>
            </div>
            <div class="info-row">
              <span class="info-label">মাধ্যম:</span>
              <span class="info-value">${receipt.payment_method}</span>
            </div>
          </div>
          
          <div class="amount-box">
            <div class="amount-label">প্রদত্ত বেতন</div>
            <div class="amount-value">৳${Number(receipt.amount).toLocaleString()}</div>
            <div class="amount-label">${numberToWords(Number(receipt.amount))} টাকা মাত্র</div>
          </div>
          
          <div class="receipt-footer">
            <div class="signature-section">
              <div class="signature-box">
                <div class="signature-line"></div>
                <div>প্রাপক</div>
              </div>
              <div class="signature-box">
                <div class="signature-line"></div>
                <div>প্রদানকারী</div>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'var(--bg)', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <h3 style={{ color: 'var(--primary)', marginBottom: 8 }}>রসিদ নম্বর</h3>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>
            {receipt.receipt_number}
          </div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>শিক্ষকের নাম</div>
            <div style={{ fontWeight: 600 }}>{receipt.teacher_name}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>মাস</div>
            <div style={{ fontWeight: 600 }}>{receipt.month}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>পরিমাণ</div>
            <div style={{ fontWeight: 600, color: 'var(--success)' }}>৳{Number(receipt.amount).toLocaleString()}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>তারিখ</div>
            <div style={{ fontWeight: 600 }}>{receipt.payment_date}</div>
          </div>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button 
          onClick={onClose}
          style={{
            padding: '10px 20px',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            background: 'white',
            cursor: 'pointer'
          }}
        >
          বন্ধ করুন
        </button>
        <button 
          onClick={handlePrint}
          style={{
            padding: '10px 20px',
            borderRadius: '6px',
            border: 'none',
            background: 'var(--primary)',
            color: 'white',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          প্রিন্ট করুন
        </button>
      </div>
    </div>
  );
}

// Helper function to convert number to Bengali words
function numberToWords(num) {
  const ones = ['', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়'];
  const tens = ['', '', 'বিশ', 'ত্রিশ', 'চল্লিশ', 'পঞ্চাশ', 'ষাট', 'সত্তর', 'আশি', 'নব্বই'];
  const teens = ['দশ', 'এগারো', 'বারো', 'তেরো', 'চৌদ্দ', 'পনেরো', 'ষোলো', 'সতেরো', 'আঠারো', 'উনিশ'];
  
  num = Math.floor(num);
  
  if (num === 0) return 'শূন্য';
  if (num < 10) return ones[num];
  if (num < 20) return teens[num - 10];
  if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
  if (num < 1000) return ones[Math.floor(num / 100)] + ' শত' + (num % 100 ? ' ' + numberToWords(num % 100) : '');
  if (num < 100000) return numberToWords(Math.floor(num / 1000)) + ' হাজার' + (num % 1000 ? ' ' + numberToWords(num % 1000) : '');
  if (num < 10000000) return numberToWords(Math.floor(num / 100000)) + ' লক্ষ' + (num % 100000 ? ' ' + numberToWords(num % 100000) : '');
  
  return num.toLocaleString('en-US');
}
