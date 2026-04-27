import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const SiteSettingsContext = createContext(null);

const defaultSettings = {
  siteName:     'ধামালকোট মোহাম্মাদীয়া মাদ্রাসা',
  siteNameEn:   'DHAMALAKOT MOHAMMADIA MADRASA',
  siteNameAr:   'مدرسة محمدية ضامالكوت',
  siteSubtitle: 'ব্যবস্থাপনা সিস্টেম',
  logoEmoji:    '🕌',
  logoUrl:      '',
  address:      '123, ইসলামপুর রোড, ঢাকা-1200',
  phone:        '017XX-XXXXXX',
  email:        'info@alnoor-madrasah.edu.bd',
  officeHours:  'শনি – বৃহস্পতি: সকাল 8টা – বিকাল 4টা',
  facebook:     '#',
  youtube:      '#',
  twitter:      '#',
  aboutText:    'ইলম ও আমলের সমন্বয়ে আদর্শ মুসলিম প্রজন্ম গড়ে তোলার লক্ষ্যে আমরা নিরলসভাবে কাজ করে যাচ্ছি।',
  footerCopy:   '© 2024 ধামালকোট মোহাম্মাদীয়া মাদ্রাসা। সর্বস্বত্ব সংরক্ষিত।',
  hadithArabic: 'طَلَبُ الْعِلْمِ فَرِيضَةٌ عَلَى كُلِّ مُسْلِمٍ',
  hadithBangla: 'জ্ঞান অর্জন করা প্রতিটি মুসলমানের উপর ফরজ।',
  hadithSource: 'ইবনে মাজাহ',
  quranArabic:  'اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ',
  quranBangla:  'পড়ো তোমার প্রভুর নামে, যিনি সৃষ্টি করেছেন।',
  quranSource:  'সূরা আলাক, আয়াত 1',
  // ID Card Backside Settings
  idCardRules:  'এই কার্ডটি সর্বদা সাথে রাখতে হবে। হারিয়ে গেলে অবিলম্বে জানাতে হবে। অন্যকে ব্যবহার করতে দেওয়া যাবে না। ক্ষতিগ্রস্ত হলে নতুন কার্ড নিতে হবে।',
  idCardFooterText: 'ইলম ও আমলের সমন্বয়ে আদর্শ মুসলিম প্রজন্ম গড়ে তোলার লক্ষ্যে',
  idCardBackFooter1: 'এই কার্ডটি {siteName} এর সম্পত্তি',
  idCardBackFooter2: 'পাওয়া গেলে উপরের ঠিকানায় ফেরত দিন',
};

export function SiteSettingsProvider({ children }) {
  const [settings, setSettings]         = useState(defaultSettings);
  const [features, setFeatures]         = useState([]);
  const [featuresLoading, setFeaturesLoading] = useState(true);
  const [featuresError, setFeaturesError]     = useState(null);
  const [homepageTeachers, setHomepageTeachers] = useState([]);

  // Load site settings from backend
  useEffect(() => {
    api.pub('/settings')
      .then(res => {
        if (res.data && typeof res.data === 'object') {
          const patch = { ...res.data };
          if (!patch.logoUrl || typeof patch.logoUrl !== 'string') patch.logoUrl = '';
          setSettings(s => ({ ...s, ...patch }));
        }
      })
      .catch(() => {});
  }, []);

  // Load features from backend — no mock fallback
  const loadFeatures = useCallback(() => {
    setFeaturesLoading(true);
    setFeaturesError(null);
    api.pub('/site-features')
      .then(res => {
        setFeatures(Array.isArray(res.data) ? res.data : []);
        setFeaturesLoading(false);
      })
      .catch(err => {
        setFeaturesError('ফিচার লোড করা যায়নি। ব্যাকএন্ড সংযোগ পরীক্ষা করুন।');
        setFeatures([]);
        setFeaturesLoading(false);
      });
  }, []);

  useEffect(() => { loadFeatures(); }, [loadFeatures]);

  // Homepage teachers
  const loadHomepageTeachers = useCallback(() => {
    api.pub('/homepage-teachers')
      .then(res => setHomepageTeachers(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, []);
  useEffect(() => { loadHomepageTeachers(); }, [loadHomepageTeachers]);

  const addHomepageTeacher    = async (data) => { await api.post('/homepage-teachers', data); loadHomepageTeachers(); };
  const updateHomepageTeacher = async (id, data) => { await api.put(`/homepage-teachers/${id}`, data); loadHomepageTeachers(); };
  const deleteHomepageTeacher = async (id) => { await api.delete(`/homepage-teachers/${id}`); loadHomepageTeachers(); };
  const toggleHomepageTeacher = async (id) => {
    const t = homepageTeachers.find(x => x.id === id);
    if (t) { await api.put(`/homepage-teachers/${id}`, { is_active: t.is_active ? 0 : 1 }); loadHomepageTeachers(); }
  };

  const updateSettings = async (patch) => {
    setSettings(prev => ({ ...prev, ...patch }));
    try { await api.put('/settings', patch); }
    catch (e) { /* Settings save failed - will retry on next change */ }
  };

  const resetSettings = async () => {
    setSettings(defaultSettings);
    try { await api.put('/settings', defaultSettings); }
    catch {}
  };

  // Feature CRUD — all hit the backend, then reload
  const addFeature = async (feature) => {
    await api.post('/site-features', { ...feature, sort_order: features.length + 1, is_active: 1 });
    loadFeatures();
  };

  const updateFeature = async (id, patch) => {
    await api.put(`/site-features/${id}`, patch);
    loadFeatures();
  };

  const deleteFeature = async (id) => {
    await api.delete(`/site-features/${id}`);
    loadFeatures();
  };

  const toggleFeature = async (id) => {
    const f = features.find(x => x.id === id);
    if (!f) return;
    await api.put(`/site-features/${id}`, { is_active: f.is_active ? 0 : 1 });
    loadFeatures();
  };

  const activeFeatures = features
    .filter(f => Number(f.is_active) === 1)
    .sort((a, b) => a.sort_order - b.sort_order);

  return (
    <SiteSettingsContext.Provider value={{
      settings, updateSettings, resetSettings,
      features, activeFeatures,
      featuresLoading, featuresError,
      addFeature, updateFeature, deleteFeature, toggleFeature,
      homepageTeachers,
      addHomepageTeacher, updateHomepageTeacher, deleteHomepageTeacher, toggleHomepageTeacher,
    }}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export const useSiteSettings = () => useContext(SiteSettingsContext);
