import { useState, useEffect } from 'react';
import api from '../../services/api';
import swal from '../../utils/swal';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import { FiPlus, FiEdit2, FiTrash2, FiX } from 'react-icons/fi';

export default function ClassManager() {
  const [classes, setClasses]     = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editClass, setEditClass] = useState(null);   // null = add, obj = edit
  const [name, setName]           = useState('');
  const [saving, setSaving]       = useState(false);

  // Section editing state
  const [sectionClass, setSectionClass] = useState(null);
  const [sections, setSections]         = useState([]);
  const [newSection, setNewSection]     = useState('');
  const [savingSections, setSavingSections] = useState(false);

  const fetchClasses = () =>
    api.get('/classes').then(res => setClasses(Array.isArray(res.data) ? res.data : [])).catch(() => {});

  useEffect(() => { fetchClasses(); }, []);

  const openAdd = () => { setEditClass(null); setName(''); setShowModal(true); };
  const openEdit = (c) => { setEditClass(c); setName(c.name); setShowModal(true); };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editClass) {
        await api.put(`/classes/${editClass.id}`, { name: name.trim() });
        swal.success('শ্রেণি আপডেট হয়েছে');
      } else {
        await api.post('/classes', { name: name.trim() });
        swal.success('শ্রেণি যোগ করা হয়েছে');
      }
      setShowModal(false);
      fetchClasses();
    } catch (e) { await swal.error(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (c) => {
    const ok = await swal.confirm('শ্রেণি মুছবেন?', `"${c.name}" শ্রেণিটি স্থায়ীভাবে মুছে যাবে।`);
    if (!ok) return;
    try {
      await api.delete(`/classes/${c.id}`);
      swal.success('শ্রেণি মুছে ফেলা হয়েছে');
      fetchClasses();
    } catch (e) { await swal.error(e.message); }
  };

  const openSections = (c) => {
    setSectionClass(c);
    setSections([...(c.sections || [])]);
    setNewSection('');
  };

  const addSection = () => {
    const s = newSection.trim();
    if (!s || sections.includes(s)) return;
    setSections(prev => [...prev, s]);
    setNewSection('');
  };

  const removeSection = (s) => setSections(prev => prev.filter(x => x !== s));

  const saveSections = async () => {
    setSavingSections(true);
    try {
      await api.put(`/classes/${sectionClass.id}/sections`, { sections });
      swal.success('সেকশন আপডেট হয়েছে');
      setSectionClass(null);
      fetchClasses();
    } catch (e) { await swal.error(e.message); }
    finally { setSavingSections(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">শ্রেণি ব্যবস্থাপনা</h1>
          <p className="page-subtitle">শ্রেণি ও সেকশন তৈরি, সম্পাদনা ও মুছুন</p>
        </div>
        <Button icon={<FiPlus />} onClick={openAdd}>নতুন শ্রেণি</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {classes.length === 0 && (
          <p style={{ color: 'var(--text-muted)', gridColumn: '1/-1', textAlign: 'center', padding: 40 }}>
            কোনো শ্রেণি নেই। উপরের বাটনে ক্লিক করে যোগ করুন।
          </p>
        )}
        {classes.map(c => (
          <div key={c.id} style={{ background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
            {/* Class name bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--primary)' }}>{c.name}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => openEdit(c)} style={iconBtn} title="সম্পাদনা"><FiEdit2 size={14} /></button>
                <button onClick={() => handleDelete(c)} style={{ ...iconBtn, color: 'var(--danger)' }} title="মুছুন"><FiTrash2 size={14} /></button>
              </div>
            </div>

            {/* Sections */}
            <div style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>সেকশন</div>
              {c.sections && c.sections.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {c.sections.map(s => (
                    <span key={s} style={{ padding: '3px 10px', background: 'rgba(99,102,241,0.1)', color: 'var(--primary)', borderRadius: 20, fontSize: '0.82rem', fontWeight: 500 }}>{s}</span>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 10, fontStyle: 'italic' }}>কোনো সেকশন নেই</p>
              )}
              <button onClick={() => openSections(c)} style={{ fontSize: '0.8rem', color: 'var(--primary)', background: 'none', border: '1px dashed var(--primary)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
                + সেকশন সম্পাদনা
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Class Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editClass ? 'শ্রেণি সম্পাদনা' : 'নতুন শ্রেণি যোগ করুন'} size="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>শ্রেণির নাম *</label>
            <input
              className="input-field"
              placeholder="যেমন: নবম শ্রেণি"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              autoFocus
            />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Button variant="outline" onClick={() => setShowModal(false)} type="button">বাতিল</Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? 'সংরক্ষণ হচ্ছে...' : editClass ? 'আপডেট করুন' : 'যোগ করুন'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Section Edit Modal */}
      <Modal isOpen={!!sectionClass} onClose={() => setSectionClass(null)} title={`${sectionClass?.name} — সেকশন`} size="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Existing sections */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, minHeight: 36 }}>
            {sections.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>কোনো সেকশন নেই</span>}
            {sections.map(s => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(99,102,241,0.1)', borderRadius: 20, fontSize: '0.85rem', color: 'var(--primary)' }}>
                <span>{s}</span>
                <button onClick={() => removeSection(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex', padding: 0 }}><FiX size={12} /></button>
              </div>
            ))}
          </div>

          {/* Add new section */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input-field"
              placeholder="নতুন সেকশন (যেমন: ক, খ, A)"
              value={newSection}
              onChange={e => setNewSection(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addSection()}
              style={{ flex: 1 }}
            />
            <Button onClick={addSection} icon={<FiPlus />} variant="outline">যোগ</Button>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Button variant="outline" onClick={() => setSectionClass(null)}>বাতিল</Button>
            <Button onClick={saveSections} disabled={savingSections}>
              {savingSections ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

const iconBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--text-muted)', padding: 4, borderRadius: 4,
  display: 'flex', alignItems: 'center',
};
