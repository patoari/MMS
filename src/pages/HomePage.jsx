import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiCalendar, FiAward, FiBell } from 'react-icons/fi';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { useGallery } from '../context/GalleryContext';
import HeroCarousel from '../components/HeroCarousel';
import NoticeCard from '../components/NoticeCard';
import FloatingSymbols from '../components/FloatingSymbols';
import IslamicDivider from '../components/IslamicDivider';
import api from '../services/api';
import { useIslamicGreeting } from '../hooks/useIslamicGreeting';
import './HomePage.css';

const DEFAULT_CALLIGRAPHY = `بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ
الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ
سُبْحَانَ اللَّهِ وَبِحَمْدِهِ
لَا إِلَهَ إِلَّا اللَّهُ مُحَمَّدٌ رَسُولُ اللَّهِ
اللَّهُ أَكْبَرُ
طَلَبُ الْعِلْمِ فَرِيضَةٌ عَلَى كُلِّ مُسْلِمٍ
اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ
رَبِّ زِدْنِي عِلْمًا`;

export default function HomePage() {
  useIslamicGreeting();
  const { settings, activeFeatures, featuresLoading, featuresError, homepageTeachers } = useSiteSettings();
  const activeHomepageTeachers = homepageTeachers.filter(t => Number(t.is_active) === 1);
  const { images: gallery } = useGallery();
  const [notices, setNotices] = useState([]);
  const [homepageGallery, setHomepageGallery] = useState([]);
  const [writings, setWritings] = useState([]);
  const [selectedFeature, setSelectedFeature] = useState(null);

  // Parse calligraphy texts from settings (newline-separated)
  const calligraphyTexts = (settings.calligraphyTexts || DEFAULT_CALLIGRAPHY).split('\n').map(s => s.trim()).filter(Boolean);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [noticesRes, galleryRes, writingsRes] = await Promise.all([
          api.pub('/notices'),
          api.pub('/homepage-gallery'),
          api.pub('/student-writings')
        ]);
        
        setNotices(Array.isArray(noticesRes.data) ? noticesRes.data.slice(0, 3) : []);
        setHomepageGallery(Array.isArray(galleryRes.data) ? galleryRes.data : []);
        setWritings(Array.isArray(writingsRes.data) ? writingsRes.data : []);
      } catch (error) {
        console.error('Failed to load homepage data:', error);
      }
    };
    
    fetchData();
  }, []);

  return (
    <div className="home-page">
      <FloatingSymbols />
      {/* Hero */}
      <section className="hero-section islamic-pattern">
        {/* Islamic border decorations */}
        <div className="hero-geo-bg" />
        <div className="hero-border-beam" />
        <div className="hero-corner tl" />
        <div className="hero-corner tr" />
        <div className="hero-corner bl" />
        <div className="hero-corner br" />
        <div className="hero-star-ornament">✦ ✦ ✦</div>
        <div className="hero-inner">
          <div className="hero-left">
            <div className="hero-bismillah">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</div>
            <h1 className="hero-title">{settings.siteName}</h1>
            {settings.siteNameEn && (
              <p className="hero-title-en" style={{ 
                fontSize: '1.2rem', 
                fontWeight: 500, 
                color: 'rgba(255, 255, 255, 0.85)', 
                marginTop: '-0.5rem', 
                marginBottom: '1rem',
                letterSpacing: '0.5px'
              }}>
                {settings.siteNameEn}
              </p>
            )}
            <p className="hero-subtitle">{settings.heroSubtitle || 'ইলম ও আমলের পথে আলোকিত ভবিষ্যৎ গড়ি'}</p>
            <p className="hero-desc">{settings.heroDesc || 'আধুনিক শিক্ষা ও ইসলামী মূল্যবোধের সমন্বয়ে একটি আদর্শ শিক্ষা প্রতিষ্ঠান'}</p>
            <div className="hero-buttons">
              <Link to="/login" className="hero-btn-primary">লগইন করুন <FiArrowRight /></Link>
              <Link to="/result-check" className="hero-btn-outline">ফলাফল দেখুন</Link>
            </div>
            <div className="hero-stats">
              <div className="hero-stat">
                <span className="hero-stat-num">{settings.liveStudentCount ?? '—'}+</span>
                <span>{settings.statStudentLabel || 'শিক্ষার্থী'}</span>
              </div>
              <div className="hero-stat">
                <span className="hero-stat-num">{settings.liveTeacherCount ?? '—'}+</span>
                <span>{settings.statTeacherLabel || 'শিক্ষক'}</span>
              </div>
              <div className="hero-stat">
                <span className="hero-stat-num">{settings.statYears || '15+'}</span>
                <span>{settings.statYearsLabel || 'বছর'}</span>
              </div>
              <div className="hero-stat">
                <span className="hero-stat-num">{settings.statPassRate || '100%'}</span>
                <span>{settings.statPassRateLabel || 'পাসের হার'}</span>
              </div>
            </div>
          </div>
          <div className="hero-right">
            <HeroCarousel images={gallery} />
          </div>
        </div>
      </section>

      <IslamicDivider texts={calligraphyTexts} variant={0} />

      {/* Quick Links */}
      <section className="quick-links-section">
        <div className="section-container">
          <div className="section-islamic-frame">
            <div className="sif-corner sif-tl"/><div className="sif-corner sif-tr"/>
            <div className="sif-corner sif-bl"/><div className="sif-corner sif-br"/>
            <div className="sif-beam"/>
            <div className="quick-links-grid">
              {[
                { icon: <FiBell />,     label: 'নোটিশ বোর্ড',    to: '/notice',        color: 'primary' },
                { icon: <FiCalendar />, label: 'ক্লাস রুটিন',    to: '/class-routine', color: 'gold' },
                { icon: <FiCalendar />, label: 'পরীক্ষার রুটিন', to: '/exam-routine',  color: 'success' },
                { icon: <FiAward />,    label: 'ফলাফল দেখুন',    to: '/result-check',  color: 'info' },
              ].map((item, i) => (
                <Link key={i} to={item.to} className={`quick-link-card quick-link-${item.color}`}>
                  <div className="quick-link-icon">{item.icon}</div>
                  <span>{item.label}</span>
                  <FiArrowRight className="quick-link-arrow" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <IslamicDivider texts={calligraphyTexts} variant={1} />

      {/* Islamic Section */}
      <section className="islamic-section">
        <div className="section-container">
          <div className="section-islamic-frame">
            <div className="sif-corner sif-tl"/><div className="sif-corner sif-tr"/>
            <div className="sif-corner sif-bl"/><div className="sif-corner sif-br"/>
            <div className="sif-beam"/>
            <div className="islamic-grid">
              <div className="islamic-card hadith-card">
                <div className="islamic-card-label">আজকের হাদিস</div>
                <div className="arabic-text">{settings.hadithArabic}</div>
                <p className="bangla-text">"{settings.hadithBangla}"</p>
                <div className="source-text">— {settings.hadithSource}</div>
              </div>
              <div className="islamic-card quran-card">
                <div className="islamic-card-label">কুরআনের আয়াত</div>
                <div className="arabic-text">{settings.quranArabic}</div>
                <p className="bangla-text">"{settings.quranBangla}"</p>
                <div className="source-text">— {settings.quranSource}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <IslamicDivider texts={calligraphyTexts} variant={2} />

      {/* Notices */}
      <section className="notices-section">
        <div className="section-container">
          <div className="section-islamic-frame">
            <div className="sif-corner sif-tl"/><div className="sif-corner sif-tr"/>
            <div className="sif-corner sif-bl"/><div className="sif-corner sif-br"/>
            <div className="sif-beam"/>
            <div className="section-header">
              <h2 className="section-heading">সাম্প্রতিক নোটিশ</h2>
              <Link to="/notice" className="see-all-link">সব দেখুন <FiArrowRight /></Link>
            </div>
            <div className="notices-list">
              {notices.length === 0 && <p style={{ color: 'var(--text-muted)' }}>কোনো নোটিশ নেই।</p>}
              {notices.map(notice => (
                <NoticeCard key={notice.id} notice={notice} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Daily Advice */}
      {(settings.advice1Arabic || settings.advice2Arabic) && (
        <>
          <IslamicDivider texts={calligraphyTexts} variant={3} />
          <section className="islamic-section">
            <div className="section-container">
              <div className="section-islamic-frame">
                <div className="sif-corner sif-tl"/><div className="sif-corner sif-tr"/>
                <div className="sif-corner sif-bl"/><div className="sif-corner sif-br"/>
                <div className="sif-beam"/>
                <h2 className="section-heading text-center" style={{ marginBottom: 20 }}>
                {settings.adviceTitle || 'শিক্ষার্থীদের জন্য দৈনিক উপদেশ'}
              </h2>
              <div className="islamic-grid">
                {settings.advice1Arabic && (
                  <div className="islamic-card">
                    <div className="islamic-card-label">{settings.advice1Label || 'উপদেশ 1'}</div>
                    <div className="arabic-text">{settings.advice1Arabic}</div>
                    <p className="bangla-text">"{settings.advice1Bangla}"</p>
                    <div className="source-text">— {settings.advice1Source}</div>
                  </div>
                )}
                {settings.advice2Arabic && (
                  <div className="islamic-card">
                    <div className="islamic-card-label">{settings.advice2Label || 'উপদেশ 2'}</div>
                    <div className="arabic-text">{settings.advice2Arabic}</div>
                    <p className="bangla-text">"{settings.advice2Bangla}"</p>
                    <div className="source-text">— {settings.advice2Source}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
        </>
      )}

      {/* Teachers */}
      {activeHomepageTeachers.length > 0 && (
        <>
          <IslamicDivider texts={calligraphyTexts} variant={4} />
          <section className="teachers-section">
          <div className="section-container">
            <div className="section-islamic-frame">
              <div className="sif-corner sif-tl"/><div className="sif-corner sif-tr"/>
              <div className="sif-corner sif-bl"/><div className="sif-corner sif-br"/>
              <div className="sif-beam"/>
              <div className="section-header">
                <h2 className="section-heading">আমাদের শিক্ষকমণ্ডলী</h2>
              </div>
            <div className="teachers-grid">
              {activeHomepageTeachers.map(t => (
                <div key={t.id} className="teacher-intro-card">
                  <div className="tic-header">
                    {t.photo
                      ? <img src={t.photo} alt={t.name} onError={e => { e.target.style.display='none'; }} />
                      : <div className="tic-avatar">{t.name?.[0]}</div>}
                  </div>
                  <div className="tic-body">
                    <div className="tic-name">{t.name}</div>
                    {t.designation && <div className="tic-designation">{t.designation}</div>}
                    {t.subject && <div className="tic-subject">{t.subject}</div>}
                    {t.bio && <p className="tic-bio">{t.bio}</p>}
                  </div>
                </div>
              ))}
            </div>
            </div>{/* end section-islamic-frame */}
          </div>
        </section>
        </>
      )}

      {/* Achievements / News */}
      {(settings.achieve1Title || settings.achieve2Title) && (
        <>
          <IslamicDivider texts={calligraphyTexts} variant={4} />
        <section className="islamic-section">
          <div className="section-container">
            <div className="section-islamic-frame">
              <div className="sif-corner sif-tl"/><div className="sif-corner sif-tr"/>
              <div className="sif-corner sif-bl"/><div className="sif-corner sif-br"/>
              <div className="sif-beam"/>
              <h2 className="section-heading text-center" style={{ marginBottom: 20 }}>
                {settings.achieveTitle || 'সাফল্য ও অভিনন্দন'}
              </h2>
              <div className="islamic-grid">
                {settings.achieve1Title && (
                  <div className="islamic-card">
                    <div className="islamic-card-label">{settings.achieve1Label || 'শিক্ষক সাফল্য'}</div>
                    <div className="arabic-text" style={{ fontSize: '1.3rem' }}>{settings.achieve1Title}</div>
                    <p className="bangla-text">"{settings.achieve1Body}"</p>
                    {settings.achieve1Source && <div className="source-text">— {settings.achieve1Source}</div>}
                  </div>
                )}
                {settings.achieve2Title && (
                  <div className="islamic-card">
                    <div className="islamic-card-label">{settings.achieve2Label || 'শিক্ষার্থী সাফল্য'}</div>
                    <div className="arabic-text" style={{ fontSize: '1.3rem' }}>{settings.achieve2Title}</div>
                    <p className="bangla-text">"{settings.achieve2Body}"</p>
                    {settings.achieve2Source && <div className="source-text">— {settings.achieve2Source}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
        </>
      )}

      {/* Managing Committee */}
      <CommitteeSection calligraphyTexts={calligraphyTexts} />

      {/* Features */}
      {(featuresLoading || featuresError || activeFeatures.length > 0) && (
        <>
          <IslamicDivider texts={calligraphyTexts} variant={5} />
          <section className="features-section">
            <div className="section-container">
              <div className="section-islamic-frame">
                <div className="sif-corner sif-tl"/><div className="sif-corner sif-tr"/>
                <div className="sif-corner sif-bl"/><div className="sif-corner sif-br"/>
                <div className="sif-beam"/>
                <h2 className="section-heading text-center">আমাদের বৈশিষ্ট্য</h2>
                {featuresLoading && (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0' }}>লোড হচ্ছে...</p>
                )}
                {featuresError && (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0' }}>{featuresError}</p>
                )}
                {!featuresLoading && !featuresError && (
                  <div className="features-grid">
                    {activeFeatures.map(f => (
                      <FeatureCard
                        key={f.id}
                        feature={f}
                        onSeeMore={() => setSelectedFeature(f)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      )}

      {/* Student Writings */}
      {writings.length > 0 && (
        <>
          <IslamicDivider texts={calligraphyTexts} variant={5} />
          <StudentWritingsSection writings={writings} sectionTitle={settings.writingsTitle} />
        </>
      )}

      {/* Gallery */}
      {settings.showGallery !== '0' && homepageGallery.length > 0 && (
        <>
          <IslamicDivider texts={calligraphyTexts} variant={0} />
          <GallerySection
            images={homepageGallery}
            title={settings.galleryTitle || 'আমাদের গ্যালারি'}
            count={Number(settings.galleryCount) || 8}
          />
        </>
      )}

      {/* Feature Detail Modal */}
      {selectedFeature && (
        <FeatureModal 
          feature={selectedFeature} 
          onClose={() => setSelectedFeature(null)} 
        />
      )}
    </div>
  );
}

// Feature Card Component with fixed size and "See More" button
function FeatureCard({ feature, onSeeMore }) {
  const MAX_LENGTH = 100; // Maximum characters to show before truncating
  const isTruncated = feature.description && feature.description.length > MAX_LENGTH;
  const displayText = isTruncated 
    ? feature.description.substring(0, MAX_LENGTH) + '...' 
    : feature.description;

  return (
    <div className="feature-card">
      <div className="feature-icon">{feature.icon}</div>
      <h3 className="feature-title">{feature.title}</h3>
      <p className="feature-desc">{displayText}</p>
      {isTruncated && (
        <button className="feature-see-more" onClick={onSeeMore}>
          আরও দেখুন →
        </button>
      )}
    </div>
  );
}

// Feature Detail Modal
function FeatureModal({ feature, onClose }) {
  return (
    <div className="feature-modal-overlay" onClick={onClose}>
      <div className="feature-modal" onClick={e => e.stopPropagation()}>
        <button className="feature-modal-close" onClick={onClose}>✕</button>
        <div className="feature-modal-header">
          <div className="feature-modal-icon">{feature.icon}</div>
          <h2 className="feature-modal-title">{feature.title}</h2>
        </div>
        <div className="feature-modal-body">
          <p className="feature-modal-desc">{feature.description}</p>
        </div>
        <div className="feature-modal-footer">
          <button className="feature-modal-btn" onClick={onClose}>বন্ধ করুন</button>
        </div>
      </div>
    </div>
  );
}

function GallerySection({ images, title, count }) {
  const [lightbox, setLightbox] = useState(null); // { url, caption }

  return (
    <>
      <section className="gallery-section">
        <div className="section-container">
          <div className="section-islamic-frame">
            <div className="sif-corner sif-tl"/><div className="sif-corner sif-tr"/>
            <div className="sif-corner sif-bl"/><div className="sif-corner sif-br"/>
            <div className="sif-beam"/>
            <div className="section-header">
              <h2 className="section-heading">{title}</h2>
            </div>
            <div className="homepage-gallery-grid">
              {images.slice(0, count).map(img => (
                <div key={img.id} className="hg-item" onClick={() => setLightbox(img)} title="বড় করে দেখুন">
                  <img src={img.url} alt={img.caption || 'gallery'} loading="lazy"
                    onError={e => { e.target.style.display = 'none'; }} />
                  {img.caption && <div className="hg-caption">{img.caption}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Lightbox */}
      {lightbox && (
        <div className="hg-lightbox" onClick={() => setLightbox(null)}>
          <button className="hg-lb-close" onClick={() => setLightbox(null)}>✕</button>
          <img
            src={lightbox.url}
            alt={lightbox.caption || ''}
            className="hg-lb-img"
            onClick={e => e.stopPropagation()}
          />
          {lightbox.caption && (
            <div className="hg-lb-caption" onClick={e => e.stopPropagation()}>{lightbox.caption}</div>
          )}
        </div>
      )}
    </>
  );
}

const TYPE_ICONS = { 'প্রবন্ধ': '📝', 'কবিতা': '🌸', 'ছোটগল্প': '📖', 'ইসলামিক গান': '🎵', 'অন্যান্য': '✍️' };

function CommitteeSection({ calligraphyTexts }) {
  const [members, setMembers] = useState([]);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const res = await api.pub('/committee-members');
        setMembers(Array.isArray(res.data) ? res.data : []);
      } catch (error) {
        console.error('Failed to load committee members:', error);
      }
    };
    
    fetchMembers();
  }, []);

  if (members.length === 0) return null;

  return (
    <>
      <IslamicDivider texts={calligraphyTexts} variant={5} />
      <section className="committee-section">
        <div className="section-container">
          <div className="section-islamic-frame">
            <div className="sif-corner sif-tl"/><div className="sif-corner sif-tr"/>
            <div className="sif-corner sif-bl"/><div className="sif-corner sif-br"/>
            <div className="sif-beam"/>
            <div className="section-header">
              <h2 className="section-heading">পরিচালনা কমিটি</h2>
            </div>
            <div className="committee-grid">
              {members.map(member => (
                <div key={member.id} className="committee-card">
                  <div className="cc-header">
                    {member.photo 
                      ? <img src={member.photo} alt={member.name} onError={e => { e.target.style.display='none'; }} />
                      : <div className="cc-avatar">{member.name?.[0]}</div>
                    }
                  </div>
                  <div className="cc-body">
                    <div className="cc-name">{member.name}</div>
                    {member.position && <div className="cc-position">{member.position}</div>}
                    {member.phone && <div className="cc-contact">📞 {member.phone}</div>}
                    {member.email && <div className="cc-contact">✉️ {member.email}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function StudentWritingsSection({ writings, sectionTitle }) {
  const [active, setActive] = useState(null);
  if (!writings || writings.length === 0) return null;

  return (
    <>
      <section className="writings-section">
        <div className="section-container">
          <div className="section-islamic-frame">
            <div className="sif-corner sif-tl"/><div className="sif-corner sif-tr"/>
            <div className="sif-corner sif-bl"/><div className="sif-corner sif-br"/>
            <div className="sif-beam"/>
            <h2 className="section-heading text-center">{sectionTitle || 'শিক্ষার্থীদের লেখালেখি'}</h2>
            <div className="writings-grid">
              {writings.map(w => (
                <div key={w.id} className="writing-card" onClick={() => setActive(w)}>
                  <div className="wc-type-badge">{TYPE_ICONS[w.type] || '✍️'} {w.type}</div>
                  <h3 className="wc-title">{w.title}</h3>
                  <p className="wc-preview">{w.content}</p>
                  <div className="wc-footer">
                    <span className="wc-author">— {w.author || 'অজ্ঞাত'}</span>
                    <span className="wc-read-more">পড়ুন →</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Full reading modal */}
      {active && (
        <div className="writing-overlay" onClick={() => setActive(null)}>
          <div className="writing-modal" onClick={e => e.stopPropagation()}>
            <div className="wm-header">
              <span className="wc-type-badge">{TYPE_ICONS[active.type] || '✍️'} {active.type}</span>
              <button className="wm-close" onClick={() => setActive(null)}>✕</button>
            </div>
            <h2 className="wm-title">{active.title}</h2>
            <p className="wm-author">— {active.author || 'অজ্ঞাত'}</p>
            <div className="wm-body">{active.content}</div>
          </div>
        </div>
      )}
    </>
  );
}
