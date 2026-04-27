import { Outlet, Link, useLocation } from 'react-router-dom';
import { FiMenu, FiX, FiPhone, FiMail, FiMapPin, FiFacebook, FiYoutube, FiTwitter } from 'react-icons/fi';
import { useState } from 'react';
import { useSiteSettings } from '../context/SiteSettingsContext';
import SiteLogo from '../components/SiteLogo';
import './MainLayout.css';

export default function MainLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const { settings } = useSiteSettings();

  const navLinks = [
    { to: '/', label: 'হোম' },
    { to: '/notice', label: 'নোটিশ' },
    { to: '/class-routine', label: 'ক্লাস রুটিন' },
    { to: '/exam-routine', label: 'পরীক্ষার রুটিন' },
    { to: '/result-check', label: 'ফলাফল' },
    { to: '/login', label: 'লগইন' },
  ];

  return (
    <div className="main-layout">
      <header className="main-header">
        <div className="header-container">
          <Link to="/" className="header-brand">
            <div className="brand-icon">
              <SiteLogo size={40} />
            </div>
            <div>
              <div className="brand-name">{settings.siteName}</div>
              <div className="brand-sub">{settings.siteSubtitle}</div>
            </div>
          </Link>
          <nav className={`main-nav${menuOpen ? ' open' : ''}`}>
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`nav-link${location.pathname === link.to ? ' active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <FiX /> : <FiMenu />}
          </button>
        </div>
      </header>
      <main className="main-content">
        <Outlet />
      </main>
      <footer className="main-footer">
        <div className="footer-top">
          <div className="footer-grid">
            {/* Brand Column */}
            <div className="footer-col footer-col-brand">
              <div className="footer-brand">
                <span className="footer-brand-icon">
                  <SiteLogo size={40} />
                </span>
                <div>
                  <div className="footer-brand-name">{settings.siteName}</div>
                  <div className="footer-brand-arabic">{settings.siteNameAr}</div>
                </div>
              </div>
              <p className="footer-about">{settings.aboutText}</p>
              <div className="footer-social">
                <a href={settings.facebook} aria-label="Facebook" className="social-link"><FiFacebook /></a>
                <a href={settings.youtube}  aria-label="YouTube"  className="social-link"><FiYoutube /></a>
                <a href={settings.twitter}  aria-label="Twitter"  className="social-link"><FiTwitter /></a>
              </div>
            </div>

            {/* Quick Links */}
            <div className="footer-col">
              <h4 className="footer-col-title">দ্রুত লিংক</h4>
              <ul className="footer-link-list">
                <li><Link to="/">হোম</Link></li>
                <li><Link to="/notice">নোটিশ বোর্ড</Link></li>
                <li><Link to="/class-routine">ক্লাস রুটিন</Link></li>
                <li><Link to="/exam-routine">পরীক্ষার রুটিন</Link></li>
                <li><Link to="/result-check">ফলাফল দেখুন</Link></li>
              </ul>
            </div>

            {/* Academic */}
            <div className="footer-col">
              <h4 className="footer-col-title">শিক্ষা কার্যক্রম</h4>
              <ul className="footer-link-list">
                <li><span>মক্তব বিভাগ</span></li>
                <li><span>হিফজুল কুরআন</span></li>
                <li><span>ক্লাস 1 থেকে ক্লাস 8</span></li>
                <li><Link to="/login">পোর্টালে লগইন</Link></li>
              </ul>
            </div>

            {/* Contact */}
            <div className="footer-col">
              <h4 className="footer-col-title">যোগাযোগ</h4>
              <ul className="footer-contact-list">
                <li><FiMapPin className="contact-icon" /><span>{settings.address}</span></li>
                <li><FiPhone className="contact-icon" /><span>{settings.phone}</span></li>
                <li><FiMail className="contact-icon" /><span>{settings.email}</span></li>
              </ul>
              <div className="footer-timing">
                <span className="timing-label">অফিস সময়</span>
                <span>{settings.officeHours}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="footer-bottom">
          <div className="footer-bottom-inner">
            <p className="footer-copy">{settings.footerCopy}</p>
            <div className="footer-bottom-links">
              <Link to="/privacy">গোপনীয়তা নীতি</Link>
              <span className="footer-divider">|</span>
              <Link to="/terms">শর্তাবলী</Link>
              <span className="footer-divider">|</span>
              <Link to="/sitemap">সাইটম্যাপ</Link>
              <span className="footer-divider">|</span>
              <a href="https://proqoder.com/projects/MD-AL-AMIN-PATOARI/MD-AL-AMIN-PATOARI/" target="_blank" rel="noopener noreferrer">ডেভেলপার</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
