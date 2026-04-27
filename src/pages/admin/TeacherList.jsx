import { useState, useEffect } from 'react';
import api from '../../services/api';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import InputField from '../../components/InputField';
import SelectBox from '../../components/SelectBox';
import { FiArchive, FiEdit2, FiUser, FiPhone, FiMail, FiBook, FiCalendar, FiDollarSign, FiLink, FiRotateCcw } from 'react-icons/fi';
import swal from '../../utils/swal';
import { useForm } from 'react-hook-form';
import Pagination from '../../components/Pagination';
import './TeacherList.css';

const statusOptions = [
  { value: 'সক্রিয়',   label: 'সক্রিয়' },
  { value: 'নিষ্ক্রিয়', label: 'নিষ্ক্রিয়' },
];

export default function TeacherList() {
  const [teachers, setTeachers]   = useState([]);
  const [users, setUsers]         = useState([]);
  const [classes, setClasses]     = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editTeacher, setEdit]    = useState(null);
  const [viewTeacher, setView]    = useState(null);
  const [linkingId, setLinkingId] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch]       = useState('');
  const [page, setPage]           = useState(1);
  const PER_PAGE = 12;
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const fetchTeachers = (archived = showArchived) =>
    api.get(`/teachers${archived ? '?archived=1' : ''}`)
      .then(res => setTeachers(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});

  useEffect(() => { fetchTeachers(showArchived); }, [showArchived]);

  useEffect(() => {
    api.get('/classes')
      .then(res => setClasses(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    api.get('/users').then(res => {
      const all = Array.isArray(res.data) ? res.data : [];
      setUsers(all.filter(u => ['teacher', 'class_teacher', 'visitor', 'admin'].includes(u.role)));
    }).catch(() => {});
  }, []);

  const openEdit = (t) => {
    setEdit(t);
    reset({ 
      name: t.name, 
      subject: t.subject || '', 
      phone: t.phone || '', 
      email: t.email || '',
      address: t.address || '', 
      qualification: t.qualification || '',
      join_date: t.join_date || '', 
      salary: t.salary || 0, 
      status: t.status || 'সক্রিয়',
      class: t.class || '',
      user_id: t.user_id || null
    });
    setShowModal(true);
  };
  const closeModal = () => { 
    setShowModal(false); 
    setEdit(null); 
    reset(); 
  };

  const onSubmit = async (data) => {
    try {
      if (editTeacher && !editTeacher.is_user_only) {
        // Updating existing teacher record - use JSON
        await api.put(`/teachers/${editTeacher.id}`, data);
        swal.success('শিক্ষকের তথ্য আপডেট হয়েছে');
      } else {
        // Creating new teacher record (including for incomplete profiles)
        await api.post('/teachers', data);
        swal.success(editTeacher?.is_user_only ? 'শিক্ষক প্রোফাইল সম্পূর্ণ হয়েছে' : 'শিক্ষক যোগ করা হয়েছে');
      }
      closeModal(); fetchTeachers();
    } catch (e) { await swal.error(e.message); }
  };

  const onArchive = async (id) => {
    const ok = await swal.confirm('শিক্ষক আর্কাইভ করবেন?', 'শিক্ষকের সকল তথ্য সংরক্ষিত থাকবে এবং পরে পুনরুদ্ধার করা যাবে।', 'আর্কাইভ করুন');
    if (!ok) return;
    try {
      await api.delete(`/teachers/${id}`);
      swal.success('শিক্ষক আর্কাইভ করা হয়েছে');
      setTeachers(prev => prev.filter(t => t.id !== id));
      if (viewTeacher?.id === id) setView(null);
    } catch (e) { await swal.error(e.message); }
  };

  const onRestore = async (id) => {
    try {
      await api.put(`/teachers/${id}/restore`);
      swal.success('শিক্ষক পুনরুদ্ধার করা হয়েছে');
      fetchTeachers(showArchived);
    } catch (e) { await swal.error(e.message); }
  };

  const handleLinkUser = async (teacherId, userId) => {
    setLinkingId(teacherId);
    try {
      await api.put(`/teachers/${teacherId}/link-user`, { user_id: userId || null });
      swal.success('অ্যাকাউন্ট লিংক আপডেট হয়েছে।');
      fetchTeachers();
      if (viewTeacher?.id === teacherId) setView(prev => ({ ...prev, user_id: userId || null }));
    } catch (e) { await swal.error(e.message); }
    finally { setLinkingId(null); }
  };

  const active      = teachers.filter(t => t.status === 'সক্রিয়').length;
  const inactive    = teachers.filter(t => t.status !== 'সক্রিয়').length;
  const totalSalary = teachers.reduce((s, t) => s + Number(t.salary || 0), 0);

  const filtered  = teachers.filter(t =>
    !search || t.name?.toLowerCase().includes(search.toLowerCase()) ||
    t.subject?.toLowerCase().includes(search.toLowerCase()) ||
    t.id?.toLowerCase().includes(search.toLowerCase()) ||
    t.phone?.includes(search)
  );
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="teacher-page">
      {/* Header */}
      <div className="teacher-header">
        <div>
          <h1 className="page-title">শিক্ষক ব্যবস্থাপনা</h1>
          <p className="page-subtitle">মোট {teachers.length} জন · সক্রিয় {active} · নিষ্ক্রিয় {inactive}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button
            variant={showArchived ? 'primary' : 'outline'}
            icon={<FiArchive />}
            onClick={() => { setShowArchived(v => !v); setSearch(''); setPage(1); }}
          >
            {showArchived ? 'সক্রিয় দেখুন' : 'আর্কাইভ'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      {!showArchived && (
        <div className="teacher-stats">
          <div className="tstat-card tstat-primary"><FiUser size={22} /><div><span className="tstat-val">{teachers.length}</span><span className="tstat-label">মোট শিক্ষক</span></div></div>
          <div className="tstat-card tstat-success"><FiUser size={22} /><div><span className="tstat-val">{active}</span><span className="tstat-label">সক্রিয়</span></div></div>
          <div className="tstat-card tstat-warning"><FiUser size={22} /><div><span className="tstat-val">{inactive}</span><span className="tstat-label">নিষ্ক্রিয়</span></div></div>
          <div className="tstat-card tstat-info"><FiDollarSign size={22} /><div><span className="tstat-val">৳{totalSalary.toLocaleString()}</span><span className="tstat-label">মোট মাসিক বেতন</span></div></div>
        </div>
      )}

      {showArchived && (
        <div style={{ padding: '10px 16px', background: '#fef3c7', borderRadius: 10, border: '1px solid #fbbf24', fontSize: '0.875rem', color: '#92400e' }}>
          আর্কাইভ করা শিক্ষকদের তালিকা — এখানে সকল তথ্য সংরক্ষিত আছে। পুনরুদ্ধার করলে তারা আগের আইডি ও তথ্য নিয়ে সক্রিয় হবেন।
        </div>
      )}

      {/* Search */}
      <div className="teacher-search-bar">
        <input className="teacher-search-input"
          placeholder={showArchived ? 'আইডি বা নাম দিয়ে খুঁজুন...' : 'নাম, বিষয় বা মোবাইল দিয়ে খুঁজুন...'}
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Cards grid */}
      <div className="teacher-grid">
        {paginated.length === 0 && teachers.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <FiUser size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
            <p style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 8 }}>
              {showArchived ? 'কোনো আর্কাইভ করা শিক্ষক নেই' : 'কোনো শিক্ষক পাওয়া যায়নি'}
            </p>
            {!showArchived && <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>ব্যবহারকারী ব্যবস্থাপনা থেকে কোনো ব্যবহারকারীকে শিক্ষক হিসেবে নির্ধারণ করুন।</p>}
          </div>
        ) : paginated.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', gridColumn: '1/-1', textAlign: 'center', padding: 40 }}>কোনো শিক্ষক পাওয়া যায়নি।</p>
        ) : paginated.map(t => (
          <div key={t.id} className={`teacher-card${t.status !== 'সক্রিয়' ? ' inactive' : ''}`}
            style={showArchived ? { opacity: 0.85, borderStyle: 'dashed' } : t.is_user_only ? { borderColor: '#fbbf24', borderWidth: 2 } : {}}>
            <div className="tc-top">
              {t.photo ? (
                <img src={t.photo} 
                  alt={t.name} 
                  className="tc-avatar" 
                  style={{ objectFit: 'cover', background: 'transparent' }} />
              ) : (
                <div className="tc-avatar" style={showArchived ? { background: '#9ca3af' } : t.role === 'admin' ? { background: '#6366f1' } : {}}>{t.name?.[0] || 'T'}</div>
              )}
              <div className="tc-info">
                <div className="tc-name">{t.name}</div>
                <div className="tc-id">{t.id}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Badge variant={showArchived ? 'secondary' : t.status === 'সক্রিয়' ? 'success' : 'secondary'}>
                    {showArchived ? 'আর্কাইভড' : t.status}
                  </Badge>
                  {t.role === 'admin' && (
                    <Badge variant="primary">প্রধান শিক্ষক</Badge>
                  )}
                  {t.is_user_only && t.role !== 'admin' && (
                    <Badge variant="warning">প্রোফাইল অসম্পূর্ণ</Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="tc-details">
              <div className="tc-row"><FiBook size={13} /><span>{t.subject || '—'}</span></div>
              {t.class && <div className="tc-row"><FiCalendar size={13} /><span>{t.class}</span></div>}
              <div className="tc-row"><FiPhone size={13} /><span>{t.phone || '—'}</span></div>
              {t.email && <div className="tc-row"><FiMail size={13} /><span>{t.email}</span></div>}
              <div className="tc-row tc-salary"><FiDollarSign size={13} /><span>৳{Number(t.salary).toLocaleString()} / মাস</span></div>
            </div>
            <div className="tc-actions">
              {showArchived ? (
                <Button size="sm" variant="success" icon={<FiRotateCcw />} onClick={() => onRestore(t.id)}>পুনরুদ্ধার</Button>
              ) : t.is_user_only ? (
                <>
                  <Button size="sm" variant="primary" onClick={() => openEdit(t)}>প্রোফাইল সম্পূর্ণ করুন</Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="outline" icon={<FiUser />} onClick={() => setView(t)}>বিস্তারিত</Button>
                  <Button size="sm" variant="outline" icon={<FiEdit2 />} onClick={() => openEdit(t)}>সম্পাদনা</Button>
                  {t.role !== 'admin' && <Button size="sm" variant="danger" icon={<FiArchive />} onClick={() => onArchive(t.id)} />}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      <Pagination page={page} total={filtered.length} perPage={PER_PAGE} onChange={setPage} />

      {/* View Modal */}
      <Modal isOpen={!!viewTeacher} onClose={() => setView(null)} title="শিক্ষকের বিস্তারিত তথ্য" size="md">
        {viewTeacher && (
          <div className="teacher-view">
            <div className="tv-header">
              {viewTeacher.photo ? (
                <img src={viewTeacher.photo} 
                  alt={viewTeacher.name} 
                  className="tv-avatar" 
                  style={{ objectFit: 'cover' }} />
              ) : (
                <div className="tv-avatar">{viewTeacher.name?.[0]}</div>
              )}
              <div>
                <div className="tv-name">{viewTeacher.name}</div>
                <div className="tv-id">{viewTeacher.id}</div>
                <Badge variant={viewTeacher.status === 'সক্রিয়' ? 'success' : 'secondary'}>{viewTeacher.status}</Badge>
              </div>
            </div>
            <div className="tv-grid">
              <div className="tv-field"><label>বিষয়</label><span>{viewTeacher.subject}</span></div>
              <div className="tv-field"><label>শ্রেণি</label><span>{viewTeacher.class || '—'}</span></div>
              <div className="tv-field"><label>মোবাইল</label><span>{viewTeacher.phone}</span></div>
              <div className="tv-field"><label>ইমেইল</label><span>{viewTeacher.email || '—'}</span></div>
              <div className="tv-field"><label>যোগদানের তারিখ</label><span>{viewTeacher.join_date || '—'}</span></div>
              <div className="tv-field"><label>যোগ্যতা</label><span>{viewTeacher.qualification || '—'}</span></div>
              <div className="tv-field"><label>ঠিকানা</label><span>{viewTeacher.address || '—'}</span></div>
              <div className="tv-field tv-salary-field"><label>মাসিক বেতন</label><span>৳{Number(viewTeacher.salary).toLocaleString()}</span></div>
            </div>
            <div style={{ marginTop: 16, padding: 14, background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <FiLink size={14} style={{ color: 'var(--primary)' }} />
                <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--primary)' }}>লগইন অ্যাকাউন্ট লিংক</span>
              </div>
              {viewTeacher.user_email
                ? <p style={{ fontSize: '0.82rem', color: 'var(--success)', marginBottom: 8 }}>✓ লিংকড: <strong>{viewTeacher.user_email}</strong></p>
                : <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 8 }}>এই শিক্ষক কোনো লগইন অ্যাকাউন্টের সাথে যুক্ত নেই।</p>
              }
              <select defaultValue={viewTeacher.user_id || ''} disabled={linkingId === viewTeacher.id}
                onChange={e => handleLinkUser(viewTeacher.id, e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--border)', fontFamily: 'inherit', fontSize: '0.875rem', background: 'var(--card-bg)' }}>
                <option value="">— অ্যাকাউন্ট নির্বাচন করুন —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <Button variant="outline" icon={<FiEdit2 />} onClick={() => { setView(null); openEdit(viewTeacher); }}>সম্পাদনা</Button>
              <Button variant="danger" icon={<FiArchive />} onClick={() => { setView(null); onArchive(viewTeacher.id); }}>আর্কাইভ</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add / Edit Modal */}
      <Modal isOpen={showModal} onClose={closeModal} title={editTeacher ? 'শিক্ষকের তথ্য সম্পাদনা' : 'নতুন শিক্ষক যোগ করুন'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <InputField label="পূর্ণ নাম" name="name" register={register} error={errors.name} required placeholder="শিক্ষকের নাম" />
          <InputField label="বিষয়" name="subject" register={register} error={errors.subject} required placeholder="পাঠ্য বিষয়" />
          <InputField label="মোবাইল" name="phone" register={register} error={errors.phone} required placeholder="01XXXXXXXXX" />
          <InputField label="ইমেইল" name="email" register={register} placeholder="email@example.com" />
          <InputField label="যোগ্যতা" name="qualification" register={register} placeholder="যেমন: কামিল, মাস্টার্স" />
          <InputField label="যোগদানের তারিখ" name="join_date" type="date" register={register} />
          <InputField label="মাসিক বেতন (৳)" name="salary" type="number" register={register} error={errors.salary} required placeholder="মাসিক বেতন" />
          <SelectBox label="শ্রেণি" name="class" options={[{ value: '', label: '— নির্বাচন করুন —' }, ...classes.map(c => ({ value: c.name, label: c.name }))]} register={register} />
          <div style={{ gridColumn: '1/-1' }}>
            <InputField label="ঠিকানা" name="address" register={register} placeholder="বাড়ি / গ্রাম / শহর" />
          </div>
          {editTeacher && <SelectBox label="অবস্থা" name="status" options={statusOptions} register={register} />}
          <div style={{ gridColumn: '1/-1', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button variant="outline" onClick={closeModal} type="button">বাতিল</Button>
            <Button type="submit">{editTeacher ? 'আপডেট করুন' : 'সংরক্ষণ করুন'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
