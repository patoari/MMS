const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost/madrasah/backend';

async function request(method, path, body = null, token = null, options = {}) {
  const headers = {};
  
  // Only set Content-Type for non-FormData requests
  if (!(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers,
    body: body instanceof FormData ? body : (body ? JSON.stringify(body) : null),
    ...options
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

const getToken = () => {
  try { 
    const stored = localStorage.getItem('mms_user');
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed?.token || null;
  } catch (error) {
    // Handle corrupted localStorage data
    console.error('Failed to parse stored user data:', error);
    localStorage.removeItem('mms_user');
    return null;
  }
};

const api = {
  get:    (path)         => request('GET',    path, null, getToken()),
  post:   (path, body, options)   => request('POST',   path, body, getToken(), options),
  put:    (path, body, options)   => request('PUT',    path, body, getToken(), options),
  delete: (path)         => request('DELETE', path, null, getToken()),
  // public (no token)
  pub:    (path)         => request('GET',    path, null, null),
};

export default api;
