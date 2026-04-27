import { Link } from 'react-router-dom';
import { useSiteSettings } from '../context/SiteSettingsContext';
import SiteLogo from '../components/SiteLogo';
import './StaticPage.css';

const PAGE_CONFIG = {
  privacy:  { key: 'privacyPolicy',    title: 'গোপনীয়তা নীতি' },
  terms:    { key: 'termsConditions',  title: 'শর্তাবলী' },
  sitemap:  { key: 'sitemapContent',   title: 'সাইটম্যাপ' },
};

export default function StaticPage({ page }) {
  const { settings } = useSiteSettings();
  const config = PAGE_CONFIG[page];
  const content = settings[config.key] || '';

  return (
    <div className="static-page">
      <div className="static-header">
        <SiteLogo size={40} />
        <div>
          <div className="static-site-name">{settings.siteName}</div>
          <h1 className="static-title">{config.title}</h1>
        </div>
      </div>

      <div className="static-body">
        {content
          ? content.split('\n').map((line, i) =>
              line.trim() === ''
                ? <br key={i} />
                : <p key={i}>{line}</p>
            )
          : <p className="static-empty">এই পাতার বিষয়বস্তু এখনো যোগ করা হয়নি।</p>
        }
      </div>

      <div className="static-back">
        <Link to="/">← হোমপেজে ফিরুন</Link>
      </div>
    </div>
  );
}
