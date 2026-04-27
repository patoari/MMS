import { useState } from 'react';
import { useSiteSettings } from '../context/SiteSettingsContext';

export default function SiteLogo({ size = 40, style = {} }) {
  const { settings } = useSiteSettings();
  const [imgError, setImgError] = useState(false);
  
  // Validate size prop
  const validSize = typeof size === 'number' && size > 0 ? size : 40;

  const imgStyle = { 
    width: validSize, 
    height: validSize, 
    objectFit: 'contain', 
    borderRadius: 6, 
    display: 'block', 
    ...style 
  };

  // Reset error when URL changes - use key prop instead of useEffect
  const logoKey = settings.logoUrl || 'default';

  if (settings.logoUrl && settings.logoUrl.trim() && !imgError) {
    return (
      <img
        key={logoKey}
        src={settings.logoUrl}
        alt="logo"
        style={imgStyle}
        onError={() => setImgError(true)}
      />
    );
  }

  return <span style={{ fontSize: validSize * 0.8, lineHeight: 1 }}>{settings.logoEmoji || ''}</span>;
}
