import { useRef, useState } from 'react';
import { useGallery } from '../../context/GalleryContext';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import InputField from '../../components/InputField';
import { useForm } from 'react-hook-form';
import { FiPlus, FiTrash2, FiUpload, FiX } from 'react-icons/fi';
import swal from '../../utils/swal';
import { compressImage } from '../../utils/compressImage';
import './GalleryManager.css';

export default function GalleryManager() {
  const { images, addImage, deleteImage } = useGallery();
  const [showModal, setShowModal]   = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [saving, setSaving]         = useState(false);
  const fileInputRef = useRef();

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm();
  const urlValue = watch('url', '');

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setUploadFile(compressed);
    const reader = new FileReader();
    reader.onload = (ev) => setPreviewUrl(ev.target.result);
    reader.readAsDataURL(compressed);
  };

  const clearFile = () => {
    setUploadFile(null);
    setPreviewUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const closeModal = () => { setShowModal(false); reset(); clearFile(); };

  const onAdd = async (data) => {
    setSaving(true);
    try {
      if (uploadFile) {
        // Upload as multipart — backend saves to disk and returns real URL
        await addImage({ file: uploadFile, caption: data.caption });
      } else {
        // URL-only
        await addImage({ url: data.url, caption: data.caption });
      }
      closeModal();
      swal.success('ছবি যোগ করা হয়েছে');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="gallery-manager">
      <div className="gallery-manager-top">
        <div>
          <h1 className="page-title">গ্যালারি ব্যবস্থাপনা</h1>
          <p className="page-subtitle">হোমপেজ ক্যারোসেলের ছবি পরিচালনা করুন ({images.length}টি ছবি)</p>
        </div>
        <Button icon={<FiPlus />} onClick={() => setShowModal(true)}>নতুন ছবি যোগ করুন</Button>
      </div>

      <div className="gallery-grid">
        {images.map((img, i) => (
          <div key={img.id} className="gallery-item">
            <div className="gallery-item-num">{i + 1}</div>
            <img src={img.url} alt={img.caption} className="gallery-item-img"
              onError={e => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150"><rect fill="%23eee" width="200" height="150"/><text x="50%" y="50%" text-anchor="middle" fill="%23aaa" dy=".3em">No Image</text></svg>'; }} />
            <div className="gallery-item-footer">
              <span className="gallery-item-caption">{img.caption}</span>
              <button className="gallery-delete-btn" onClick={async () => {
              const ok = await swal.confirm('ছবি মুছবেন?', 'এই ছবিটি গ্যালারি থেকে মুছে যাবে।');
              if (ok) { deleteImage(img.id); swal.success('ছবি মুছে ফেলা হয়েছে'); }
            }} title="মুছুন">
                <FiTrash2 />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={showModal} onClose={closeModal} title="নতুন ছবি যোগ করুন" size="md">
        <form onSubmit={handleSubmit(onAdd)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div className="gallery-upload-field">
            <label className="gallery-upload-label">ছবি আপলোড করুন</label>
            {uploadFile ? (
              <div className="gallery-file-chosen">
                <span className="gallery-file-name"><FiUpload style={{ marginRight: 6 }} />{uploadFile.name}</span>
                <button type="button" className="gallery-file-clear" onClick={clearFile}><FiX /></button>
              </div>
            ) : (
              <div className="gallery-drop-zone" onClick={() => fileInputRef.current?.click()}>
                <FiUpload className="gallery-drop-icon" />
                <span>ক্লিক করুন বা ছবি টেনে আনুন</span>
                <span className="gallery-drop-hint">JPG, PNG, WEBP — সর্বোচ্চ 5MB</span>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
          </div>

          <div className="gallery-or-divider"><span>অথবা URL দিন</span></div>

          <InputField label="ছবির URL" name="url" register={register} error={errors.url}
            required={!uploadFile} placeholder="https://example.com/image.jpg" />

          {(previewUrl || urlValue) && (
            <div className="url-preview">
              <img src={previewUrl || urlValue} alt="preview" onError={e => e.target.style.display = 'none'} />
            </div>
          )}

          <InputField label="ক্যাপশন" name="caption" register={register} error={errors.caption}
            required placeholder="ছবির বিবরণ লিখুন" />

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button variant="outline" type="button" onClick={closeModal}>বাতিল</Button>
            <Button type="submit" disabled={(!uploadFile && !urlValue) || saving}>
              {saving ? 'আপলোড হচ্ছে...' : 'যোগ করুন'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
