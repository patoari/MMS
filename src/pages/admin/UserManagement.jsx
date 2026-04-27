import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import swal from '../../utils/swal';
import Pagination from '../../components/Pagination';
import Loader from '../../components/Loader';
import './TeacherList.css';

const ROLES = ['visitor', 'teacher', 'class_teacher', 'admin', 'accountant'];
const ROLE_LABELS = {
  visitor:       'ভিজিটর',
  teacher:       'শিক্ষক',
  class_teacher: 'ক্লাস শিক্ষক',
  admin:         'প্রশাসক',
  accountant:    'হিসাবরক্ষক',
};
const PER_PAGE = 10;

export default function UserManagement() {
  const { user: me } = useAuth();
  const [users, setUsers]               = useState([]);
  const [classes, setClasses]           = useState([]);
  const [search, setSearch]             = useState('');
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState({});
  const [pendingChanges, setPendingChanges] = useState({}); // Track all pending changes
  const [page, setPage]                 = useState(1);

  useEffect(() => {
    Promise.all([api.get('/users'), api.get('/classes')])
      .then(([uRes, cRes]) => {
        setUsers(Array.isArray(uRes.data) ? uRes.data : []);
        setClasses(Array.isArray(cRes.data) ? cRes.data : []);
      })
      .catch(() => swal.error('ডেটা লোড ব্যর্থ হয়েছে।'))
      .finally(() => setLoading(false));
  }, []);

  // Admins always pinned at top (own row first), rest filtered + paginated
  const adminRows = useMemo(() =>
    users.filter(u => u.role === 'admin').sort((a, b) => a.id === me?.id ? -1 : b.id === me?.id ? 1 : 0),
  [users, me]);

  const filteredRest = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter(u =>
      u.role !== 'admin' &&
      (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    );
  }, [users, search]);

  const handleRoleChange = (userId, role) => {
    setPendingChanges(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        role,
        class_id: role === 'class_teacher' ? (prev[userId]?.class_id || '') : null
      }
    }));
  };

  const handleClassChange = (userId, classId) => {
    setPendingChanges(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        class_id: classId
      }
    }));
  };

  const handleSaveChanges = async (userId) => {
    const changes = pendingChanges[userId];
    if (!changes) return;

    const user = users.find(u => u.id === userId);
    const newRole = changes.role !== undefined ? changes.role : user.role;
    const newClassId = changes.class_id !== undefined ? changes.class_id : user.class_id;

    // Validation
    if (newRole === 'class_teacher' && !newClassId) {
      swal.error('ক্লাস শিক্ষকের জন্য শ্রেণি নির্বাচন করুন');
      return;
    }

    setSaving(s => ({ ...s, [userId]: true }));
    try {
      const body = { role: newRole };
      if (newRole === 'class_teacher') body.class_id = parseInt(newClassId);
      
      const res = await api.put(`/users/${userId}/role`, body);
      const updated = res.data ?? res;
      
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updated } : u));
      setPendingChanges(prev => {
        const newChanges = { ...prev };
        delete newChanges[userId];
        return newChanges;
      });
      
      swal.success('ভূমিকা আপডেট হয়েছে।');
    } catch (err) {
      swal.error(err.message || 'আপডেট ব্যর্থ হয়েছে।');
      // Refresh users to get current state
      api.get('/users').then(r => setUsers(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    } finally {
      setSaving(s => ({ ...s, [userId]: false }));
    }
  };

  const handleCancelChanges = (userId) => {
    setPendingChanges(prev => {
      const newChanges = { ...prev };
      delete newChanges[userId];
      return newChanges;
    });
  };

  const handleDeleteUser = async (userId) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    // Only allow deleting visitors
    if (user.role !== 'visitor') {
      swal.error('শুধুমাত্র ভিজিটর ব্যবহারকারীদের মুছে ফেলা যাবে। অন্য ভূমিকার জন্য প্রথমে ভিজিটরে পরিবর্তন করুন।');
      return;
    }

    const confirmed = await swal.confirm(
      `আপনি কি নিশ্চিত যে "${user.name}" কে মুছে ফেলতে চান?`,
      'এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না।'
    );

    if (!confirmed) return;

    setSaving(s => ({ ...s, [userId]: true }));
    try {
      await api.delete(`/users/${userId}`);
      setUsers(prev => prev.filter(u => u.id !== userId));
      swal.success('ব্যবহারকারী মুছে ফেলা হয়েছে।');
    } catch (err) {
      swal.error(err.message || 'মুছে ফেলা ব্যর্থ হয়েছে।');
    } finally {
      setSaving(s => ({ ...s, [userId]: false }));
    }
  };

  const handleResetPassword = async (userId) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    const result = await swal.fire({
      title: 'পাসওয়ার্ড রিসেট করুন',
      html: `
        <p style="margin-bottom: 16px; color: var(--text-muted);">
          <strong>${user.name}</strong> এর জন্য নতুন পাসওয়ার্ড লিখুন
        </p>
        <input 
          type="password" 
          id="newPassword" 
          class="swal2-input" 
          placeholder="নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)"
          style="width: 85%; margin: 0 auto;"
        />
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'রিসেট করুন',
      cancelButtonText: 'বাতিল',
      preConfirm: () => {
        const password = document.getElementById('newPassword').value;
        if (!password) {
          swal.showValidationMessage('পাসওয়ার্ড লিখুন');
          return false;
        }
        if (password.length < 6) {
          swal.showValidationMessage('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে');
          return false;
        }
        return password;
      }
    });

    if (!result.isConfirmed || !result.value) return;

    setSaving(s => ({ ...s, [userId]: true }));
    try {
      await api.put(`/users/${userId}/reset-password`, { password: result.value });
      swal.fire({
        icon: 'success',
        title: 'সফল!',
        text: `${user.name} এর পাসওয়ার্ড সফলভাবে রিসেট করা হয়েছে।`,
        timer: 2500,
        showConfirmButton: false
      });
    } catch (err) {
      swal.error(err.message || 'পাসওয়ার্ড রিসেট ব্যর্থ হয়েছে।');
    } finally {
      setSaving(s => ({ ...s, [userId]: false }));
    }
  };

  const hasPendingChanges = (userId) => {
    const changes = pendingChanges[userId];
    if (!changes) return false;
    
    const user = users.find(u => u.id === userId);
    if (!user) return false;
    
    return (changes.role !== undefined && changes.role !== user.role) ||
           (changes.class_id !== undefined && String(changes.class_id) !== String(user.class_id || ''));
  };

  const takenClassIds = (userId) =>
    new Set(users.filter(u => u.role === 'class_teacher' && u.class_id && u.id !== userId).map(u => String(u.class_id)));

  if (loading) return <Loader />;

  const classOptions = classes.map(c => ({ value: c.id, label: c.name }));
  const pagedRest    = filteredRest.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const renderClassCell = (u) => {
    const changes = pendingChanges[u.id];
    const currentRole = changes?.role !== undefined ? changes.role : u.role;
    const currentClassId = changes?.class_id !== undefined ? changes.class_id : (u.class_id || '');
    
    if (currentRole !== 'class_teacher') {
      return <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>;
    }
    
    return (
      <select
        value={currentClassId}
        onChange={e => handleClassChange(u.id, e.target.value)}
        style={selectStyle}
        disabled={!!saving[u.id]}
      >
        <option value="">শ্রেণি নির্বাচন করুন</option>
        {classOptions.map(c => {
          const taken = takenClassIds(u.id).has(String(c.value));
          return (
            <option key={c.value} value={c.value} disabled={taken}>
              {c.label}{taken ? ' (নির্ধারিত)' : ''}
            </option>
          );
        })}
      </select>
    );
  };

  const renderRow = (u, index, isAdmin) => {
    const isSelf    = u.id === me?.id;
    const isLocked  = isSelf;
    const changes = pendingChanges[u.id];
    const currentRole = changes?.role !== undefined ? changes.role : u.role;
    const hasChanges = hasPendingChanges(u.id);

    return (
      <tr key={u.id} style={{ borderBottom: '1px solid var(--border)', background: isAdmin ? 'rgba(99,102,241,0.04)' : hasChanges ? 'rgba(251, 191, 36, 0.05)' : undefined }}>
        <td style={td}>
          {isAdmin && <span style={{ fontSize: '0.7rem', background: 'var(--primary)', color: '#fff', borderRadius: 4, padding: '2px 6px', marginRight: 6 }}>A</span>}
          {!isAdmin && index + 1}
        </td>
        <td style={{ ...td, fontWeight: isSelf ? 700 : 400 }}>
          {u.name}{isSelf && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 6 }}>(আপনি)</span>}
        </td>
        <td style={td}>{u.email}</td>
        <td style={td}>
          {isLocked ? (
            <span style={{ ...selectStyle, display: 'inline-block', background: 'var(--bg)', color: 'var(--text-muted)', cursor: 'default' }}>
              {ROLE_LABELS[u.role]}
            </span>
          ) : (
            <select
              value={currentRole}
              disabled={!!saving[u.id]}
              onChange={e => handleRoleChange(u.id, e.target.value)}
              style={selectStyle}
            >
              {ROLES.map(r => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          )}
        </td>
        <td style={td}>
          {isLocked ? (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
          ) : (
            renderClassCell(u)
          )}
        </td>
        <td style={td}>
          {!isLocked && hasChanges && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                onClick={() => handleSaveChanges(u.id)} 
                disabled={!!saving[u.id]} 
                style={saveBtnStyle}
              >
                {saving[u.id] ? '...' : 'সংরক্ষণ'}
              </button>
              <button 
                onClick={() => handleCancelChanges(u.id)} 
                disabled={!!saving[u.id]} 
                style={cancelBtnStyle}
              >
                বাতিল
              </button>
            </div>
          )}
          {!isLocked && !hasChanges && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                onClick={() => handleResetPassword(u.id)} 
                disabled={!!saving[u.id]} 
                style={resetPasswordBtnStyle}
                title="পাসওয়ার্ড রিসেট করুন"
              >
                {saving[u.id] ? '...' : '🔑 পাসওয়ার্ড'}
              </button>
              {u.role === 'visitor' && (
                <button 
                  onClick={() => handleDeleteUser(u.id)} 
                  disabled={!!saving[u.id]} 
                  style={deleteBtnStyle}
                  title="ব্যবহারকারী মুছে ফেলুন"
                >
                  {saving[u.id] ? '...' : '🗑️ মুছুন'}
                </button>
              )}
            </div>
          )}
          {isLocked && (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="teacher-page">
      <div className="teacher-header">
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary)' }}>ব্যবহারকারী ব্যবস্থাপনা</h2>
        <input
          className="teacher-search-input"
          placeholder="নাম বা ইমেইল দিয়ে খুঁজুন..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      <div style={{ overflowX: 'auto', background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
              <th style={th}>#</th>
              <th style={th}>নাম</th>
              <th style={th}>ইমেইল</th>
              <th style={th}>ভূমিকা</th>
              <th style={th}>নির্ধারিত শ্রেণি</th>
              <th style={th}>কার্যক্রম</th>
            </tr>
          </thead>
          <tbody>
            {/* Pinned admin rows — always visible, not affected by search/pagination */}
            {adminRows.map(u => renderRow(u, 0, true))}

            {/* Divider if both sections have rows */}
            {adminRows.length > 0 && filteredRest.length > 0 && (
              <tr><td colSpan={6} style={{ padding: 0, borderBottom: '2px dashed var(--border)' }} /></tr>
            )}

            {/* Paginated non-admin rows */}
            {pagedRest.length === 0 && filteredRest.length === 0 && adminRows.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>কোনো ব্যবহারকারী পাওয়া যায়নি।</td></tr>
            ) : pagedRest.map((u, i) => renderRow(u, (page - 1) * PER_PAGE + i, false))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} total={filteredRest.length} perPage={PER_PAGE} onChange={setPage} />
    </div>
  );
}

const th = { padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' };
const td = { padding: '12px 16px', color: 'var(--text)' };
const selectStyle = { padding: '6px 10px', borderRadius: 8, border: '1.5px solid var(--border)', fontFamily: 'inherit', fontSize: '0.875rem', background: 'var(--card-bg)', cursor: 'pointer' };
const saveBtnStyle = { 
  padding: '6px 16px', 
  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
  color: '#fff', 
  border: 'none', 
  borderRadius: 8, 
  cursor: 'pointer', 
  fontSize: '0.8rem', 
  fontFamily: 'inherit',
  fontWeight: 600,
  transition: 'all 0.3s',
  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
};
const cancelBtnStyle = { 
  padding: '6px 16px', 
  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', 
  color: '#fff', 
  border: 'none', 
  borderRadius: 8, 
  cursor: 'pointer', 
  fontSize: '0.8rem', 
  fontFamily: 'inherit',
  fontWeight: 600,
  transition: 'all 0.3s',
  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)'
};
const deleteBtnStyle = { 
  padding: '6px 16px', 
  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', 
  color: '#fff', 
  border: 'none', 
  borderRadius: 8, 
  cursor: 'pointer', 
  fontSize: '0.8rem', 
  fontFamily: 'inherit',
  fontWeight: 600,
  transition: 'all 0.3s',
  boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)'
};
const resetPasswordBtnStyle = { 
  padding: '6px 16px', 
  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', 
  color: '#fff', 
  border: 'none', 
  borderRadius: 8, 
  cursor: 'pointer', 
  fontSize: '0.8rem', 
  fontFamily: 'inherit',
  fontWeight: 600,
  transition: 'all 0.3s',
  boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)'
};
