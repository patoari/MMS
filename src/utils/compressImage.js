/**
 * Compress an image File to under maxKB using Canvas.
 * Tries progressively lower quality until size is within limit.
 * Returns a new File with the same name.
 */
export async function compressImage(file, maxKB = 500) {
  // Non-image or already small enough — return as-is
  if (!file.type.startsWith('image/')) return file;
  if (file.size <= maxKB * 1024) return file;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Max dimension: 1600px on longest side
      const MAX_DIM = 1600;
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width >= height) { height = Math.round((height / width) * MAX_DIM); width = MAX_DIM; }
        else                 { width  = Math.round((width / height) * MAX_DIM); height = MAX_DIM; }
      }

      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Try quality from 0.85 down to 0.30 until under maxKB
      const outputType = file.type === 'image/png' ? 'image/jpeg' : file.type;
      let quality = 0.85;
      const attempt = () => {
        canvas.toBlob(blob => {
          if (!blob) { reject(new Error('Compression failed')); return; }
          if (blob.size <= maxKB * 1024 || quality <= 0.30) {
            const ext  = outputType === 'image/jpeg' ? 'jpg' : 'png';
            const name = file.name.replace(/\.[^.]+$/, '') + '.' + ext;
            resolve(new File([blob], name, { type: outputType }));
          } else {
            quality = Math.max(quality - 0.10, 0.30);
            attempt();
          }
        }, outputType, quality);
      };
      attempt();
    };

    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}
