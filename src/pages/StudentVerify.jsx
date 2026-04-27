import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { useSiteSettings } from '../context/SiteSettingsContext';
import Loader from '../components/Loader';
import Badge from '../components/Badge';
import { FiCheckCircle, FiXCircle, FiUser, FiPhone, FiMapPin } from 'react-icons/fi';
import './StudentVerify.css';

export default function StudentVerify() {
  const [searchParams] = useSearchParams();
  const studentId = searchParams.get('id');
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { settings } = useSiteSettings();

  useEffect(() => {
    if (!studentId) {
      setError(true);
      setLoading(false);
      return;
    }

    // Try to fetch student by ID using the search endpoint
    api.get(`/students?search=${studentId}`)
      .then(res => {
        if (res.data && Array.isArray(res.data)) {
          // Find exact match
          const student = res.data.find(s => s.id === studentId);
          if (student) {
            setStudent(student);
          } else {
            setError(true);
          }
        } else if (res.data && res.data.id === studentId) {
          // Direct object response
          setStudent(res.data);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) {
    return (
      <div className="student-verify-page">
        <div className="verify-container">
          <Loader />
        </div>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="student-verify-page">
        <div className="verify-container">
          <div className="verify-error">
            <FiXCircle size={64} color="#dc2626" />
            <h2>শিক্ষার্থী খুঁজে পাওয়া যায়নি</h2>
            <p>এই আইডি দিয়ে কোনো শিক্ষার্থী পাওয়া যায়নি। আইডি সঠিক কিনা যাচাই করুন।</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="student-verify-page">
      <div className="verify-container">
        <div className="verify-header">
          <div className="verify-logo">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" />
            ) : (
              <span>{settings.logoEmoji || '🕌'}</span>
            )}
          </div>
          <div>
            <h1>{settings.siteName || 'মাদ্রাসা'}</h1>
            <p>শিক্ষার্থী যাচাইকরণ</p>
          </div>
        </div>

        <div className="verify-success">
          <FiCheckCircle size={48} color="#16a34a" />
          <h2>যাচাইকৃত শিক্ষার্থী</h2>
        </div>

        <div className="verify-card">
          <div className="verify-photo">
            {student.photo ? (
              <img src={student.photo} alt={student.name} />
            ) : (
              <div className="verify-photo-placeholder">
                <FiUser size={48} />
              </div>
            )}
          </div>

          <div className="verify-info">
            <div className="verify-name">{student.name}</div>
            <div className="verify-id">{student.id}</div>

            <div className="verify-details">
              <div className="verify-detail-row">
                <span className="verify-label">শ্রেণি:</span>
                <span className="verify-value">{student.class}</span>
              </div>
              <div className="verify-detail-row">
                <span className="verify-label">রোল:</span>
                <span className="verify-value">{student.roll}</span>
              </div>
              <div className="verify-detail-row">
                <span className="verify-label">সেকশন:</span>
                <span className="verify-value">{student.section}</span>
              </div>
              <div className="verify-detail-row">
                <span className="verify-label">অবস্থা:</span>
                <Badge variant={student.status === 'সক্রিয়' ? 'success' : 'default'}>
                  {student.status}
                </Badge>
              </div>
            </div>

            <div className="verify-guardian">
              <div className="verify-guardian-title">
                <FiUser size={16} />
                <span>অভিভাবকের তথ্য</span>
              </div>
              <div className="verify-detail-row">
                <span className="verify-label">পিতা:</span>
                <span className="verify-value">{student.father_name_bn || student.guardian}</span>
              </div>
              {student.mother_name_bn && (
                <div className="verify-detail-row">
                  <span className="verify-label">মাতা:</span>
                  <span className="verify-value">{student.mother_name_bn}</span>
                </div>
              )}
              <div className="verify-detail-row">
                <FiPhone size={14} />
                <span className="verify-value">{student.phone}</span>
              </div>
              <div className="verify-detail-row">
                <FiMapPin size={14} />
                <span className="verify-value">{student.address}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="verify-footer">
          <p>এই তথ্য {settings.siteName || 'মাদ্রাসা'} কর্তৃক যাচাইকৃত</p>
          <p className="verify-timestamp">যাচাই করা হয়েছে: {new Date().toLocaleString('en-GB')}</p>
        </div>
      </div>
    </div>
  );
}
