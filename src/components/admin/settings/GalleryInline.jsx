import { useState, useEffect, useRef } from 'react';
import { FiUpload, FiTrash2 } from 'react-icons/fi';
import api from '../../../services/api';
import swal from '../../../utils/swal';
import { compressImage } from '../../../utils/compressImage';

export default function GalleryInline() {
  const [images, setImages]       = useState([]);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption]     = useState('');
  const fileRef = useRef();

  const fetchImages = () =>
    api.get('/homepage-gallery').then(res => setImages(Array.isArray(res.data) ? res.data : [])).catch(() => {});

  useEffect(() => { fetchImages(); }, []);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', compressed);
      formData.append('caption', caption);
      const res = await api.post('/homepage-gallery', formData);
      if (!res.success) throw new Error(res.message || 'Upload failed');
      setCaption('');
      if (fileRef.current) fileRef.current.value = '';
      fetchImages();
      swal.success('ছবি যোগ হয়েছে');
    } catch (err) {
      swal.error(err.message || 'আপলোড ব্যর্থ হয়েছে');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    const ok = await swal.confirm('ছবি মুছবেন?', 'এই ছবিটি গ্যালারি থেকে মুছে যাবে।');
    if (!ok) return;
    try {
      await api.delete(`/homepage-gallery/${id}`);
      fetchImages();
      swal.success('ছবি মুছে ফেলা হয়েছে');
    } catch (err) {
      swal.error(err.message || 'ছবি মুছতে ব্যর্থ হয়েছে');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Upload row */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>ক্যাপশন (ঐচ্ছিক)</label>
          <input className="settings-input" placeholder="ছবির বিবরণ..." value={caption} onChange={e => setCaption(e.target.value)} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', background: 'var(--primary)', color: '#fff', borderRadius: 8, cursor: uploading ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontFamily: 'inherit', opacity: uploading ? 0.7 : 1 }}>
          <FiUpload size={15} />
          {uploading ? 'আপলোড হচ্ছে...' : 'ছবি আপলোড করুন'}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} disabled={uploading} onChange={handleUpload} />
        </label>
      </div>

      {/* Image grid */}
      {images.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>কোনো ছবি নেই।</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
          {images.map(img => (
            <div key={img.id} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', aspectRatio: '4/3', background: 'var(--bg)' }}>
              <img src={img.url} alt={img.caption || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              {img.caption && (
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: '0.65rem', padding: '3px 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{img.caption}</div>
              )}
              <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(img.id); }}
                style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(220,38,38,0.85)', border: 'none', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
                <FiTrash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
