import { useState, useEffect } from 'react';
import api from '../../services/api';
import Table from '../../components/Table';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import InputField from '../../components/InputField';
import SelectBox from '../../components/SelectBox';
import Pagination from '../../components/Pagination';
import { FiPlus, FiTrash2, FiEdit2, FiCheckCircle } from 'react-icons/fi';
import swal from '../../utils/swal';
import { useForm } from 'react-hook-form';
import { formatDate } from '../../utils/dateFormat';

const categoryOptions = [
  { value: 'পরীক্ষা', label: 'পরীক্ষা' },
  { value: 'ছুটি', label: 'ছুটি' },
  { value: 'ভর্তি', label: 'ভর্তি' },
  { value: 'ফি', label: 'ফি' },
  { value: 'রুটিন', label: 'রুটিন' },
  { value: 'সাধারণ', label: 'সাধারণ' },
];

export default function NoticeList() {
  const [notices, setNotices] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editNotice, setEditNotice] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all'); // all, draft, published
  const [page, setPage] = useState(1);
  const PER_PAGE = 15;
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const fetchNotices = () =>
    api.get('/notices').then(res => setNotices(Array.isArray(res.data) ? res.data : [])).catch(() => {});

  useEffect(() => { fetchNotices(); }, []);

  const openAdd = () => {
    setEditNotice(null);
    reset({ important: 'false' });
    setShowModal(true);
  };

  const openEdit = (notice) => {
    setEditNotice(notice);
    reset({
      title: notice.title,
      content: notice.content,
      category: notice.category,
      important: notice.is_important == 1 ? 'true' : 'false',
    });
    setShowModal(true);
  };

  const onSubmit = async (data) => {
    try {
      if (editNotice) {
        await api.put(`/notices/${editNotice.id}`, { 
          ...data, 
          is_important: data.important === 'true' ? 1 : 0 
        });
        swal.success('নোটিশ আপডেট হয়েছে');
      } else {
        await api.post('/notices', { 
          ...data, 
          is_important: data.important === 'true' ? 1 : 0,
          status: 'published' // Manual notices are published immediately
        });
        swal.success('নোটিশ প্রকাশিত হয়েছে');
      }
      reset(); setShowModal(false); setEditNotice(null); fetchNotices();
    } catch (e) { await swal.error(e.message); }
  };

  const onApprove = async (id) => {
    const ok = await swal.confirm('নোটিশ প্রকাশ করবেন?', 'এই নোটিশটি হোমপেজে প্রদর্শিত হবে।');
    if (!ok) return;
    try {
      await api.post(`/notices/${id}/approve`);
      swal.success('নোটিশ প্রকাশিত হয়েছে');
      fetchNotices();
    } catch (e) { await swal.error(e.message); }
  };

  const onDelete = async (id) => {
    const ok = await swal.confirm('নোটিশ মুছবেন?', 'এই নোটিশটি স্থায়ীভাবে মুছে যাবে।');
    if (!ok) return;
    try {
      await api.delete(`/notices/${id}`);
      swal.success('নোটিশ মুছে ফেলা হয়েছে');
      setNotices(prev => prev.filter(n => n.id !== id));
    } catch (e) { await swal.error(e.message); }
  };

  // Filter notices by status
  const filteredNotices = filterStatus === 'all' 
    ? notices 
    : notices.filter(n => n.status === filterStatus);

  const draftCount = notices.filter(n => n.status === 'draft').length;

  const columns = [
    { header: 'শিরোনাম', key: 'title' },
    { header: 'বিভাগ', render: r => <Badge variant="primary">{r.category}</Badge> },
    { header: 'তারিখ', render: r => formatDate(r.created_at) },
    { header: 'অবস্থা', render: r => (
      r.status === 'draft' 
        ? <Badge variant="warning">খসড়া</Badge> 
        : <Badge variant="success">প্রকাশিত</Badge>
    )},
    { header: 'গুরুত্ব', render: r => r.is_important == 1 ? <Badge variant="danger">গুরুত্বপূর্ণ</Badge> : <Badge>সাধারণ</Badge> },
    { header: 'অ্যাকশন', render: r => (
      <div style={{ display: 'flex', gap: 6 }}>
        {r.status === 'draft' && (
          <>
            <Button size="sm" variant="success" icon={<FiCheckCircle />} onClick={() => onApprove(r.id)} title="প্রকাশ করুন" />
            <Button size="sm" variant="outline" icon={<FiEdit2 />} onClick={() => openEdit(r)} title="সম্পাদনা" />
          </>
        )}
        <Button size="sm" variant="danger" icon={<FiTrash2 />} onClick={() => onDelete(r.id)} title="মুছুন" />
      </div>
    )},
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">নোটিশ ব্যবস্থাপনা</h1>
          <p className="page-subtitle">সকল নোটিশ ও বিজ্ঞপ্তি {draftCount > 0 && `(${draftCount}টি খসড়া)`}</p>
        </div>
        <Button icon={<FiPlus />} onClick={openAdd}>নতুন নোটিশ</Button>
      </div>

      {/* Filter tabs */}
      <div className="card" style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => setFilterStatus('all')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: 6,
              background: filterStatus === 'all' ? 'var(--primary)' : 'var(--bg)',
              color: filterStatus === 'all' ? '#fff' : 'var(--text)',
              fontWeight: 500,
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            সব ({notices.length})
          </button>
          <button
            onClick={() => setFilterStatus('draft')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: 6,
              background: filterStatus === 'draft' ? 'var(--warning)' : 'var(--bg)',
              color: filterStatus === 'draft' ? '#fff' : 'var(--text)',
              fontWeight: 500,
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            খসড়া ({draftCount})
          </button>
          <button
            onClick={() => setFilterStatus('published')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: 6,
              background: filterStatus === 'published' ? 'var(--success)' : 'var(--bg)',
              color: filterStatus === 'published' ? '#fff' : 'var(--text)',
              fontWeight: 500,
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            প্রকাশিত ({notices.filter(n => n.status === 'published').length})
          </button>
        </div>
      </div>

      <div className="card">
        <Table columns={columns} data={filteredNotices.slice((page-1)*PER_PAGE, page*PER_PAGE)} />
        <Pagination page={page} total={filteredNotices.length} perPage={PER_PAGE} onChange={setPage} />
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditNotice(null); }} 
        title={editNotice ? 'নোটিশ সম্পাদনা' : 'নতুন নোটিশ যোগ করুন'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <InputField label="শিরোনাম" name="title" register={register} error={errors.title} required placeholder="নোটিশের শিরোনাম" />
          <SelectBox label="বিভাগ" name="category" options={categoryOptions} register={register} error={errors.category} required />
          <SelectBox label="গুরুত্বপূর্ণ?" name="important" options={[{value:'true',label:'হ্যাঁ'},{value:'false',label:'না'}]} register={register} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>বিষয়বস্তু *</label>
            <textarea
              {...register('content', { required: 'বিষয়বস্তু আবশ্যক' })}
              rows={4}
              placeholder="নোটিশের বিস্তারিত লিখুন..."
              style={{ padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '0.9rem', fontFamily: 'Hind Siliguri, sans-serif', resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button variant="outline" onClick={() => { setShowModal(false); setEditNotice(null); }} type="button">বাতিল</Button>
            <Button type="submit">{editNotice ? 'আপডেট করুন' : 'প্রকাশ করুন'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
