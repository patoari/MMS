import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import InputField from '../components/InputField';
import Button from '../components/Button';
import './Login.css';

const redirectMap = {
  admin:         '/admin',
  teacher:       '/teacher',
  class_teacher: '/teacher',
  student:       '/student',
  accountant:    '/admin',
  visitor:       '/',
  default:       '/', // Fallback for unknown roles
};

export default function Login() {
  const { login, studentLogin, loading } = useAuth();
  const { settings } = useSiteSettings();
  const navigate = useNavigate();
  const [mode, setMode] = useState('staff'); // 'staff' | 'student'
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    setError('');
    try {
      if (mode === 'student') {
        await studentLogin(data.studentId);
        navigate('/student');
      } else {
        const user = await login(data.email, data.password);
        navigate(redirectMap[user.role] || redirectMap.default);
      }
    } catch {
      setError(mode === 'student'
        ? 'শিক্ষার্থী আইডি সঠিক নয়।'
        : 'লগইন ব্যর্থ হয়েছে। ইমেইল বা পাসওয়ার্ড ভুল।');
    }
  };

  return (
    <div className="login-page">
      <div className="login-left islamic-pattern">
        <div className="login-brand">
          <div className="login-brand-icon">
            {settings?.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" style={{ height: 80, objectFit: 'contain' }} />
            ) : (
              settings?.logoEmoji || ''
            )}
          </div>
          <h1 className="login-brand-name">{settings?.siteName || 'ধামালকোট মোহাম্মাদীয়া মাদ্রাসা'}</h1>
          <p className="login-brand-tagline">{settings?.siteSubtitle || 'ইলম ও আমলের পথে আলোকিত ভবিষ্যৎ গড়ি'}</p>
        </div>
        <div className="login-quote">
          <div className="login-arabic">طَلَبُ الْعِلْمِ فَرِيضَةٌ</div>
          <p>জ্ঞান অর্জন করা ফরজ</p>
        </div>
      </div>

      <div className="login-right">
        <div className="login-form-container">
          <h2 className="login-title">স্বাগতম</h2>
          <p className="login-subtitle">আপনার অ্যাকাউন্টে লগইন করুন</p>

          <div className="role-tabs">
            <button className={`role-tab${mode === 'staff' ? ' active' : ''}`}
              onClick={() => { setMode('staff'); setError(''); }} type="button">
              স্টাফ লগইন
            </button>
            <button className={`role-tab${mode === 'student' ? ' active' : ''}`}
              onClick={() => { setMode('student'); setError(''); }} type="button">
              শিক্ষার্থী লগইন
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="login-form">
            {mode === 'student' ? (
              <InputField
                label="শিক্ষার্থী আইডি"
                name="studentId"
                type="text"
                placeholder="যেমন: MMS-2026-001"
                register={register}
                error={errors.studentId}
                required
              />
            ) : (
              <>
                <InputField label="ইমেইল" name="email" type="email"
                  placeholder="আপনার ইমেইল লিখুন" register={register} error={errors.email} required />
                <InputField label="পাসওয়ার্ড" name="password" type="password"
                  placeholder="পাসওয়ার্ড লিখুন" register={register} error={errors.password} required />
              </>
            )}
            {error && <div className="login-error">{error}</div>}
            <Button type="submit" fullWidth disabled={loading}>
              {loading ? 'লগইন হচ্ছে...' : 'লগইন করুন'}
            </Button>
          </form>

          {mode === 'staff' && (
            <p className="register-login-link">
              নতুন অ্যাকাউন্ট নেই?{' '}
              <Link to="/register">রেজিস্ট্রেশন করুন</Link>
            </p>
          )}
          <Link to="/" className="back-home">← হোমপেজে ফিরুন</Link>
        </div>
      </div>
    </div>
  );
}
