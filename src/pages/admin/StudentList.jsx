import { useState, useEffect } from 'react';
import { useStudents } from '../../context/StudentContext';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { useSessionFilter } from '../../context/SessionFilterContext';
import { useForm } from 'react-hook-form';
import api from '../../services/api';
import Table from '../../components/Table';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import InputField from '../../components/InputField';
import SelectBox from '../../components/SelectBox';
import Pagination from '../../components/Pagination';
import AdvancedSearchBar from '../../components/AdvancedSearchBar';
import SessionFilter from '../../components/SessionFilter';
import StudentDetailDrawer from '../../components/StudentDetailDrawer';
import { FiPlus, FiSearch, FiArchive, FiEye, FiEdit2, FiCamera, FiRotateCcw } from 'react-icons/fi';
import { CLASS_OPTIONS } from '../../utils/constants';
import swal from '../../utils/swal';
import { compressImage } from '../../utils/compressImage';
import './StudentList.css';
export default function StudentList() {
  const { students: contextStudents, addStudent, updateStudent, deleteStudent, restoreStudent, fetchArchivedStudents, fetchStudents } = useStudents();
  const { settings } = useSiteSettings();
  const { buildQuery, classFilter, section, studentId: filterStudentId, sessionId } = useSessionFilter();
  const [showModal, setShowModal]     = useState(false);
  const [drawerStudent, setDrawerStudent] = useState(null);
  const [page, setPage]               = useState(1);
  const [editStudent, setEditStudent] = useState(null);
  const [editSaving, setEditSaving]   = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedStudents, setArchivedStudents] = useState([]);
  const [archivedSearch, setArchivedSearch] = useState('');
  const [allClasses, setAllClasses]   = useState([]); // from API
  const [sessions, setSessions]       = useState([]);
  const [addSections, setAddSections] = useState([]);  // sections for add form
  const [editSections, setEditSections] = useState([]); // sections for edit form
  const [students, setStudents] = useState([]); // Search results
  const [searchFilters, setSearchFilters] = useState({});
  const PER_PAGE = 20;
  const editForm = useForm();

  useEffect(() => {
    api.get('/classes').then(res => setAllClasses(Array.isArray(res.data) ? res.data : [])).catch(() => {});
    api.get('/sessions').then(res => {
      const data = Array.isArray(res.data) ? res.data : [];
      setSessions(data);
      const current = data.find(s => s.is_current == 1);
      if (current) setValue('session_id', current.id);
    }).catch(() => {});
  }, []);

  // Load students based on search filters
  useEffect(() => {
    loadStudents();
  }, [searchFilters]);

  const loadStudents = async () => {
    try {
      const params = new URLSearchParams();
      if (searchFilters.q) params.append('search', searchFilters.q);
      if (searchFilters.session_id) params.append('session_id', searchFilters.session_id);
      if (searchFilters.class_id) params.append('class_id', searchFilters.class_id);
      
      const res = await api.get(`/students?${params}&limit=2000`);
      setStudents(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error('Error loading students:', e);
      setStudents([]);
    }
  };

  const handleSearch = (filters) => {
    setSearchFilters(filters);
    setPage(1);
  };

  const [error, setError]           = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm();
  const [photoFile, setPhotoFile] = useState(null);
  const [editPhotoFile, setEditPhotoFile] = useState(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState('');

  // Watch class selection to load sections dynamically
  const addSelectedClass = watch('class');
  const editSelectedClass = editForm.watch('class');
  
  // Watch guardian type selection
  const addGuardianType = watch('guardian_type');
  const editGuardianType = editForm.watch('guardian_type');

  const getSections = (className) => {
    const cls = allClasses.find(c => c.name === className);
    return cls?.sections || [];
  };

  useEffect(() => { setAddSections(getSections(addSelectedClass)); }, [addSelectedClass, allClasses]);
  useEffect(() => { setEditSections(getSections(editSelectedClass)); }, [editSelectedClass, allClasses]);

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setPhotoFile(compressed);
    const reader = new FileReader();
    reader.onload = ev => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(compressed);
  };

  const handleEditPhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setEditPhotoFile(compressed);
    const reader = new FileReader();
    reader.onload = ev => setEditPhotoPreview(ev.target.result);
    reader.readAsDataURL(compressed);
  };

  const onAdd = async (data) => {
    setError('');
    try {
      const formData = new FormData();
      // Use Bengali name as primary display name
      formData.append('name', data.name_bn);
      formData.append('name_bn', data.name_bn);
      formData.append('name_en', data.name_en || '');
      formData.append('class', data.class);
      if (data.session_id) formData.append('session_id', data.session_id);
      // Father and mother names
      formData.append('father_name_bn', data.father_name_bn);
      formData.append('father_name_en', data.father_name_en || '');
      formData.append('mother_name_bn', data.mother_name_bn || '');
      formData.append('mother_name_en', data.mother_name_en || '');
      // Guardian information
      formData.append('guardian_type', data.guardian_type || 'father');
      if (data.guardian_type === 'other') {
        formData.append('guardian_name', data.guardian_name || '');
        formData.append('guardian_relation', data.guardian_relation || '');
      }
      formData.append('phone', data.phone);
      formData.append('address', data.address);
      formData.append('section', data.section || 'ক');
      formData.append('status', 'সক্রিয়');
      if (photoFile) formData.append('photo', photoFile);
      await addStudent(formData);
      swal.success('শিক্ষার্থী যোগ করা হয়েছে');
      reset();
      const current = sessions.find(s => s.is_current == 1);
      if (current) setValue('session_id', current.id);
      setPhotoPreview(''); setPhotoFile(null); setShowModal(false);
      loadStudents();
    } catch (e) {
      setError(e.message || 'শিক্ষার্থী যোগ করতে ব্যর্থ হয়েছে।');
    }
  };

  const handleDelete = async (id) => {
    const ok = await swal.confirm('শিক্ষার্থী আর্কাইভ করবেন?', 'শিক্ষার্থীর সকল তথ্য সংরক্ষিত থাকবে এবং পরে পুনরুদ্ধার করা যাবে।', 'আর্কাইভ করুন');
    if (!ok) return;
    try { await deleteStudent(id); swal.success('শিক্ষার্থী আর্কাইভ করা হয়েছে'); }
    catch (e) { await swal.error(e.message || 'ব্যর্থ হয়েছে।'); }
  };

  const handleRestore = async (id) => {
    try {
      await restoreStudent(id);
      setArchivedStudents(prev => prev.filter(s => s.id !== id));
      swal.success('শিক্ষার্থী পুনরুদ্ধার করা হয়েছে');
    } catch (e) { await swal.error(e.message); }
  };

  const openArchived = async () => {
    const list = await fetchArchivedStudents(archivedSearch);
    setArchivedStudents(list);
    setShowArchived(true);
  };

  const openEdit = (student) => {
    setEditStudent(student);
    setEditPhotoPreview(student.photo || '');
    setEditPhotoFile(null);
    editForm.reset({
      name_bn:            student.name_bn || student.name,
      name_en:            student.name_en || '',
      class:              student.class || student.class_name,
      roll:               student.roll,
      father_name_bn:     student.father_name_bn || student.guardian,
      father_name_en:     student.father_name_en || '',
      mother_name_bn:     student.mother_name_bn || '',
      mother_name_en:     student.mother_name_en || '',
      guardian_type:      student.guardian_type || 'father',
      guardian_name:      student.guardian_name || '',
      guardian_relation:  student.guardian_relation || '',
      phone:              student.phone,
      address:            student.address || '',
      section:            student.section || '',
    });
  };

  const onEdit = async (data) => {
    setEditSaving(true);
    try {
      if (editPhotoFile) {
        // Use FormData when uploading a photo
        const formData = new FormData();
        formData.append('name', data.name_bn);
        formData.append('name_bn', data.name_bn);
        formData.append('name_en', data.name_en || '');
        formData.append('class', data.class);
        formData.append('roll', Number(data.roll));
        formData.append('father_name_bn', data.father_name_bn);
        formData.append('father_name_en', data.father_name_en || '');
        formData.append('mother_name_bn', data.mother_name_bn || '');
        formData.append('mother_name_en', data.mother_name_en || '');
        formData.append('guardian_type', data.guardian_type || 'father');
        if (data.guardian_type === 'other') {
          formData.append('guardian_name', data.guardian_name || '');
          formData.append('guardian_relation', data.guardian_relation || '');
        }
        formData.append('phone', data.phone);
        formData.append('address', data.address || '');
        formData.append('section', data.section || '');
        formData.append('photo', editPhotoFile);
        await updateStudent(editStudent.id, formData);
      } else {
        // Use JSON when no photo upload
        await updateStudent(editStudent.id, {
          name: data.name_bn,
          name_bn: data.name_bn,
          name_en: data.name_en || '',
          class: data.class,
          roll: Number(data.roll),
          father_name_bn: data.father_name_bn,
          father_name_en: data.father_name_en || '',
          mother_name_bn: data.mother_name_bn || '',
          mother_name_en: data.mother_name_en || '',
          guardian_type: data.guardian_type || 'father',
          guardian_name: data.guardian_type === 'other' ? data.guardian_name : '',
          guardian_relation: data.guardian_type === 'other' ? data.guardian_relation : '',
          phone: data.phone,
          address: data.address || '',
          section: data.section || '',
        });
      }
      swal.success('তথ্য আপডেট হয়েছে');
      setEditStudent(null);
      setEditPhotoPreview('');
      setEditPhotoFile(null);
    } catch (e) {
      await swal.error(e.message);
    } finally {
      setEditSaving(false);
    }
  };

  const columns = [
    { header: 'আইডি', key: 'id' },
    { header: 'ছবি', render: r => r.photo
      ? <img src={r.photo} alt={r.name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }} />
      : <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{r.name[0]}</div>
    },
    { header: 'নাম', key: 'name' },
    { header: 'শ্রেণি', key: 'class' },
    { header: 'রোল', key: 'roll' },
    { header: 'অভিভাবক', key: 'guardian' },
    { header: 'অ্যাকশন', render: r => (
      <div style={{ display: 'flex', gap: 6 }}>
        <Button size="sm" variant="outline" icon={<FiEye />}     onClick={() => setDrawerStudent(r)} />
        <Button size="sm" variant="outline" icon={<FiEdit2 />}   onClick={() => openEdit(r)} />
        <Button size="sm" variant="danger"  icon={<FiArchive />} onClick={() => handleDelete(r.id)} />
      </div>
    )},
  ];

  return (
    <div className="student-list-page">
      <div className="page-top">
        <div>
          <h1 className="page-title">শিক্ষার্থী তালিকা</h1>
          <p className="page-subtitle">মোট {students.length} জন শিক্ষার্থী</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="outline" icon={<FiArchive />} onClick={openArchived}>আর্কাইভ</Button>
          <Button icon={<FiPlus />} onClick={() => setShowModal(true)}>নতুন শিক্ষার্থী</Button>
        </div>
      </div>

      <div className="search-bar">
        <AdvancedSearchBar 
          context="students"
          onSearch={handleSearch}
          showSessionFilter={true}
          showClassFilter={true}
          showMonthFilter={false}
          showExamFilter={false}
        />
      </div>

      <div className="card">
        <Table columns={columns} data={students.slice((page-1)*PER_PAGE, page*PER_PAGE)} />
        <Pagination page={page} total={students.length} perPage={PER_PAGE} onChange={p => { setPage(p); }} />
      </div>

      {/* Add Modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setError(''); setPhotoPreview(''); setPhotoFile(null); }} title="নতুন শিক্ষার্থী যোগ করুন" size="lg">
        <form onSubmit={handleSubmit(onAdd)} className="add-form">
          {/* Photo Upload */}
          <div className="photo-upload-area">
            <div className="photo-preview">
              {photoPreview
                ? <img src={photoPreview} alt="preview" className="photo-preview-img" />
                : <div className="photo-placeholder"><FiCamera size={28} /><span>ছবি যোগ করুন</span></div>
              }
            </div>
            <label className="photo-upload-btn">
              <FiCamera /> ছবি নির্বাচন করুন
              <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
            </label>
          </div>
          <div className="form-grid">
            <InputField label="শিক্ষার্থীর নাম (বাংলা)" name="name_bn" register={register} error={errors.name_bn} required placeholder="শিক্ষার্থীর নাম বাংলায়" />
            <InputField label="শিক্ষার্থীর নাম (English)" name="name_en" register={register} error={errors.name_en} placeholder="Student Name in English" />
            <SelectBox label="শ্রেণি" name="class"
              options={allClasses.length > 0
                ? allClasses.map(c => ({ value: c.name, label: c.name }))
                : CLASS_OPTIONS}
              register={register} error={errors.class} required />
            {addSections.length > 0 && (
              <SelectBox label="সেকশন" name="section"
                options={addSections.map(s => ({ value: s, label: s }))}
                register={register} />
            )}
            <SelectBox label="শিক্ষাবর্ষ" name="session_id"
              options={sessions.map(s => ({ value: s.id, label: s.name }))}
              register={register} error={errors.session_id} required />
            <InputField label="পিতার নাম (বাংলা)" name="father_name_bn" register={register} error={errors.father_name_bn} required placeholder="পিতার নাম বাংলায়" />
            <InputField label="পিতার নাম (English)" name="father_name_en" register={register} error={errors.father_name_en} placeholder="Father's Name in English" />
            <InputField label="মাতার নাম (বাংলা)" name="mother_name_bn" register={register} error={errors.mother_name_bn} placeholder="মাতার নাম বাংলায়" />
            <InputField label="মাতার নাম (English)" name="mother_name_en" register={register} error={errors.mother_name_en} placeholder="Mother's Name in English" />
          </div>
          
          {/* Guardian Selection */}
          <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 16, marginTop: 16 }}>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--primary)', marginBottom: 12 }}>
              অভিভাবক নির্বাচন করুন
            </p>
            <SelectBox label="অভিভাবক" name="guardian_type"
              options={[
                { value: 'father', label: 'পিতা' },
                { value: 'mother', label: 'মাতা' },
                { value: 'other', label: 'অন্যান্য' }
              ]}
              register={register} required />
            
            {addGuardianType === 'other' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                <InputField label="অভিভাবকের নাম" name="guardian_name" register={register} error={errors.guardian_name} required placeholder="অভিভাবকের নাম" />
                <InputField label="সম্পর্ক" name="guardian_relation" register={register} error={errors.guardian_relation} required placeholder="যেমন: চাচা, মামা, দাদা" />
              </div>
            )}
          </div>
          
          <div className="form-grid" style={{ marginTop: 16 }}>
            <InputField label="মোবাইল নম্বর" name="phone" register={register} error={errors.phone} required placeholder="01XXXXXXXXX" />
            <InputField label="ঠিকানা" name="address" register={register} error={errors.address} required placeholder="বর্তমান ঠিকানা" />
          </div>
          {error && <div className="login-error" style={{ marginTop: 12 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'flex-end' }}>
            <Button variant="outline" onClick={() => { setShowModal(false); setError(''); setPhotoPreview(''); setPhotoFile(null); }} type="button">বাতিল</Button>
            <Button type="submit">সংরক্ষণ করুন</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Student Modal */}
      <Modal isOpen={!!editStudent} onClose={() => setEditStudent(null)} title="শিক্ষার্থীর তথ্য সম্পাদনা" size="md">
        {editStudent && (
          <form onSubmit={editForm.handleSubmit(onEdit)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Photo Upload for Edit */}
            <div className="photo-upload-area" style={{ marginBottom: 10 }}>
              <div className="photo-preview">
                {editPhotoPreview
                  ? <img src={editPhotoPreview} alt="preview" className="photo-preview-img" />
                  : <div className="photo-placeholder"><FiCamera size={28} /><span>ছবি যোগ করুন</span></div>
                }
              </div>
              <label className="photo-upload-btn">
                <FiCamera /> ছবি পরিবর্তন করুন
                <input type="file" accept="image/*" onChange={handleEditPhotoChange} style={{ display: 'none' }} />
              </label>
            </div>
            
            {/* ID — read only */}
            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>শিক্ষার্থী আইডি: </span>
              <strong style={{ color: 'var(--primary)', fontFamily: 'monospace' }}>{editStudent.id}</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 8 }}>(পরিবর্তনযোগ্য নয়)</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <InputField label="শিক্ষার্থীর নাম (বাংলা) *" name="name_bn" register={editForm.register} error={editForm.formState.errors.name_bn} required placeholder="শিক্ষার্থীর নাম বাংলায়" />
              <InputField label="শিক্ষার্থীর নাম (English)" name="name_en" register={editForm.register} placeholder="Student Name in English" />
              <SelectBox label="শ্রেণি *" name="class"
                options={allClasses.length > 0
                  ? allClasses.map(c => ({ value: c.name, label: c.name }))
                  : CLASS_OPTIONS}
                register={editForm.register} required />
              <InputField label="রোল নম্বর *" name="roll" type="number" register={editForm.register} error={editForm.formState.errors.roll} required placeholder="রোল" />
              {editSections.length > 0 ? (
                <SelectBox label="সেকশন" name="section"
                  options={editSections.map(s => ({ value: s, label: s }))}
                  register={editForm.register} />
              ) : (
                <InputField label="সেকশন" name="section" register={editForm.register} placeholder="সেকশন" />
              )}
              <div></div>
              <InputField label="পিতার নাম (বাংলা) *" name="father_name_bn" register={editForm.register} error={editForm.formState.errors.father_name_bn} required placeholder="পিতার নাম বাংলায়" />
              <InputField label="পিতার নাম (English)" name="father_name_en" register={editForm.register} placeholder="Father's Name in English" />
              <InputField label="মাতার নাম (বাংলা)" name="mother_name_bn" register={editForm.register} placeholder="মাতার নাম বাংলায়" />
              <InputField label="মাতার নাম (English)" name="mother_name_en" register={editForm.register} placeholder="Mother's Name in English" />
            </div>
            
            {/* Guardian Selection */}
            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 16, marginTop: 16 }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--primary)', marginBottom: 12 }}>
                অভিভাবক নির্বাচন করুন
              </p>
              <SelectBox label="অভিভাবক" name="guardian_type"
                options={[
                  { value: 'father', label: 'পিতা' },
                  { value: 'mother', label: 'মাতা' },
                  { value: 'other', label: 'অন্যান্য' }
                ]}
                register={editForm.register} required />
              
              {editGuardianType === 'other' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                  <InputField label="অভিভাবকের নাম" name="guardian_name" register={editForm.register} error={editForm.formState.errors.guardian_name} required placeholder="অভিভাবকের নাম" />
                  <InputField label="সম্পর্ক" name="guardian_relation" register={editForm.register} error={editForm.formState.errors.guardian_relation} required placeholder="যেমন: চাচা, মামা, দাদা" />
                </div>
              )}
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
              <InputField label="মোবাইল নম্বর *" name="phone" register={editForm.register} error={editForm.formState.errors.phone} required placeholder="01XXXXXXXXX" />
            </div>
            <InputField label="ঠিকানা" name="address" register={editForm.register} placeholder="বাড়ি / গ্রাম / শহর" />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <Button variant="outline" type="button" onClick={() => setEditStudent(null)}>বাতিল</Button>
              <Button type="submit" disabled={editSaving}>{editSaving ? 'সংরক্ষণ হচ্ছে...' : 'আপডেট করুন'}</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Archived Students Modal */}
      <Modal isOpen={showArchived} onClose={() => setShowArchived(false)} title="আর্কাইভ করা শিক্ষার্থী" size="lg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ padding: '10px 14px', background: '#fef3c7', borderRadius: 8, fontSize: '0.85rem', color: '#92400e' }}>
            আর্কাইভ করা শিক্ষার্থীদের সকল তথ্য, ফি ও ফলাফল সংরক্ষিত আছে। পুনরুদ্ধার করলে তারা আগের আইডি নিয়ে সক্রিয় হবে।
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              className="search-input"
              style={{ flex: 1, padding: '8px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'inherit' }}
              placeholder="আইডি বা নাম দিয়ে খুঁজুন..."
              value={archivedSearch}
              onChange={async e => {
                setArchivedSearch(e.target.value);
                const list = await fetchArchivedStudents(e.target.value);
                setArchivedStudents(list);
              }}
            />
          </div>
          {archivedStudents.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>কোনো আর্কাইভ করা শিক্ষার্থী নেই।</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
                    {['আইডি','নাম','শ্রেণি','রোল','অভিভাবক','অ্যাকশন'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {archivedStudents.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 600 }}>{s.id}</td>
                      <td style={{ padding: '10px 14px' }}>{s.name}</td>
                      <td style={{ padding: '10px 14px' }}>{s.class}</td>
                      <td style={{ padding: '10px 14px' }}>{s.roll}</td>
                      <td style={{ padding: '10px 14px' }}>{s.guardian}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <Button size="sm" variant="success" icon={<FiRotateCcw />} onClick={() => handleRestore(s.id)}>
                          পুনরুদ্ধার
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      {/* Student Detail Drawer */}
      <StudentDetailDrawer
        student={drawerStudent}
        onClose={() => setDrawerStudent(null)}
      />
    </div>
  );
}

// Archived Students Modal — appended
function ArchivedStudentsModal({ isOpen, onClose, students, onRestore, onSearch, searchVal }) {
  return null; // placeholder — handled inline in StudentList
}
