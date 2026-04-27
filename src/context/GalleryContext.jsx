import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const GalleryContext = createContext(null);

export function GalleryProvider({ children }) {
  const [images, setImages] = useState([]);

  useEffect(() => {
    api.pub('/gallery')
      .then(res => { if (Array.isArray(res.data)) setImages(res.data); })
      .catch(() => {});
  }, []);

  const addImage = async ({ file, url, caption }) => {
    let savedUrl = url || '';
    let savedId  = Date.now();

    if (file) {
      // Upload as multipart/form-data so backend saves to disk
      const formData = new FormData();
      formData.append('image',   file);
      formData.append('caption', caption || '');

      const res = await api.post('/gallery', formData);
      if (!res.success) throw new Error(res.message || 'Upload failed');
      savedUrl = res.data.url;
      savedId  = res.data.id;
    } else {
      // URL-only — send as JSON
      const res = await api.post('/gallery', { url: savedUrl, caption });
      savedUrl = res.data?.url || savedUrl;
      savedId  = res.data?.id  || savedId;
    }

    const newImg = { id: savedId, url: savedUrl, caption };
    setImages(prev => [...prev, newImg]);
    return newImg;
  };

  const deleteImage = async (id) => {
    setImages(prev => prev.filter(img => img.id !== id));
    try { await api.delete(`/gallery/${id}`); } catch {}
  };

  return (
    <GalleryContext.Provider value={{ images, addImage, deleteImage }}>
      {children}
    </GalleryContext.Provider>
  );
}

export const useGallery = () => useContext(GalleryContext);
