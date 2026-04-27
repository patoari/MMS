import { useState, useEffect } from 'react';
import api from '../../services/api';
import Table from '../../components/Table';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import InputField from '../../components/InputField';
import SelectBox from '../../components/SelectBox';
import Pagination from '../../components/Pagination';
import { FiPlus, FiEdit2, FiTrash2, FiStar } from 'react-icons/fi';
import swal from '../../utils/swal';
import { useForm } from 'react-hook-form';
import { CLASS_OPTIONS } from '../../utils/constants';
import { formatDate } from '../../utils/dateFormat';

const ALL = 'সকল শ্রেণি';
const classOptions = [{ value: ALL, label: ALL }, ...CLASS_OPTIONS];
const statusOptions = [
  { value: 'আসন্ন', label: 'আসন্ন' },
  { value: 'চলমান', label: 'চলমান' },
  { value: 'সম্পন্ন', label: 'সম্পন্ন' },
];

export default function ExamList() {
  const [exams, setExams]         = useState([]);
  const [sessions, setSessions]   = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editExam, setEditExam]   = useState(null);
  const [classFees, setClassFees] = useState({});
  const [noFee, setNoFee]         = useState(false);
  const [page, setPage]           = useState(1);
  const PER_PAGE = 15;
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm();

  const selectedClass = watch('class_id');
  const isAnnual      = watch('is_annual');

  const fetchExams = () =>
    api.get('/exams').then(res => {
      const examsData = Array.isArray(res.data) ? res.data : [];
      // Auto-update status based on dates
      const today = new Date().toISOString().split('T')[0];
      const updatedExams = examsData.map(exam => {
        const autoStatus = getAutoStatus(exam.start_date, exam.end_date, today);
        return { ...exam, auto_status: autoStatus };
      });
      setExams(updatedExams);
    }).catch(() => {});

  // Calculate automatic status based on dates
  const getAutoStatus = (startDate, endDate, today) => {
    if (!startDate || !endDate) return 'আসন্ন';
    
    if (today < startDate) {
      return 'আসন্ন'; // Upcoming
    } else if (today >= startDate && today <= endDate) {
      return 'চলমান'; // Ongoing
    } else {
      return 'সম্পন্ন'; // Completed
    }
  };

  useEffect(() => { 
    fetchExams(); 
    api.get('/sessions')
      .then(res => setSessions(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, []);
  useEffect(() => { setClassFees({}); }, [selectedClass]);

  const openAdd = () => {
    setEditExam(null);
    // Set default session to current session
    const currentSession = sessions.find(s => s.is_current == 1);
    reset({ 
      is_annual: false, 
      pass_mark_percent: 33,
      session_id: currentSession?.id || ''
    });
    setClassFees({});
    setShowModal(true);
  };

  const openEdit = (exam) => {
    setEditExam(exam);
    reset({
      name:              exam.name,
      class_id:          exam.class_name,
      start_date:        exam.start_date,
      end_date:          exam.end_date,
      status:            exam.status,
      is_annual:         !!exam.is_annual,
      pass_mark_percent: exam.pass_mark_percent || 33,
      session_id:        exam.session_id || '',
    });
    setClassFees({});
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditExam(null); reset(); setClassFees({}); setNoFee(false); };

  const onSubmit = async (data) => {
    try {
      if (editExam) {
        await api.put(`/exams/${editExam.id}`, {
          name:              data.name,
          start_date:        data.start_date,
          end_date:          data.end_date,
          status:            data.status,
          is_annual:         data.is_annual ? 1 : 0,
          pass_mark_percent: data.is_annual ? Number(data.pass_mark_percent) : 33,
          session_id:        data.session_id || null,
        });
      } else {
        await api.post('/exams', {
          name:              data.name,
          class:             data.class_id,
          start_date:        data.start_date,
          end_date:          data.end_date,
          status:            'আসন্ন',
          is_annual:         data.is_annual ? 1 : 0,
          pass_mark_percent: data.is_annual ? Number(data.pass_mark_percent) : 33,
          session_id:        data.session_id || null,
          class_fees:        noFee ? {} : classFees,
          skip_fees:         noFee,
        });
      }
      closeModal();
      fetchExams();
      swal.success(editExam ? 'পরীক্ষা আপডেট হয়েছে' : 'নতুন পরীক্ষা সংরক্ষিত হয়েছে');
    } catch (e) {
      console.error('Exam save error:', e);
      swal.error(e?.message || 'সংরক্ষণ করতে সমস্যা হয়েছে');
    }
  };

  const handleDelete = async (id) => {
    const ok = await swal.confirm('পরীক্ষা মুছবেন?', 'এই পরীক্ষাটি স্থায়ীভাবে মুছে যাবে।');
    if (!ok) return;
    try { await api.delete(`/exams/${id}`); swal.success('পরীক্ষা মুছে ফেলা হয়েছে'); fetchExams(); } catch (e) { await swal.error(e.message); }
  };

  const statusVariant = { 'সম্পন্ন': 'success', 'চলমান': 'info', 'আসন্ন': 'warning' };

  const feeClasses = selectedClass === ALL
    ? CLASS_OPTIONS.map(o => o.value)
    : selectedClass ? [selectedClass] : [];

  const sessionOptions = (sessions || []).map(s => ({ 
    value: s.id, 
    label: `${s.name} (${s.year})${s.is_current == 1 ? ' - বর্তমান' : ''}` 
  }));

  const columns = [
    { header: 'আইডি', key: 'id' },
    { header: 'পরীক্ষার নাম', render: r => (
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {r.name}
        {r.is_annual == 1 && <FiStar size={13} style={{ color: '#f59e0b' }} title="বার্ষিক পরীক্ষা" />}
      </span>
    )},
    { header: 'শ্রেণি', key: 'class_name' },
    { header: 'শুরু', render: r => formatDate(r.start_date) },
    { header: 'শেষ', render: r => formatDate(r.end_date) },
    { header: 'অবস্থা', render: r => {
      const displayStatus = r.status || r.auto_status;
      const isAutoStatus = !r.status || r.status === r.auto_status;
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Badge variant={statusVariant[displayStatus]}>{displayStatus}</Badge>
          {!isAutoStatus && (
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }} title="ম্যানুয়াল">✏️</span>
          )}
        </div>
      );
    }},
    { header: 'বার্ষিক', render: r => r.is_annual == 1
        ? <Badge variant="warning">হ্যাঁ ({r.pass_mark_percent}%)</Badge>
        : <Badge variant="secondary">না</Badge>
    },
    { header: 'অ্যাকশন', render: r => (
      <div style={{ display: 'flex', gap: 8 }}>
        <Button size="sm" variant="outline" icon={<FiEdit2 />} onClick={() => openEdit(r)}>সম্পাদনা</Button>
        <Button size="sm" variant="danger"  icon={<FiTrash2 />} onClick={() => handleDelete(r.id)}>মুছুন</Button>
      </div>
    )},
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">পরীক্ষা তালিকা</h1>
          <p className="page-subtitle">সকল পরীক্ষার তথ্য · <FiStar size={12} style={{ color: '#f59e0b' }} /> চিহ্নিত = বার্ষিক পরীক্ষা</p>
        </div>
        <Button icon={<FiPlus />} onClick={openAdd}>নতুন পরীক্ষা</Button>
      </div>

      <div className="card">
        <Table columns={columns} data={exams.slice((page-1)*PER_PAGE, page*PER_PAGE)} />
        <Pagination page={page} total={exams.length} perPage={PER_PAGE} onChange={setPage} />
      </div>

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editExam ? 'পরীক্ষা সম্পাদনা' : 'নতুন পরীক্ষা যোগ করুন'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <InputField label="পরীক্ষার নাম" name="name" register={register} error={errors.name} required placeholder="পরীক্ষার নাম লিখুন" />

          {!editExam && (
            <SelectBox label="শ্রেণি" name="class_id" options={classOptions} register={register} error={errors.class_id} required />
          )}

          {sessionOptions.length > 0 ? (
            <SelectBox label="সেশন" name="session_id" options={sessionOptions} register={register} error={errors.session_id} required />
          ) : (
            <div className="select-group">
              <label className="select-label">সেশন<span className="required">*</span></label>
              <select className="select-field" disabled>
                <option>লোড হচ্ছে...</option>
              </select>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <InputField label="শুরুর তারিখ" name="start_date" type="date" register={register} error={errors.start_date} required />
            <InputField label="শেষের তারিখ" name="end_date"   type="date" register={register} error={errors.end_date}   required />
          </div>

          {editExam && (
            <>
              <div style={{ background: '#f0f9ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 12, fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, color: '#1e40af' }}>স্বয়ংক্রিয় অবস্থা:</span>
                  <Badge variant={statusVariant[editExam.auto_status]}>{editExam.auto_status}</Badge>
                </div>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.8rem' }}>
                  তারিখের উপর ভিত্তি করে স্বয়ংক্রিয়ভাবে নির্ধারিত। আপনি ম্যানুয়ালি পরিবর্তন করতে পারেন।
                </p>
              </div>
              
              <SelectBox label="অবস্থা (ম্যানুয়াল)" name="status" options={statusOptions} register={register} />
            </>
          )}

          {/* Annual exam toggle */}
          <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" {...register('is_annual')} style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>
                <FiStar style={{ color: '#f59e0b', marginRight: 4 }} />
                বার্ষিক পরীক্ষা হিসেবে চিহ্নিত করুন
              </span>
            </label>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
              বার্ষিক পরীক্ষা সম্পন্ন হলে শিক্ষার্থী প্রমোশন পেজ থেকে পরবর্তী শ্রেণিতে উন্নীত করা যাবে।
            </p>
            {isAnnual && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text)', whiteSpace: 'nowrap' }}>পাস মার্ক (%)</label>
                <input
                  type="number" min="1" max="100"
                  className="input-field"
                  style={{ width: 100, padding: '8px 10px' }}
                  {...register('pass_mark_percent', { min: 1, max: 100 })}
                />
              </div>
            )}
          </div>

          {/* Per-class fee inputs (add only) */}
          {!editExam && feeClasses.length > 0 && (
            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: noFee ? 0 : 12 }}>
                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--primary)', margin: 0 }}>
                  শ্রেণিভিত্তিক পরীক্ষা ফি (টাকা)
                </p>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  <input type="checkbox" checked={noFee} onChange={e => { setNoFee(e.target.checked); setClassFees({}); }} style={{ accentColor: 'var(--primary)' }} />
                  ফি ছাড়া তৈরি করুন
                </label>
              </div>
              {!noFee && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  {feeClasses.map(cls => (
                    <div key={cls} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <label style={{ fontSize: '0.82rem', minWidth: 80, color: 'var(--text)' }}>{cls}</label>
                      <input
                        type="number" min="0" placeholder="0"
                        className="input-field"
                        style={{ flex: 1, padding: '8px 10px' }}
                        value={classFees[cls] || ''}
                        onChange={e => setClassFees(prev => ({ ...prev, [cls]: Number(e.target.value) }))}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button variant="outline" onClick={closeModal} type="button">বাতিল</Button>
            <Button type="submit">{editExam ? 'আপডেট করুন' : 'সংরক্ষণ করুন'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
