import { useEffect, useRef, useState } from 'react';
import './HeroCarousel.css';

export default function HeroCarousel({ images }) {
  const total = images?.length || 0;
  const angleStep = total > 0 ? 360 / total : 0;
  const rotationRef = useRef(0);
  const rafRef = useRef(null);
  const [active, setActive] = useState(0);

  const getRadius = () => {
    if (window.innerWidth <= 600) return 160;
    if (window.innerWidth <= 900) return 210;
    return 300;
  };

  useEffect(() => {
    if (total === 0) return;
    const track = document.getElementById('carousel-track');
    if (!track) return;

    let last = performance.now();

    const animate = (now) => {
      const delta = now - last;
      last = now;
      rotationRef.current -= delta * 0.018;
      track.style.transform = `rotateY(${rotationRef.current}deg)`;

      // update card positions with responsive radius
      const r = getRadius();
      Array.from(track.children).forEach((card, i) => {
        const angle = angleStep * i;
        card.style.transform = `rotateY(${angle}deg) translateZ(${r}px)`;
      });

      // figure out which card is most "front-facing"
      const norm = ((rotationRef.current % 360) + 360) % 360;
      const idx = Math.round((360 - norm) / angleStep) % total;
      setActive(idx);

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [total, angleStep]);

  if (total === 0) return null;
  return (
    <div className="hero-carousel-scene">
      <div className="carousel-track" id="carousel-track">
        {images.map((img, i) => {
          return (
            <div
              key={img.id}
              className={`carousel-card${active === i ? ' carousel-card-active' : ''}`}
            >
              <img
                src={img.url}
                alt={img.caption}
                className="carousel-img"
                onError={e => {
                  e.target.src = `https://picsum.photos/seed/${img.id}/600/800`;
                }}
              />
              <div className="carousel-caption">{img.caption}</div>
            </div>
          );
        })}
      </div>
      {/* Reflection */}
      <div className="carousel-ground" />
    </div>
  );
}
