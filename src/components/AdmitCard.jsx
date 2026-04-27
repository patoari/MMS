import { useSiteSettings } from '../context/SiteSettingsContext';
import Button from './Button';
import { FiPrinter, FiX } from 'react-icons/fi';
import './AdmitCard.css';

export default function AdmitCard({ admitData, onClose }) {
  const { settings } = useSiteSettings();

  if (!admitData) return null;

  const handlePrint = () => {
    const html = `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8"/>
  <title>Admit Card — ${admitData.studentId}</title>
  <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=Amiri:wght@400;700&display=swap" rel="stylesheet"/>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Hind Siliguri','Inter',sans-serif;background:#f4f7f4;padding:12px;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .admit-card{max-width:750px;height:280mm;margin:0 auto 8px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1);position:relative;page-break-after:always}
    .card-border{position:absolute;inset:0;border:2px solid transparent;border-radius:12px;background:linear-gradient(135deg,#1a5c38 0%,#c9a84c 100%) border-box;-webkit-mask:linear-gradient(#fff 0 0) padding-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none}
    .header-bg{background:linear-gradient(135deg,#1a5c38 0%,#0f3d25 100%);padding:8px 16px;position:relative;overflow:hidden}
    .header-pattern{position:absolute;inset:0;opacity:0.08;background-image:radial-gradient(circle at 20% 50%,white 1px,transparent 1px),radial-gradient(circle at 80% 80%,white 1px,transparent 1px);background-size:40px 40px}
    .header-content{position:relative;z-index:1;display:flex;align-items:center;gap:10px}
    .logo-wrap{width:45px;height:45px;background:#fff;border-radius:8px;padding:3px;box-shadow:0 2px 6px rgba(0,0,0,0.2);flex-shrink:0}
    .logo-wrap img{width:100%;height:100%;object-fit:contain;border-radius:5px}
    .logo-emoji{font-size:1.6rem;display:flex;align-items:center;justify-content:center;height:100%}
    .school-info{flex:1;color:#fff;text-align:center;display:flex;flex-direction:column;gap:3px}
    .bismillah{font-family:'Amiri',serif;font-size:0.75rem;font-weight:700;letter-spacing:0.5px;color:#e8c97a;line-height:1;margin-bottom:2px}
    .school-name{font-size:0.95rem;font-weight:700;text-shadow:0 1px 2px rgba(0,0,0,0.2);letter-spacing:-0.2px;line-height:1.2}
    .school-subtitle{font-size:0.65rem;opacity:0.9;font-weight:500;line-height:1.2}
    .photo-container{width:60px;height:72px;background:#fff;border-radius:6px;padding:2px;box-shadow:0 2px 6px rgba(0,0,0,0.2);flex-shrink:0;border:2px solid #c9a84c}
    .photo-inner{width:100%;height:100%;border-radius:4px;overflow:hidden;background:linear-gradient(135deg,#f4f7f4 0%,#d1e8da 100%);display:flex;align-items:center;justify-content:center}
    .photo-inner img{width:100%;height:100%;object-fit:cover;display:block}
    .photo-placeholder{font-size:0.6rem;color:#999;text-align:center;font-weight:600}
    .title-section{background:linear-gradient(to right,#f4f7f4,#fff,#f4f7f4);padding:10px 16px;text-align:center;border-bottom:2px solid #e2e8f0;display:flex;align-items:center;justify-content:center;gap:12px}
    .admit-badge{background:linear-gradient(135deg,#1a5c38 0%,#2d8a56 100%);color:#fff;padding:4px 16px;border-radius:12px;font-size:0.7rem;font-weight:700;letter-spacing:0.5px;box-shadow:0 2px 6px rgba(26,92,56,0.3)}
    .exam-title{font-size:1rem;font-weight:700;color:#1a1a1a}
    .content-grid{padding:16px;display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .info-card{background:rgba(244,247,244,0.55);border-radius:8px;padding:12px;border-left:3px solid #1a5c38;position:relative;overflow:hidden}
    .info-card:nth-child(2){border-left-color:#c9a84c}
    .card-title{font-size:0.65rem;font-weight:700;color:#1a5c38;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;display:flex;align-items:center;gap:4px}
    .card-title:before{content:'';width:12px;height:2px;background:currentColor}
    .info-item{display:flex;align-items:baseline;margin-bottom:6px;font-size:0.8rem}
    .info-item:last-child{margin-bottom:0}
    .item-label{min-width:85px;font-weight:600;color:#4a5568;font-size:0.75rem}
    .item-value{flex:1;color:#1a1a1a;font-weight:600;font-size:0.8rem}
    .item-value.mono{font-family:'Courier New',monospace;color:#1a5c38;font-weight:700;font-size:0.85rem}
    .footer-section{padding:16px;background:rgba(244,247,244,0.55);border-top:1px dashed #c9a84c}
    .signatures-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:24px;margin-bottom:8px}
    .sig-item{text-align:center}
    .sig-space{height:32px}
    .sig-line{height:1px;background:linear-gradient(to right,transparent,#1a5c38,transparent);margin-bottom:4px}
    .sig-label{font-size:0.7rem;font-weight:600;color:#1a5c38;text-transform:uppercase;letter-spacing:0.3px}
    .footer-note{text-align:center;font-size:0.75rem;color:#6b7280;padding-top:8px;border-top:1px solid #e2e8f0;line-height:1.6;font-family:'Amiri',serif;direction:rtl}
    .body-watermark{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:260px;height:260px;opacity:0.15;pointer-events:none;z-index:0}
    .body-watermark img{width:100%;height:100%;object-fit:contain}
    .body-watermark-emoji{font-size:10rem;display:flex;align-items:center;justify-content:center;color:#1a5c38}
    .admit-body{position:relative}
    @media print{body{padding:0;background:#fff}@page{size:A4;margin:5mm}.admit-card{margin-bottom:0;box-shadow:none;height:auto;min-height:280mm}.card-border{display:none}}
  </style>
</head><body>
<div class="admit-card">
  <div class="card-border"></div>
  
  <div class="header-bg">
    <div class="header-pattern"></div>
    <div class="header-content">
      <div class="logo-wrap">
        ${settings.logoUrl ? `<img src="${settings.logoUrl}" alt="Logo"/>` : `<div class="logo-emoji">${settings.logoEmoji}</div>`}
      </div>
      <div class="school-info">
        <div class="bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
        <div class="school-name">${settings.siteName}</div>
        ${settings.siteNameAr ? `<div class="school-subtitle" style="direction:rtl">${settings.siteNameAr}</div>` : ''}
        <div class="school-subtitle">${settings.address}</div>
      </div>
      <div class="photo-container">
        <div class="photo-inner">
          ${admitData.photo ? `<img src="${admitData.photo}" alt="Student" crossorigin="anonymous" onerror="this.style.display='none';this.parentNode.innerHTML='<div class=\\'photo-placeholder\\'>PHOTO</div>'"/>` : '<div class="photo-placeholder">PHOTO</div>'}
        </div>
      </div>
    </div>
  </div>

  <div class="admit-body">
    <div class="body-watermark">
      ${settings.logoUrl
        ? `<img src="${settings.logoUrl}" alt=""/>`
        : `<div class="body-watermark-emoji">${settings.logoEmoji}</div>`}
    </div>

  <div class="title-section">
    <div class="admit-badge">প্রবেশপত্র</div>
    <div class="exam-title">${admitData.examName}</div>
  </div>

  <div class="content-grid">
    <div class="info-card">
      <div class="card-title">শিক্ষার্থীর তথ্য</div>
      <div class="info-item">
        <span class="item-label">শিক্ষার্থী আইডি</span>
        <span class="item-value mono">${admitData.studentId}</span>
      </div>
      <div class="info-item">
        <span class="item-label">নাম</span>
        <span class="item-value">${admitData.studentName}</span>
      </div>
      <div class="info-item">
        <span class="item-label">শ্রেণি</span>
        <span class="item-value">${admitData.class}</span>
      </div>
      ${admitData.version ? `<div class="info-item">
        <span class="item-label">ভার্সন</span>
        <span class="item-value">${admitData.version}</span>
      </div>` : ''}
      ${admitData.section ? `<div class="info-item">
        <span class="item-label">সেকশন</span>
        <span class="item-value">${admitData.section}</span>
      </div>` : ''}
    </div>
    
    <div class="info-card">
      <div class="card-title">একাডেমিক তথ্য</div>
      <div class="info-item">
        <span class="item-label">ক্লাস রোল</span>
        <span class="item-value">${admitData.roll || '--'}</span>
      </div>
      ${admitData.group ? `<div class="info-item">
        <span class="item-label">গ্রুপ</span>
        <span class="item-value">${admitData.group}</span>
      </div>` : ''}
      <div class="info-item">
        <span class="item-label">সেশন</span>
        <span class="item-value">${admitData.session}</span>
      </div>
      ${admitData.shift ? `<div class="info-item">
        <span class="item-label">শিফট</span>
        <span class="item-value">${admitData.shift}</span>
      </div>` : ''}
    </div>
  </div>

  <div class="footer-section">
    <div class="signatures-grid">
      <div class="sig-item">
        <div class="sig-space"></div>
        <div class="sig-line"></div>
        <div class="sig-label">শ্রেণি শিক্ষক</div>
      </div>
      <div class="sig-item">
        <div class="sig-space"></div>
        <div class="sig-line"></div>
        <div class="sig-label">প্রধান শিক্ষক</div>
      </div>
    </div>
    <div class="footer-note">"يجب على المرشحين إحضار هذه البطاقة في يوم الامتحان."</div>
  </div>
  </div><!-- end admit-body -->
</div>
<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();}}</script>
</body></html>`;

    const win = window.open('', '_blank', 'width=800,height=600');
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  return (
    <div className="admit-overlay" onClick={onClose}>
      <div className="admit-print-root" onClick={e => e.stopPropagation()}>

        {/* Toolbar */}
        <div className="admit-toolbar">
          <Button icon={<FiPrinter />} onClick={handlePrint}>প্রিন্ট করুন</Button>
          <button className="admit-close-btn" onClick={onClose}><FiX /></button>
        </div>

        {/* Admit Card preview */}
        <div className="admit-card-wrapper">
          <div className="admit-card-header">
            <div className="admit-header-content">
              <div className="admit-logo-wrap">
                {settings.logoUrl
                  ? <img src={settings.logoUrl} alt="logo" className="admit-logo-img" />
                  : <span className="admit-logo-emoji">{settings.logoEmoji}</span>}
              </div>
              <div className="admit-school-info">
                <div className="admit-bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
                <h1 className="admit-school-name">{settings.siteName}</h1>
                {settings.siteNameAr && <p className="admit-school-arabic">{settings.siteNameAr}</p>}
                <p className="admit-school-address">{settings.address}</p>
              </div>
              <div className="admit-photo-box">
                <div className="admit-photo-inner">
                  {admitData.photo 
                    ? <img src={admitData.photo} alt="Student" className="admit-photo" onError={e => { e.target.style.display='none'; }} />
                    : <div className="admit-photo-placeholder">PHOTO</div>
                  }
                </div>
              </div>
            </div>
          </div>

          <div className="admit-title-box">
            <div className="admit-badge">প্রবেশপত্র</div>
            <div className="admit-title-main">{admitData.examName}</div>
          </div>

          {/* Single body watermark */}
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 220, height: 220, opacity: 0.15,
              pointerEvents: 'none', zIndex: 0,
            }}>
              {settings.logoUrl
                ? <img src={settings.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                : <span style={{ fontSize: '8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1a5c38' }}>{settings.logoEmoji}</span>}
            </div>

          <div className="admit-content">
            <div className="admit-info-card">
              <div className="admit-card-title">শিক্ষার্থীর তথ্য</div>
              <div className="admit-info-section">
                <div className="admit-info-row">
                  <span className="admit-info-label">আইডি</span>
                  <span className="admit-info-value admit-mono">{admitData.studentId}</span>
                </div>
                <div className="admit-info-row">
                  <span className="admit-info-label">নাম</span>
                  <span className="admit-info-value">{admitData.studentName}</span>
                </div>
                <div className="admit-info-row">
                  <span className="admit-info-label">শ্রেণি</span>
                  <span className="admit-info-value">{admitData.class}</span>
                </div>
                {admitData.version && (
                  <div className="admit-info-row">
                    <span className="admit-info-label">Version</span>
                    <span className="admit-info-value">{admitData.version}</span>
                  </div>
                )}
                {admitData.section && (
                  <div className="admit-info-row">
                    <span className="admit-info-label">সেকশন</span>
                    <span className="admit-info-value">{admitData.section}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="admit-info-card">
              <div className="admit-card-title">একাডেমিক তথ্য</div>
              <div className="admit-info-section">
                <div className="admit-info-row">
                  <span className="admit-info-label">ক্লাস রোল</span>
                  <span className="admit-info-value">{admitData.roll || '--'}</span>
                </div>
                {admitData.group && (
                  <div className="admit-info-row">
                    <span className="admit-info-label">Group</span>
                    <span className="admit-info-value">{admitData.group}</span>
                  </div>
                )}
                <div className="admit-info-row">
                  <span className="admit-info-label">সেশন</span>
                  <span className="admit-info-value">{admitData.session}</span>
                </div>
                {admitData.shift && (
                  <div className="admit-info-row">
                    <span className="admit-info-label">Shift</span>
                    <span className="admit-info-value">{admitData.shift}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="admit-signatures">
            <div className="admit-signatures-grid">
              <div className="admit-sig-box">
                <div className="admit-sig-space" />
                <div className="admit-sig-line" />
                <div className="admit-sig-label">শ্রেণি শিক্ষক</div>
              </div>
              <div className="admit-sig-box">
                <div className="admit-sig-space" />
                <div className="admit-sig-line" />
                <div className="admit-sig-label">প্রধান শিক্ষক</div>
              </div>
            </div>
            <div className="admit-footer-note">
              "يجب على المرشحين إحضار هذه البطاقة في يوم الامتحان."
            </div>
          </div>
          </div>{/* end body watermark wrapper */}
        </div>
      </div>
    </div>
  );
}
