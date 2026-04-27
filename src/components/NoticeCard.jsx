import { useState, useEffect } from 'react';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { FiPrinter } from 'react-icons/fi';
import SiteLogo from './SiteLogo';
import { formatDate } from '../utils/dateFormat';
import './NoticeCard.css';

const categoryColors = {
  'পরীক্ষা': '#1a5c38',
  'ছুটি':    '#b8860b',
  'ভর্তি':   '#1a4a8a',
  'ফি':      '#8b1a1a',
  'রুটিন':   '#2e6da4',
  'সাধারণ':  '#555',
};

export default function NoticeCard({ notice }) {
  const { settings } = useSiteSettings();
  const [expanded, setExpanded] = useState(false);

  const date        = formatDate(notice.created_at) || '';
  const color       = categoryColors[notice.category] || '#1a5c38';
  const isImportant = notice.is_important == 1;

  // Lock body scroll when modal is open
  useEffect(() => {
    if (expanded) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [expanded]);

  // Format notice content with proper Madrasah format and convert links
  const formatNoticeContent = (content) => {
    // Check if content already has the formal opening
    let formattedContent = content;
    if (!content.includes('এতদ্বারা') && !content.includes('অবগতির জন্য জানানো যাচ্ছে')) {
      // Add formal opening
      const opening = 'এতদ্বারা অত্র মাদ্রাসার সকল শিক্ষার্থীর অবগতির জন্য জানানো যাচ্ছে যে, ';
      formattedContent = opening + content;
    }
    
    // Convert "ফলাফল দেখুন" text to clickable link
    formattedContent = formattedContent.replace(
      /"ফলাফল দেখুন"/g,
      '<a href="/result-check" style="color: #1a5c38; text-decoration: underline; font-weight: 600;">"ফলাফল দেখুন"</a>'
    );
    
    // Convert "আমার ফলাফল" text to clickable link (for logged-in students)
    formattedContent = formattedContent.replace(
      /"আমার ফলাফল"/g,
      '<a href="/student/result" style="color: #1a5c38; text-decoration: underline; font-weight: 600;">"আমার ফলাফল"</a>'
    );

    // Convert routine links: [[link:url|text]] → <a href="url">text</a>
    formattedContent = formattedContent.replace(
      /\[\[link:([^\|]+)\|([^\]]+)\]\]/g,
      '<a href="$1" style="color: #1a5c38; text-decoration: underline; font-weight: 600;">$2</a>'
    );
    
    return formattedContent;
  };

  const formattedContent = formatNoticeContent(notice.content);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${notice.title}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Hind Siliguri', sans-serif; 
            padding: 30px;
            background: white;
            line-height: 1.8;
          }
          .print-header { 
            text-align: center; 
            margin-bottom: 30px; 
            padding-bottom: 20px; 
            border-bottom: 2px solid #1a5c38; 
          }
          .print-logo img { 
            width: 60px; 
            height: 60px; 
            object-fit: contain; 
            margin-bottom: 10px; 
          }
          .print-institution h2 { 
            font-size: 1.5rem; 
            color: #1a5c38; 
            margin-bottom: 5px; 
          }
          .print-name-en { 
            font-size: 1rem; 
            color: #666; 
            margin-bottom: 5px; 
          }
          .print-address { 
            font-size: 0.85rem; 
            color: #888; 
            margin-bottom: 15px; 
          }
          .print-divider { 
            width: 100px; 
            height: 2px; 
            background: #c9a84c; 
            margin: 15px auto; 
          }
          .print-category { 
            display: inline-block; 
            background: #1a5c38; 
            color: white; 
            padding: 4px 12px; 
            border-radius: 4px; 
            font-size: 0.8rem; 
            margin-bottom: 10px; 
          }
          .print-title { 
            font-size: 1.3rem; 
            font-weight: 700; 
            color: #1a5c38; 
            margin-bottom: 20px; 
          }
          .bismillah { 
            text-align: center; 
            font-size: 1.3rem; 
            color: #1a5c38; 
            margin-bottom: 10px; 
            font-family: 'Amiri', serif; 
            direction: rtl; 
            letter-spacing: 1px; 
          }
          .salam { 
            text-align: center; 
            font-size: 1.1rem; 
            color: #1a5c38; 
            padding-bottom: 20px; 
            margin-bottom: 20px; 
            border-bottom: 2px solid #e8e0d0; 
            font-family: 'Amiri', serif; 
            direction: rtl; 
          }
          .content { 
            text-align: justify; 
            margin-bottom: 30px; 
            color: #333; 
          }
          .footer { 
            display: flex; 
            justify-content: space-between; 
            align-items: flex-end; 
            margin-top: 40px; 
            padding-top: 20px; 
            border-top: 1px solid #999; 
          }
          .signature { 
            text-align: center; 
          }
          .sig-line { 
            width: 120px; 
            border-top: 1px solid #333; 
            margin-bottom: 8px; 
          }
          .seal { 
            text-align: center; 
            margin-top: 15px; 
            font-size: 0.9rem; 
            color: #888; 
          }
          @media print {
            @page { size: A4 portrait; margin: 20mm; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="print-header">
          <div class="print-logo">
            ${settings.logoUrl ? `<img src="${settings.logoUrl}" alt="Logo" />` : ''}
          </div>
          <div class="print-institution">
            <h2>${settings.siteName}</h2>
            ${settings.siteNameEn ? `<p class="print-name-en">${settings.siteNameEn}</p>` : ''}
            ${settings.address ? `<p class="print-address">${settings.address}</p>` : ''}
          </div>
          <div class="print-divider"></div>
          <span class="print-category">${notice.category}</span>
          <h3 class="print-title">${notice.title}</h3>
        </div>
        
        <div class="bismillah">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</div>
        <div class="salam">السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ</div>
        
        <div class="content">${formattedContent}</div>
        
        <div class="footer">
          <div class="signature">
            <div class="sig-line"></div>
            <span>কর্তৃপক্ষের স্বাক্ষর</span>
          </div>
          <div>
            <span>তারিখ: ${date}</span>
          </div>
        </div>
        
        <div class="seal">— সিলমোহর —</div>
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

  return (
    <>
      {/* Card */}
      <div
        className={`nc-card${isImportant ? ' nc-important' : ''}`}
        onClick={() => setExpanded(true)}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && setExpanded(true)}
        title="বিস্তারিত দেখতে ক্লিক করুন"
      >
        <div className="nc-accent" style={{ background: color }} />

        {/* HEADER */}
        <div className="nc-header">
          <div className="nc-bismillah">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</div>
          <div className="nc-salam">السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ</div>
          <div className="nc-institution">
            <div className="nc-logo-wrap"><SiteLogo size={36} /></div>
            <div className="nc-inst-text">
              <div className="nc-inst-name">{settings.siteName}</div>
              {settings.siteNameAr && <div className="nc-inst-arabic">{settings.siteNameAr}</div>}
              <div className="nc-inst-address">{settings.address}</div>
            </div>
          </div>
          <div className="nc-divider"><span className="nc-divider-diamond">◆</span></div>
          <div className="nc-label-row">
            <span className="nc-label" style={{ borderColor: color, color }}>
              {isImportant ? '⚠ জরুরি বিজ্ঞপ্তি' : 'বিজ্ঞপ্তি'}
            </span>
            <span className="nc-category-tag" style={{ background: color }}>{notice.category}</span>
          </div>
          <h3 className="nc-title">{notice.title}</h3>
        </div>

        {/* BODY — fixed height, truncated */}
        <div className="nc-body">
          <p className="nc-content" dangerouslySetInnerHTML={{ __html: formattedContent }} />
          <div className="nc-body-fade" />
        </div>

        {/* FOOTER */}
        <div className="nc-footer">
          <div className="nc-footer-sig">
            <div className="nc-sig-line" />
            <span>কর্তৃপক্ষের স্বাক্ষর</span>
          </div>
          <div className="nc-footer-date">
            <span className="nc-date-label">তারিখ:</span>
            <span className="nc-date-val">{date}</span>
          </div>
        </div>
        <div className="nc-seal-row"><span className="nc-seal-text">— সিলমোহর —</span></div>
      </div>

      {/* Full-width body overlay */}
      {expanded && (
        <div className="nc-overlay" onClick={() => setExpanded(false)}>
          <div className="nc-overlay-panel" onClick={e => e.stopPropagation()}>
            <div className="nc-overlay-header no-print">
              <span className="nc-category-tag" style={{ background: color }}>{notice.category}</span>
              <h3 className="nc-overlay-title">{notice.title}</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="nc-print-btn" onClick={handlePrint} title="প্রিন্ট করুন">
                  <FiPrinter />
                </button>
                <button className="nc-overlay-close" onClick={() => setExpanded(false)}>✕</button>
              </div>
            </div>
            
            {/* Print-only header */}
            <div className="nc-print-header">
              <div className="nc-print-logo">
                {settings.logoUrl && <img src={settings.logoUrl} alt="Logo" />}
              </div>
              <div className="nc-print-institution">
                <h2>{settings.siteName}</h2>
                {settings.siteNameEn && <p className="nc-print-name-en">{settings.siteNameEn}</p>}
                {settings.address && <p className="nc-print-address">{settings.address}</p>}
              </div>
              <div className="nc-print-divider"></div>
              <div className="nc-print-notice-header">
                <span className="nc-print-category">{notice.category}</span>
                <h3 className="nc-print-title">{notice.title}</h3>
              </div>
            </div>

            <div className="nc-overlay-body">
              <div className="nc-overlay-bismillah">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</div>
              <div className="nc-overlay-salam">السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ</div>
              <p dangerouslySetInnerHTML={{ __html: formattedContent }} />
              
              {/* Print footer */}
              <div className="nc-print-footer">
                <div className="nc-print-sig">
                  <div className="nc-print-sig-line"></div>
                  <span>কর্তৃপক্ষের স্বাক্ষর</span>
                </div>
                <div className="nc-print-date">
                  <span>তারিখ: {date}</span>
                </div>
              </div>
              <div className="nc-print-seal">— সিলমোহর —</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
