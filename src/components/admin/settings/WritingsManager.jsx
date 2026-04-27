import { useState, useEffect } from 'react';
import { FiPlus, FiEye, FiEyeOff, FiTrash2 } from 'react-icons/fi';
import api from '../../../services/api';
import swal from '../../../utils/swal';
import Button from '../../Button';

const WRITING_TYPES = ['প্রবন্ধ', 'কবিতা', 'ছোটগল্প', 'ইসলামিক গান', 'অন্যান্য'];

export default function WritingsManager() {
  const [writings, setWritings] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm]         = useState({ title: '', author: '', type: 'প্রবন্ধ', content: '' });
  const [saving, setSaving]     = useState(false);

  const fetchWritings = () =>
    api.get('/student-writings/all').then(res => setWritings(Array.isArray(res.data) ? res.data : [])).catch(() => {});

  useEffect(() => { fetchWritings(); }, []);

  const openAdd  = () => { setEditItem(null); setForm({ title: '', author: '', type: 'প্রবন্ধ', content: '' }); setShowForm(true); };
  const openEdit = (w) => { setEditItem(w); setForm({ title: w.title, author: w.author, type: w.type, content: w.content }); setShowForm(true); };

  const handleSave = async () => {
    if (!form.title || !form.content) return;
    setSaving(true);
    try {
      if (editItem) await api.put(`/student-writings/${editItem.id}`, form);
      else await api.post('/student-writings', form);
      fetchWritings();
      setShowForm(false);
      swal.success(editItem ? 'আপডেট হয়েছে' : 'লেখা যোগ হয়েছে');
    } catch (e) { swal.error(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    const ok = await swal.confirm('লেখা মুছবেন?', 'এই লেখাটি স্থায়ীভাবে মুছে যাবে।');
    if (!ok) return;
    await api.delete(`/student-writings/${id}`);
    fetchWritings();
    swal.success('মুছে ফেলা হয়েছে');
  };

  const toggleActive = async (w) => {
    await api.put(`/student-writings/${w.id}`, { is_active: w.is_active ? 0 : 1 });
    fetchWritings();
  };

  return (
    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button size="sm" icon={<FiPlus />} onClick={openAdd} type="button">নতুন লেখা যোগ করুন</Button>
      </div>

      {showForm && (
        <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 16, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>শিরোনাম *</label>
              <input className="settings-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="লেখার শিরোনাম" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>লেখকের নাম</label>
              <input className="settings-input" value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} placeholder="শিক্ষার্থীর নাম" />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>ধরন</label>
            <select className="settings-input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {WRITING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>লেখা *</label>
            <textarea rows={6} className="settings-textarea" value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="এখানে লেখা লিখুন..." />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Button variant="outline" type="button" onClick={() => setShowForm(false)}>বাতিল</Button>
            <Button type="button" onClick={handleSave} disabled={saving}>{saving ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}</Button>
          </div>
        </div>
      )}

      <div className="features-manager-list">
        {writings.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>কোনো লেখা নেই।</p>}
        {writings.map(w => (
          <div key={w.id} className={`feature-manager-item${!w.is_active ? ' inactive' : ''}`}>
            <div className="fmi-icon" style={{ fontSize: '1.4rem' }}>
              {{ 'প্রবন্ধ': '📝', 'কবিতা': '🌸', 'ছোটগল্প': '📖', 'ইসলামিক গান': '🎵', 'অন্যান্য': '✍️' }[w.type] || '✍️'}
            </div>
            <div className="fmi-info">
              <div className="fmi-title">{w.title}</div>
              <div className="fmi-desc">{w.type} · {w.author || 'অজ্ঞাত'}</div>
            </div>
            <div className="fmi-actions">
              <button className="fmi-btn" type="button" onClick={() => toggleActive(w)} title={w.is_active ? 'লুকান' : 'দেখান'}>
                {w.is_active ? <FiEye /> : <FiEyeOff />}
              </button>
              <button className="fmi-btn edit" type="button" onClick={() => openEdit(w)}>✏️</button>
              <button className="fmi-btn delete" type="button" onClick={() => handleDelete(w.id)}><FiTrash2 /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
