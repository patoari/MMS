import Swal from 'sweetalert2';

const base = {
  confirmButtonColor: 'var(--primary, #6366f1)',
  cancelButtonColor:  '#6b7280',
  customClass: { popup: 'swal-bangla' },
};

export const toast = (icon, title) =>
  Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    customClass: { popup: 'swal-bangla' },
  }).fire({ icon, title });

export const success = (title) =>
  toast('success', title);

export const error = (title, text) =>
  Swal.fire({ ...base, icon: 'error', title: title || 'ত্রুটি', text, confirmButtonText: 'ঠিক আছে' });

export const confirm = (title, text, confirmText = 'হ্যাঁ, মুছুন') =>
  Swal.fire({
    ...base,
    icon: 'warning',
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: 'বাতিল',
    confirmButtonColor: '#ef4444',
  }).then(r => r.isConfirmed);

export const confirmAction = (title, text, confirmText = 'নিশ্চিত করুন') =>
  Swal.fire({
    ...base,
    icon: 'question',
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: 'বাতিল',
  }).then(r => r.isConfirmed);

// Export fire method for custom sweet alert configurations
export const fire = (options) => Swal.fire({ ...base, ...options });

// Export showValidationMessage for form validation
export const showValidationMessage = (message) => Swal.showValidationMessage(message);

export default { success, error, confirm, confirmAction, toast, fire, showValidationMessage };
