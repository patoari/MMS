import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import api from '../../services/api';
import swal from '../../utils/swal';
import InputField from '../../components/InputField';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import { FiGlobe, FiPhone, FiShare2, FiRefreshCw, FiSave, FiUpload, FiX, FiPlus, FiTrash2, FiEye, FiEyeOff, FiLayout, FiBook, FiUsers } from 'react-icons/fi';
import GalleryInline from '../../components/admin/settings/GalleryInline';
import WritingsManager from '../../components/admin/settings/WritingsManager';
import CommitteeManager from '../../components/admin/settings/CommitteeManager';
import { compressImage } from '../../utils/compressImage';
import './SiteSettings.css';

function Section({ icon, title, children }) {
  return (
    <div className="settings-section card">
      <div className="settings-section-title">{icon}<span>{title}</span></div>
      <div className="settings-section-body">{children}</div>
    </div>
  );
}

export default function SiteSettings() {
  const { settings, updateSettings, resetSettings, features, addFeature, updateFeature, deleteFeature, toggleFeature,
          homepageTeachers, addHomepageTeacher, updateHomepageTeacher, deleteHomepageTeacher, toggleHomepageTeacher } = useSiteSettings();
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm({ defaultValues: settings });
  const studentPrefix = watch('studentIdPrefix') || settings.studentIdPrefix || 'MMS';
  const teacherPrefix = watch('teacherIdPrefix') || settings.teacherIdPrefix || 'TCH';
  const receiptPrefix = watch('receiptIdPrefix') || settings.receiptIdPrefix || 'RCP';
  const year = new Date().getFullYear();

  // Logo upload state (independent of react-hook-form)
  const [logoPreview, setLogoPreview] = useState(settings.logoUrl || '');
  const [logoFile, setLogoFile]       = useState(null);
  const logoInputRef = useRef();

  // Feature modal state
  const [featureModal, setFeatureModal] = useState(false);
  const [editFeature, setEditFeature]   = useState(null);
  const featureForm = useForm();

  // Teacher modal state
  const [teacherModal, setTeacherModal] = useState(false);
  const [editTeacher, setEditTeacher]   = useState(null);
  const [teacherList, setTeacherList]   = useState([]);
  const [teacherPhotoFile, setTeacherPhotoFile] = useState(null);
  const [teacherPhotoPreview, setTeacherPhotoPreview] = useState('');
  const teacherForm = useForm();

  const openAddFeature = () => { setEditFeature(null); featureForm.reset({ icon: '', title: '', description: '' }); setFeatureModal(true); };
  const openEditFeature = (f) => { setEditFeature(f); featureForm.reset(f); setFeatureModal(true); };

  const onSaveFeature = async (data) => {
    try {
      if (editFeature) await updateFeature(editFeature.id, data);
      else await addFeature(data);
      setFeatureModal(false);
      featureForm.reset();
      swal.success(editFeature ? 'বৈশিষ্ট্য আপডেট হয়েছে।' : 'নতুন বৈশিষ্ট্য যোগ হয়েছে।');
    } catch {
      swal.error('সংরক্ষণ ব্যর্থ হয়েছে। আবার চেষ্টা করুন।');
    }
  };

  const openAddTeacher  = () => {
    setEditTeacher(null);
    setTeacherPhotoFile(null);
    setTeacherPhotoPreview('');
    teacherForm.reset({ teacher_id: '', designation: '' });
    api.get('/teachers').then(res => setTeacherList(Array.isArray(res.data) ? res.data : [])).catch(() => {});
    setTeacherModal(true);
  };
  const openEditTeacher = (t) => {
    setEditTeacher(t);
    setTeacherPhotoFile(null);
    setTeacherPhotoPreview(t.photo || '');
    teacherForm.reset({ teacher_id: t.teacher_id || '', designation: t.designation });
    api.get('/teachers').then(res => setTeacherList(Array.isArray(res.data) ? res.data : [])).catch(() => {});
    setTeacherModal(true);
  };
  const onSaveTeacher = async (data) => {
    const selected = teacherList.find(t => t.id === data.teacher_id);
    let photoUrl = teacherPhotoPreview;

    // Upload photo if a file was selected
    if (teacherPhotoFile) {
      try {
        const formData = new FormData();
        formData.append('photo', teacherPhotoFile);
        const res = await api.post('/homepage-teachers/upload', formData);
        if (res.success && res.data?.url) photoUrl = res.data.url;
      } catch {}
    }

    const payload = {
      teacher_id:  data.teacher_id,
      name:        selected ? selected.name : data.teacher_id,
      designation: data.designation,
      photo:       photoUrl,
    };
    try {
      if (editTeacher) await updateHomepageTeacher(editTeacher.id, payload);
      else await addHomepageTeacher(payload);
      setTeacherModal(false);
      teacherForm.reset();
      setTeacherPhotoFile(null);
      setTeacherPhotoPreview('');
      swal.success(editTeacher ? 'শিক্ষক তথ্য আপডেট হয়েছে।' : 'শিক্ষক যোগ হয়েছে।');
    } catch {
      swal.error('সংরক্ষণ ব্যর্থ হয়েছে। আবার চেষ্টা করুন।');
    }
  };

  useEffect(() => { reset(settings); setLogoPreview(settings.logoUrl || ''); }, [settings, reset]);

  const handleLogoFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setLogoFile(compressed);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target.result);
    reader.readAsDataURL(compressed);
  };

  const clearLogo = () => {
    setLogoFile(null);
    setLogoPreview('');
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const onSubmit = async (data) => {
    try {
      let logoUrl = data.logoUrl || '';

      // If a file was picked, upload it first then get the server URL
      if (logoFile) {
        try {
          const formData = new FormData();
          formData.append('logo', logoFile);
          const res = await api.post('/settings/logo', formData);
          if (res.success && res.data?.logoUrl) {
            logoUrl = res.data.logoUrl;
            setLogoPreview(logoUrl); // update preview to server URL
          }
        } catch (err) {
          // Logo upload failed - continue with form submission
          swal.fire({
            icon: 'warning',
            title: 'লোগো আপলোড ব্যর্থ',
            text: 'লোগো আপলোড করতে সমস্যা হয়েছে, তবে অন্যান্য সেটিংস সংরক্ষণ করা হচ্ছে।',
            timer: 3000
          });
        }
      }

      await updateSettings({ ...data, logoUrl });
      setLogoFile(null);
      
      // Show success message
      swal.fire({
        icon: 'success',
        title: 'সফল!',
        text: 'সাইট সেটিংস সফলভাবে সংরক্ষণ করা হয়েছে।',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (error) {
      // Show error message
      swal.fire({
        icon: 'error',
        title: 'ত্রুটি!',
        text: 'সেটিংস সংরক্ষণ করতে ব্যর্থ হয়েছে। আবার চেষ্টা করুন।',
        confirmButtonText: 'ঠিক আছে'
      });
    }
  };

  return (
    <div className="site-settings-page">
      <div className="page-top">
        <div>
          <h1 className="page-title">সাইট সেটিংস</h1>
          <p className="page-subtitle">সাইটের নাম, লোগো, যোগাযোগ ও অন্যান্য তথ্য পরিবর্তন করুন</p>
        </div>
        <Button variant="outline" icon={<FiRefreshCw />} type="button" onClick={async () => {
          const confirmed = await swal.confirm('ডিফল্টে ফিরে যাবেন?', 'সমস্ত সেটিংস ডিফল্ট মানে রিসেট হয়ে যাবে।', 'হ্যাঁ, রিসেট করুন');
          if (confirmed) { resetSettings(); swal.success('সেটিংস ডিফল্টে ফিরে গেছে।'); }
        }}>
          ডিফল্টে ফিরুন
        </Button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>

        <Section icon={<FiGlobe />} title="সাইট পরিচিতি">
          <div className="settings-grid-2">
            <InputField label="সাইটের নাম (বাংলা)" name="siteName" register={register} error={errors.siteName} required />
            <InputField label="সাইটের নাম (ইংরেজি)" name="siteNameEn" register={register} error={errors.siteNameEn} placeholder="English Name" />
          </div>
          <InputField label="সাইটের নাম (আরবি)" name="siteNameAr" register={register} error={errors.siteNameAr} />
          <InputField label="সাবটাইটেল" name="siteSubtitle" register={register} error={errors.siteSubtitle} />

          {/* Logo section */}
          <div className="logo-upload-section">
            <label className="input-label">লোগো</label>
            <div className="logo-upload-body">

              {/* Left: uploader */}
              <div className="logo-upload-left">
                {/* File drop zone */}
                {!logoPreview ? (
                  <div className="logo-drop-zone" onClick={() => logoInputRef.current?.click()}>
                    <FiUpload className="logo-drop-icon" />
                    <span>ছবি আপলোড করুন</span>
                    <span className="logo-drop-hint">PNG, JPG, SVG, WEBP</span>
                  </div>
                ) : (
                  <div className="logo-preview-box">
                    <img src={logoPreview} alt="লোগো" className="logo-preview-img" />
                    <button type="button" className="logo-clear-btn" onClick={clearLogo}><FiX /></button>
                  </div>
                )}
                <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoFile} />

                {/* Or URL */}
                <div className="logo-or-row"><span>অথবা URL</span></div>
                <input
                  className="settings-input"
                  placeholder="https://example.com/logo.png"
                  {...register('logoUrl')}
                  onChange={e => { register('logoUrl').onChange(e); if (!logoFile) setLogoPreview(e.target.value); }}
                />
              </div>

              {/* Right: emoji fallback */}
              <div className="logo-emoji-right">
                <label className="input-label" style={{ marginBottom: 6 }}>ইমোজি (লোগো না থাকলে)</label>
                <input className="settings-input logo-emoji-input" placeholder="🕌" {...register('logoEmoji')} />
                {!logoPreview && settings.logoEmoji && (
                  <div className="logo-emoji-preview">{settings.logoEmoji}</div>
                )}
              </div>
            </div>
          </div>
          <div>
            <label className="input-label">সম্পর্কে (About)</label>
            <textarea
              className="settings-textarea"
              rows={3}
              {...register('aboutText')}
            />
          </div>
          <InputField label="ফুটার কপিরাইট টেক্সট" name="footerCopy" register={register} error={errors.footerCopy} />
        </Section>

        <Section icon={<FiPhone />} title="যোগাযোগ তথ্য">
          <InputField label="ঠিকানা" name="address" register={register} error={errors.address} />
          <div className="settings-grid-2">
            <InputField label="ফোন নম্বর" name="phone" register={register} error={errors.phone} />
            <InputField label="ইমেইল" name="email" register={register} error={errors.email} />
          </div>
          <InputField label="অফিস সময়" name="officeHours" register={register} error={errors.officeHours} />
        </Section>

        <Section icon={<FiShare2 />} title="সোশ্যাল মিডিয়া">
          <div className="settings-grid-3">
            <InputField label="Facebook URL" name="facebook" register={register} error={errors.facebook} placeholder="https://facebook.com/..." />
            <InputField label="YouTube URL" name="youtube" register={register} error={errors.youtube} placeholder="https://youtube.com/..." />
            <InputField label="Twitter/X URL" name="twitter" register={register} error={errors.twitter} placeholder="https://twitter.com/..." />
          </div>
        </Section>

        <Section icon={<FiBook />} title="আইডি প্রিফিক্স সেটিংস">
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 16 }}>
            শিক্ষার্থী, শিক্ষক ও রসিদের আইডি নম্বরের শুরুতে যে প্রিফিক্স ব্যবহার হবে তা এখানে নির্ধারণ করুন।
            উদাহরণ: প্রিফিক্স <strong>MMS</strong> হলে আইডি হবে <strong>MMS-2026-0001</strong>
          </p>
          <div className="settings-grid-3">
            <div>
              <InputField
                label="শিক্ষার্থী আইডি প্রিফিক্স"
                name="studentIdPrefix"
                register={register}
                placeholder="MMS"
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                পূর্বরূপ: {studentPrefix}-{year}-0001
              </p>
            </div>
            <div>
              <InputField
                label="শিক্ষক আইডি প্রিফিক্স"
                name="teacherIdPrefix"
                register={register}
                placeholder="TCH"
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                পূর্বরূপ: {teacherPrefix}-{year}-001
              </p>
            </div>
            <div>
              <InputField
                label="রসিদ নম্বর প্রিফিক্স"
                name="receiptIdPrefix"
                register={register}
                placeholder="RCP"
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                পূর্বরূপ: {receiptPrefix}-{year}-0001
              </p>
            </div>
          </div>
          <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: '10px 14px', marginTop: 12, fontSize: '0.82rem', color: '#92400e' }}>
            ⚠️ প্রিফিক্স পরিবর্তন করলে নতুন আইডি নতুন প্রিফিক্সে তৈরি হবে। পুরনো আইডি অপরিবর্তিত থাকবে।
          </div>
        </Section>

        <Section icon={<FiBook />} title="আইডি কার্ড সেটিংস">
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
            শিক্ষার্থীদের আইডি কার্ডের পিছনের অংশে প্রদর্শিত নিয়মাবলী ও ফুটার টেক্সট কাস্টমাইজ করুন।
          </p>
          
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>
              আইডি কার্ড নিয়মাবলী (পিছনের অংশ)
            </label>
            <textarea
              {...register('idCardRules')}
              rows={4}
              placeholder="আইডি কার্ডের নিয়মাবলী লিখুন (সর্বোচ্চ 40 শব্দ)"
              style={{
                width: '100%',
                padding: '10px',
                border: '1.5px solid var(--border)',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontFamily: 'Hind Siliguri, sans-serif',
                resize: 'vertical',
                minHeight: '80px'
              }}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
              শব্দ: {watch('idCardRules')?.trim().split(/\s+/).filter(w => w.length > 0).length || 0}/40
            </p>
          </div>

          <InputField 
            label="আইডি কার্ড ফুটার টেক্সট (সামনের অংশ)" 
            name="idCardFooterText" 
            register={register} 
            placeholder="ইলম ও আমলের সমন্বয়ে আদর্শ মুসলিম প্রজন্ম গড়ে তোলার লক্ষ্যে"
          />

          <InputField 
            label="পিছনের ফুটার লাইন 1" 
            name="idCardBackFooter1" 
            register={register} 
            placeholder="এই কার্ডটি {siteName} এর সম্পত্তি"
            helperText="{siteName} স্বয়ংক্রিয়ভাবে প্রতিস্থাপিত হবে"
          />

          <InputField 
            label="পিছনের ফুটার লাইন 2" 
            name="idCardBackFooter2" 
            register={register} 
            placeholder="পাওয়া গেলে উপরের ঠিকানায় ফেরত দিন"
          />
        </Section>

        <Section icon={<FiBook />} title="হিরো সেকশন — স্ট্যাটস ও টেক্সট">          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
            হোমপেজের হিরো সেকশনের সাবটাইটেল, বিবরণ এবং স্ট্যাটস কার্ডের লেবেল পরিবর্তন করুন। শিক্ষার্থী ও শিক্ষকের সংখ্যা স্বয়ংক্রিয়ভাবে ডেটাবেজ থেকে লোড হবে।
          </p>
          <div className="settings-grid-2">
            <InputField label="হিরো সাবটাইটেল" name="heroSubtitle" register={register} placeholder="ইলম ও আমলের পথে আলোকিত ভবিষ্যৎ গড়ি" />
            <InputField label="হিরো বিবরণ" name="heroDesc" register={register} placeholder="আধুনিক শিক্ষা ও ইসলামী মূল্যবোধের সমন্বয়ে..." />
          </div>
          <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text)', marginTop: 8, marginBottom: 8 }}>স্ট্যাটস লেবেল</p>
          <div className="settings-grid-2">
            <InputField label="শিক্ষার্থী লেবেল" name="statStudentLabel" register={register} placeholder="শিক্ষার্থী" />
            <InputField label="শিক্ষক লেবেল" name="statTeacherLabel" register={register} placeholder="শিক্ষক" />
            <InputField label="বছর (সংখ্যা)" name="statYears" register={register} placeholder="15+" />
            <InputField label="বছর লেবেল" name="statYearsLabel" register={register} placeholder="বছর" />
            <InputField label="পাসের হার (সংখ্যা)" name="statPassRate" register={register} placeholder="100%" />
            <InputField label="পাসের হার লেবেল" name="statPassRateLabel" register={register} placeholder="পাসের হার" />
          </div>
        </Section>

        <Section icon={<FiBook />} title="ইসলামিক ক্যালিগ্রাফি ব্যানার">
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 8 }}>
            প্রতিটি সেকশনের মাঝে স্ক্রলিং ক্যালিগ্রাফি ব্যানারে যে আরবি টেক্সটগুলো দেখাবে তা এখানে লিখুন। প্রতিটি লাইনে একটি করে টেক্সট লিখুন।
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>আরবি টেক্সট (প্রতি লাইনে একটি)</label>
            <textarea rows={8} {...register('calligraphyTexts')}
              placeholder={`بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ\nالْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ\nسُبْحَانَ اللَّهِ وَبِحَمْدِهِ`}
              style={{ padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '1rem', fontFamily: 'Amiri, serif', direction: 'rtl', resize: 'vertical', lineHeight: 2 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <Button type="submit" icon={<FiSave />}>সংরক্ষণ করুন</Button>
          </div>
        </Section>

        <Section icon={<FiBook />} title="ইসলামিক সেকশন (হোমপেজ)">
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
            হোমপেজের হাদিস ও কুরআনের আয়াত কার্ডের বিষয়বস্তু পরিবর্তন করুন।
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem' }}>আজকের হাদিস</p>
              <InputField label="আরবি টেক্সট" name="hadithArabic" register={register} placeholder="আরবি হাদিস লিখুন" />
              <InputField label="বাংলা অনুবাদ" name="hadithBangla" register={register} placeholder="বাংলা অনুবাদ লিখুন" />
              <InputField label="সূত্র" name="hadithSource" register={register} placeholder="যেমন: ইবনে মাজাহ" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem' }}>কুরআনের আয়াত</p>
              <InputField label="আরবি আয়াত" name="quranArabic" register={register} placeholder="আরবি আয়াত লিখুন" />
              <InputField label="বাংলা অনুবাদ" name="quranBangla" register={register} placeholder="বাংলা অনুবাদ লিখুন" />
              <InputField label="সূরা ও আয়াত নম্বর" name="quranSource" register={register} placeholder="যেমন: সূরা আলাক, আয়াত 1" />
            </div>
          </div>
        </Section>

        <Section icon={<FiBook />} title="দৈনিক উপদেশ (শিক্ষার্থীদের জন্য)">
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
            হোমপেজে নোটিশের পরে শিক্ষার্থীদের জন্য দৈনিক উপদেশ কার্ড দেখানো হবে।
          </p>
          <InputField label="সেকশন শিরোনাম" name="adviceTitle" register={register} placeholder="শিক্ষার্থীদের জন্য দৈনিক উপদেশ" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <InputField label="কার্ড 1 লেবেল" name="advice1Label" register={register} placeholder="যেমন: আজকের উপদেশ" />
              <InputField label="আরবি টেক্সট" name="advice1Arabic" register={register} placeholder="আরবি লিখুন" />
              <InputField label="বাংলা অনুবাদ" name="advice1Bangla" register={register} placeholder="বাংলা অনুবাদ" />
              <InputField label="সূত্র" name="advice1Source" register={register} placeholder="যেমন: বুখারি" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <InputField label="কার্ড 2 লেবেল" name="advice2Label" register={register} placeholder="যেমন: আজকের দোয়া" />
              <InputField label="আরবি টেক্সট" name="advice2Arabic" register={register} placeholder="আরবি লিখুন" />
              <InputField label="বাংলা অনুবাদ" name="advice2Bangla" register={register} placeholder="বাংলা অনুবাদ" />
              <InputField label="সূত্র" name="advice2Source" register={register} placeholder="যেমন: মুসলিম" />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <Button type="submit" icon={<FiSave />}>পরিবর্তন সংরক্ষণ করুন</Button>
          </div>
        </Section>

        <Section icon={<FiLayout />} title="সাফল্য ও অভিনন্দন সেকশন (হোমপেজ)">
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
            শিক্ষক ও শিক্ষার্থীদের সাফল্য, পুরস্কার বা অভিনন্দন বার্তা দেখান।
          </p>
          <InputField label="সেকশন শিরোনাম" name="achieveTitle" register={register} placeholder="সাফল্য ও অভিনন্দন" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <InputField label="কার্ড 1 লেবেল" name="achieve1Label" register={register} placeholder="যেমন: শিক্ষক সাফল্য" />
              <InputField label="শিরোনাম / নাম" name="achieve1Title" register={register} placeholder="যেমন: মাওলানা আব্দুল হামিদ" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>বিবরণ</label>
                <textarea rows={3} {...register('achieve1Body')} placeholder="সাফল্যের বিবরণ লিখুন..."
                  style={{ padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '0.9rem', fontFamily: 'Hind Siliguri, sans-serif', resize: 'vertical' }} />
              </div>
              <InputField label="সূত্র / তারিখ" name="achieve1Source" register={register} placeholder="যেমন: 2026 সাল" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <InputField label="কার্ড 2 লেবেল" name="achieve2Label" register={register} placeholder="যেমন: শিক্ষার্থী সাফল্য" />
              <InputField label="শিরোনাম / নাম" name="achieve2Title" register={register} placeholder="যেমন: মোহাম্মদ আব্দুল্লাহ" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>বিবরণ</label>
                <textarea rows={3} {...register('achieve2Body')} placeholder="সাফল্যের বিবরণ লিখুন..."
                  style={{ padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '0.9rem', fontFamily: 'Hind Siliguri, sans-serif', resize: 'vertical' }} />
              </div>
              <InputField label="সূত্র / তারিখ" name="achieve2Source" register={register} placeholder="যেমন: 2026 সাল" />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <Button type="submit" icon={<FiSave />}>পরিবর্তন সংরক্ষণ করুন</Button>
          </div>
        </Section>

        <Section icon={<FiUsers />} title="শিক্ষার্থীদের লেখালেখি (হোমপেজ)">
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
            শিক্ষার্থীদের প্রবন্ধ, কবিতা, ছোটগল্প ও ইসলামিক গান এখানে যোগ করুন।
          </p>
          <InputField label="সেকশন শিরোনাম" name="writingsTitle" register={register} placeholder="শিক্ষার্থীদের লেখালেখি" />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <Button type="submit" icon={<FiSave />}>সংরক্ষণ করুন</Button>
          </div>
          <WritingsManager />
        </Section>

        <Section icon={<FiLayout />} title="গ্যালারি সেকশন (হোমপেজ)">          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
            হোমপেজে গ্যালারি সেকশন দেখানো নিয়ন্ত্রণ করুন।
          </p>
          <div className="settings-grid-2">
            <InputField label="সেকশন শিরোনাম" name="galleryTitle" register={register} placeholder="আমাদের গ্যালারি" />
            <InputField label="সর্বোচ্চ ছবির সংখ্যা" name="galleryCount" register={register} placeholder="8" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, marginBottom: 16 }}>
            <input type="checkbox" id="showGallery" style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
              {...register('showGallery')}
              defaultChecked={settings.showGallery !== '0'}
            />
            <label htmlFor="showGallery" style={{ fontSize: '0.9rem', cursor: 'pointer' }}>
              হোমপেজে গ্যালারি সেকশন দেখান
            </label>
          </div>

          <GalleryInline />
        </Section>

        <Section icon={<FiGlobe />} title="ফুটার পাতাসমূহ (গোপনীয়তা নীতি, শর্তাবলী, সাইটম্যাপ)">
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
            ফুটারের লিংকগুলোর বিষয়বস্তু এখানে লিখুন। প্রতিটি লাইন আলাদা অনুচ্ছেদ হিসেবে দেখাবে।
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--primary)' }}>গোপনীয়তা নীতি</label>
              <textarea className="settings-textarea" rows={5} {...register('privacyPolicy')}
                placeholder="গোপনীয়তা নীতির বিষয়বস্তু লিখুন..." />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--primary)' }}>শর্তাবলী</label>
              <textarea className="settings-textarea" rows={5} {...register('termsConditions')}
                placeholder="শর্তাবলীর বিষয়বস্তু লিখুন..." />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--primary)' }}>সাইটম্যাপ</label>
              <textarea className="settings-textarea" rows={5} {...register('sitemapContent')}
                placeholder="সাইটম্যাপের বিষয়বস্তু লিখুন..." />
            </div>
          </div>
        </Section>

        <div className="settings-submit">
          <Button type="submit" icon={<FiSave />}>পরিবর্তন সংরক্ষণ করুন</Button>
        </div>
      </form>

      {/* ── Features Section (outside main form) ── */}
      <Section icon={<FiLayout />} title="হোমপেজ বৈশিষ্ট্য (Features)">
        <div className="features-manager-header">
          <p className="features-manager-hint">হোমপেজের "আমাদের বৈশিষ্ট্য" সেকশনের কার্ডগুলো এখান থেকে পরিচালনা করুন।</p>
          <Button size="sm" icon={<FiPlus />} onClick={openAddFeature}>নতুন যোগ করুন</Button>
        </div>
        <div className="features-manager-list">
          {features.map(f => (
            <div key={f.id} className={`feature-manager-item${!f.is_active ? ' inactive' : ''}`}>
              <div className="fmi-icon">{f.icon}</div>
              <div className="fmi-info">
                <div className="fmi-title">{f.title}</div>
                <div className="fmi-desc">{f.description}</div>
              </div>
              <div className="fmi-actions">
                <button className="fmi-btn" title={f.is_active ? 'লুকান' : 'দেখান'} onClick={async () => {
                  await toggleFeature(f.id);
                  swal.success(f.is_active ? 'বৈশিষ্ট্য লুকানো হয়েছে।' : 'বৈশিষ্ট্য দেখানো হচ্ছে।');
                }}>
                  {f.is_active ? <FiEye /> : <FiEyeOff />}
                </button>
                <button className="fmi-btn edit" title="সম্পাদনা" onClick={() => openEditFeature(f)}>✏️</button>
                <button className="fmi-btn delete" title="মুছুন" onClick={async () => {
                  const confirmed = await swal.confirm(`"${f.title}" মুছে ফেলবেন?`, 'এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না।');
                  if (confirmed) { await deleteFeature(f.id); swal.success('বৈশিষ্ট্য মুছে ফেলা হয়েছে।'); }
                }}><FiTrash2 /></button>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Feature add/edit modal */}
      <Modal
        isOpen={featureModal}
        onClose={() => setFeatureModal(false)}
        title={editFeature ? 'বৈশিষ্ট্য সম্পাদনা' : 'নতুন বৈশিষ্ট্য যোগ করুন'}
        size="sm"
      >
        <form onSubmit={featureForm.handleSubmit(onSaveFeature)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <InputField label="ইমোজি আইকন" name="icon" register={featureForm.register} error={featureForm.formState.errors.icon} required placeholder="যেমন: 📚 🏆 🌐" />
          <InputField label="শিরোনাম" name="title" register={featureForm.register} error={featureForm.formState.errors.title} required placeholder="বৈশিষ্ট্যের নাম" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>বিবরণ *</label>
            <textarea
              rows={3}
              {...featureForm.register('description', { required: 'বিবরণ আবশ্যক' })}
              placeholder="সংক্ষিপ্ত বিবরণ লিখুন"
              style={{ padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '0.9rem', fontFamily: 'Hind Siliguri, sans-serif', resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button variant="outline" type="button" onClick={() => setFeatureModal(false)}>বাতিল</Button>
            <Button type="submit">সংরক্ষণ করুন</Button>
          </div>
        </form>
      </Modal>

      {/* ── Homepage Teachers Section ── */}
      <Section icon={<FiUsers />} title="হোমপেজ শিক্ষক পরিচিতি">
        <div className="features-manager-header">
          <p className="features-manager-hint">হোমপেজে যে শিক্ষকদের পরিচয় দেখাতে চান তাদের এখানে যোগ করুন।</p>
          <Button size="sm" icon={<FiPlus />} onClick={openAddTeacher}>শিক্ষক যোগ করুন</Button>
        </div>
        <div className="features-manager-list">
          {homepageTeachers.map(t => (
            <div key={t.id} className={`feature-manager-item${!t.is_active ? ' inactive' : ''}`}>
              <div className="fmi-icon" style={{ fontSize: '1.6rem' }}>
                {t.photo
                  ? <img src={t.photo} alt={t.name} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                  : '👤'}
              </div>
              <div className="fmi-info">
                <div className="fmi-title">{t.name}</div>
                <div className="fmi-desc">{t.designation}{t.subject ? ` · ${t.subject}` : ''}</div>
              </div>
              <div className="fmi-actions">
                <button className="fmi-btn" title={t.is_active ? 'লুকান' : 'দেখান'} onClick={async () => {
                  await toggleHomepageTeacher(t.id);
                  swal.success(t.is_active ? 'শিক্ষক লুকানো হয়েছে।' : 'শিক্ষক দেখানো হচ্ছে।');
                }}>
                  {t.is_active ? <FiEye /> : <FiEyeOff />}
                </button>
                <button className="fmi-btn edit" onClick={() => openEditTeacher(t)}>✏️</button>
                <button className="fmi-btn delete" onClick={async () => {
                  const confirmed = await swal.confirm(`"${t.name}" মুছে ফেলবেন?`, 'এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না।');
                  if (confirmed) { await deleteHomepageTeacher(t.id); swal.success('শিক্ষক মুছে ফেলা হয়েছে।'); }
                }}><FiTrash2 /></button>
              </div>
            </div>
          ))}
          {homepageTeachers.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: '12px 0' }}>কোনো শিক্ষক যোগ করা হয়নি।</p>
          )}
        </div>
      </Section>

      {/* Teacher add/edit modal */}
      <Modal isOpen={teacherModal} onClose={() => setTeacherModal(false)}
        title={editTeacher ? 'শিক্ষক সম্পাদনা' : 'নতুন শিক্ষক যোগ করুন'} size="sm">
        <form onSubmit={teacherForm.handleSubmit(onSaveTeacher)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Teacher selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>শিক্ষক নির্বাচন করুন *</label>
            <select
              {...teacherForm.register('teacher_id', { required: true })}
              style={{ padding: '10px 14px', border: `1.5px solid ${teacherForm.formState.errors.teacher_id ? 'var(--danger)' : 'var(--border)'}`, borderRadius: 8, fontFamily: 'inherit', fontSize: '0.9rem', background: '#fff' }}
            >
              <option value="">— শিক্ষক নির্বাচন করুন —</option>
              {teacherList.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.id})</option>
              ))}
            </select>
            {teacherForm.formState.errors.teacher_id && (
              <span style={{ fontSize: '0.78rem', color: 'var(--danger)' }}>শিক্ষক নির্বাচন করুন</span>
            )}
          </div>

          <InputField label="পদবি" name="designation" register={teacherForm.register} placeholder="যেমন: প্রধান শিক্ষক" />

          {/* Photo upload */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>ছবি আপলোড করুন</label>
            {teacherPhotoPreview && (
              <img src={teacherPhotoPreview} alt="preview"
                style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', border: '1.5px dashed var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              <FiUpload size={16} />
              {teacherPhotoFile ? teacherPhotoFile.name : 'ছবি নির্বাচন করুন (JPG, PNG)'}
              <input type="file" accept="image/*" style={{ display: 'none' }}
                onChange={async e => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const compressed = await compressImage(f);
                  setTeacherPhotoFile(compressed);
                  const reader = new FileReader();
                  reader.onload = ev => setTeacherPhotoPreview(ev.target.result);
                  reader.readAsDataURL(compressed);
                }} />
            </label>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button variant="outline" type="button" onClick={() => setTeacherModal(false)}>বাতিল</Button>
            <Button type="submit">সংরক্ষণ করুন</Button>
          </div>
        </form>
      </Modal>

      {/* ── Managing Committee Section ── */}
      <Section icon={<FiUsers />} title="পরিচালনা কমিটি (হোমপেজ)">
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 16 }}>
          হোমপেজে প্রদর্শিত পরিচালনা কমিটির সদস্যদের তথ্য যোগ, সম্পাদনা ও মুছে ফেলুন।
        </p>
        <CommitteeManager />
      </Section>
    </div>
  );
}
