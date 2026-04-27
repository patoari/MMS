import { useEffect } from 'react';

export function useFavicon(logoUrl) {
  useEffect(() => {
    if (!logoUrl) return;

    // Find or create favicon link element
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }

    // Update favicon to use the logo
    link.href = logoUrl;

    // Also update apple-touch-icon if it exists
    let appleIcon = document.querySelector("link[rel='apple-touch-icon']");
    if (!appleIcon) {
      appleIcon = document.createElement('link');
      appleIcon.rel = 'apple-touch-icon';
      document.head.appendChild(appleIcon);
    }
    appleIcon.href = logoUrl;
  }, [logoUrl]);
}
