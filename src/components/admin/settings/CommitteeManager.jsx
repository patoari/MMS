import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { FiPlus, FiEye, FiEyeOff, FiTrash2, FiUpload, FiX, FiSave } from 'react-icons/fi';
import api from '../../../services/api';
import swal from '../../../utils/swal';
import Button from '../../Button';
import Modal from '../../Modal';
import InputField from '../../InputField';
import { compressImage } from '../../../utils/compressImage';

export default function CommitteeManager() {
  const [members, setMembers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const memberForm = useForm();

  const fetchMembers = () =>
    api.get('/committee-members/all').then(res => 
      setMembers(Array.isArray(res.data) ? res.data : [])
    ).catch(() => {});

  useEffect(() => { fetchMembers(); }, []);

  const openAdd = () => {
    setEditMember(null);
    setPhotoFile(null);
    setPhotoPreview('');
    memberForm.reset({ name: '', position: '', phone: '', email: '', sort_order: 0 });
    setShowForm(true);
  };

  const openEdit = (member) => {
    setEditMember(member);
    setPhotoFile(null);
    setPhotoPreview(member.photo || '');
    memberForm.reset(member);
    setShowForm(true);
  };

  const onSave = async (data) => {
    try {
      let photoPath = photoPreview;

      // Upload photo if a file was selected
      if (photoFile) {
        const formData = new FormData();
        formData.append('photo', photoFile);
        const res = await api.post('/committee-members/upload', formData);
        if (res.success && res.data?.path) photoPath = res.data.path;
      }

      const payload = { ...data, photo: photoPath };
      
      if (editMember) {
        await api.put(`/committee-members/${editMember.id}`, payload);
        swal.success('সদস্য আপডেট হয়েছে');
      } else {
        await api.post('/committee-members', payload);
        swal.success('সদস্য যোগ হয়েছে');
      }

      setShowForm(false);
      fetchMembers();
    } catch (err) {
      swal.error(err.message || 'সংরক্ষণ ব্যর্থ হয়েছে');
    }
  };

  const handleDelete = async (id) => {
    const ok = await swal.confirm('সদস্য মুছবেন?', 'এই সদস্যের তথ্য স্থায়ীভাবে মুছে যাবে।');
    if (!ok) return;
    try {
      await api.delete(`/committee-members/${id}`);
      fetchMembers();
      swal.success('সদস্য মুছে ফেলা হয়েছে');
    } catch (err) {
      swal.error(err.message || 'মুছতে ব্যর্থ হয়েছে');
    }
  };

  const handleToggle = async (id) => {
    try {
      await api.put(`/committee-members/${id}/toggle`);
      fetchMembers();
    } catch (err) {
      swal.error(err.message || 'স্ট্যাটাস পরিবর্তন ব্যর্থ হয়েছে');
    }
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setPhotoFile(compressed);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(compressed);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Button icon={<FiPlus />} onClick={openAdd}>সদস্য যোগ করুন</Button>

      {/* Members List */}
      {members.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>কোনো সদস্য নেই।</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {members.map(member => (
            <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
              {member.photo ? (
                <img src={member.photo} alt={member.name} style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 600 }}>
                  {member.name?.[0]}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{member.name}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{member.position}</div>
                {member.phone && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>📞 {member.phone}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => handleToggle(member.id)} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: member.is_active ? 'var(--success)' : 'var(--text-muted)', color: '#fff', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {member.is_active ? <><FiEye size={14} /> সক্রিয়</> : <><FiEyeOff size={14} /> নিষ্ক্রিয়</>}
                </button>
                <button type="button" onClick={() => openEdit(member)} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer' }}>
                  ✏️
                </button>
                <button type="button" onClick={() => handleDelete(member.id)} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: 'var(--danger)', color: '#fff', cursor: 'pointer' }}>
                  <FiTrash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <Modal isOpen={showForm} onClose={() => setShowForm(false)} 
          title={editMember ? 'সদস্য সম্পাদনা' : 'নতুন সদস্য যোগ'} size="sm">
          <form onSubmit={memberForm.handleSubmit(onSave)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Photo Upload */}
            <div>
              <label className="input-label">ছবি</label>
              {photoPreview ? (
                <div style={{ position: 'relative', width: 120, height: 120, borderRadius: '50%', overflow: 'hidden', margin: '0 auto' }}>
                  <img src={photoPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(''); }} style={{ position: 'absolute', top: 4, right: 4, background: 'var(--danger)', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
                    <FiX size={16} />
                  </button>
                </div>
              ) : (
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 24, border: '2px dashed var(--border)', borderRadius: 8, cursor: 'pointer', background: 'var(--bg)' }}>
                  <FiUpload size={32} color="var(--text-muted)" />
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>ছবি আপলোড করুন</span>
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
                </label>
              )}
            </div>

            <InputField label="নাম *" name="name" register={memberForm.register} required />
            <InputField label="পদবি *" name="position" register={memberForm.register} required placeholder="যেমন: সভাপতি, সাধারণ সম্পাদক" />
            <InputField label="ফোন নম্বর" name="phone" register={memberForm.register} placeholder="01XXXXXXXXX" />
            <InputField label="ইমেইল" name="email" type="email" register={memberForm.register} placeholder="example@email.com" />
            <InputField label="ক্রম নম্বর" name="sort_order" type="number" register={memberForm.register} placeholder="0" />

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>বাতিল</Button>
              <Button type="submit" icon={<FiSave />}>সংরক্ষণ করুন</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
