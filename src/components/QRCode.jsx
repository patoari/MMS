import { useEffect, useRef } from 'react';

// Simple QR Code generator using canvas
export default function QRCode({ value, size = 128 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;

    // Use a QR code API to generate the image
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Create QR code using Google Charts API
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`;
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
    };
    img.onerror = () => {
      // Fallback: draw a simple placeholder
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#666';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('QR Code', size / 2, size / 2);
    };
    img.src = qrUrl;
  }, [value, size]);

  return (
    <canvas 
      ref={canvasRef} 
      width={size} 
      height={size}
      style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
    />
  );
}
