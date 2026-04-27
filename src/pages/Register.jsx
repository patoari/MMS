import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import api from '../services/api';
import { useSiteSettings } from '../context/SiteSettingsContext';
import InputField from '../components/InputField';
import Button from '../components/Button';
import './Login.css';
import './Register.css';

export default function Register() {
  const navigate = useNavigate();
  const { settings } = useSiteSettings();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm();
  const password = watch('password');

  const onSubmit = async (data) => {
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/register', {
        name: data.name,
        email: data.email,
        password: data.password,
      });
      navigate('/login');
    } catch (err) {
      setError(err.message || 'রেজিস্ট্রেশন ব্যর্থ হয়েছে।');
    } finally {
      setLoading(false);
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
          <h1 className="login-brand-name">{settings?.siteName || ''}</h1>
          <p className="login-brand-tagline">{settings?.siteSubtitle || ''}</p>
        </div>
        <div className="login-quote">
          <div className="login-arabic">اقْرَأْ بِاسْمِ رَبِّكَ</div>
          <p>পড়ো তোমার প্রভুর নামে</p>
        </div>
      </div>

      <div className="login-right">
        <div className="login-form-container">
          <h2 className="login-title">নতুন অ্যাকাউন্ট</h2>
          <p className="login-subtitle">নিচের তথ্য পূরণ করে রেজিস্ট্রেশন করুন</p>

          <form onSubmit={handleSubmit(onSubmit)} className="login-form">
            <InputField
              label="পূর্ণ নাম"
              name="name"
              type="text"
              placeholder="আপনার পূর্ণ নাম লিখুন"
              register={register}
              error={errors.name}
              required
            />
            <InputField
              label="ইমেইল"
              name="email"
              type="email"
              placeholder="something@dhamalkot.com"
              register={register}
              registerOptions={{
                required: 'ইমেইল আবশ্যক',
                pattern: {
                  value: /^[^\s@]+@dhamalkot\.com$/i,
                  message: 'শুধুমাত্র @dhamalkot.com ইমেইল গ্রহণযোগ্য',
                },
              }}
              error={errors.email}
              required
            />
            <div className="input-group">
              <label className="input-label">পাসওয়ার্ড<span className="required">*</span></label>
              <input
                type="password"
                placeholder="পাসওয়ার্ড লিখুন (কমপক্ষে 6 অক্ষর)"
                className={`input-field${errors.password ? ' input-error' : ''}`}
                {...register('password', {
                  required: 'পাসওয়ার্ড আবশ্যক',
                  minLength: { value: 6, message: 'পাসওয়ার্ড কমপক্ষে 6 অক্ষর হতে হবে' },
                })}
              />
              {errors.password && <span className="input-error-msg">{errors.password.message}</span>}
            </div>
            <div className="input-group">
              <label className="input-label">পাসওয়ার্ড নিশ্চিত করুন<span className="required">*</span></label>
              <input
                type="password"
                placeholder="পাসওয়ার্ড আবার লিখুন"
                className={`input-field${errors.confirmPassword ? ' input-error' : ''}`}
                {...register('confirmPassword', {
                  required: 'পাসওয়ার্ড নিশ্চিত করুন',
                  validate: v => v === password || 'পাসওয়ার্ড মিলছে না',
                })}
              />
              {errors.confirmPassword && <span className="input-error-msg">{errors.confirmPassword.message}</span>}
            </div>

            {error && <div className="login-error">{error}</div>}

            <Button type="submit" fullWidth disabled={loading}>
              {loading ? 'রেজিস্ট্রেশন হচ্ছে...' : 'রেজিস্ট্রেশন করুন'}
            </Button>
          </form>

          <p className="register-login-link">
            ইতিমধ্যে অ্যাকাউন্ট আছে?{' '}
            <Link to="/login">লগইন করুন</Link>
          </p>
          <Link to="/" className="back-home">← হোমপেজে ফিরুন</Link>
        </div>
      </div>
    </div>
  );
}
