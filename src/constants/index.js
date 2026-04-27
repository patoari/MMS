// Status variant mappings for badges
export const statusVariant = {
  'পরিশোধিত': 'success',
  'আংশিক': 'warning',
  'বকেয়া': 'danger',
  'অগ্রিম': 'info'
};

// Grade variant mappings for badges
export const gradeVariant = (grade) => {
  const variants = {
    'A+': 'success',
    'A': 'primary',
    'A-': 'info'
  };
  return variants[grade] || 'warning';
};
