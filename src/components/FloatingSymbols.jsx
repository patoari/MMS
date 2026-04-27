import './FloatingSymbols.css';

const SYMBOLS = ['☪', '★', '✦', 'ﷲ', '☽', '✶', 'ﷺ', '❋', '☆', '۞'];

// Pre-defined positions so it's deterministic (no hydration mismatch)
const ITEMS = [
  { s: '☪',  x: 5,  d: 14, size: 2.4, delay: 0    },
  { s: '★',  x: 12, d: 18, size: 1.8, delay: 1.5  },
  { s: 'ﷲ', x: 20, d: 22, size: 2.0, delay: 3    },
  { s: '☽',  x: 28, d: 16, size: 2.6, delay: 0.8  },
  { s: '✦',  x: 35, d: 20, size: 1.6, delay: 4    },
  { s: '☪',  x: 42, d: 25, size: 2.0, delay: 2    },
  { s: 'ﷺ', x: 50, d: 19, size: 1.8, delay: 5    },
  { s: '★',  x: 58, d: 15, size: 2.2, delay: 1    },
  { s: '❋',  x: 65, d: 23, size: 1.6, delay: 3.5  },
  { s: '☽',  x: 72, d: 17, size: 2.4, delay: 0.3  },
  { s: '✶',  x: 80, d: 21, size: 1.8, delay: 2.7  },
  { s: '۞',  x: 88, d: 26, size: 2.0, delay: 4.5  },
  { s: '☆',  x: 93, d: 13, size: 1.6, delay: 1.8  },
  { s: 'ﷲ', x: 8,  d: 28, size: 1.6, delay: 6    },
  { s: '✦',  x: 47, d: 12, size: 2.2, delay: 2.2  },
  { s: '☪',  x: 75, d: 24, size: 2.0, delay: 3.8  },
];

export default function FloatingSymbols() {
  return (
    <div className="floating-symbols" aria-hidden="true">
      {ITEMS.map((item, i) => (
        <span
          key={i}
          className="fs-bubble"
          style={{
            left:              `${item.x}%`,
            fontSize:          `${item.size}rem`,
            animationDuration: `${item.d}s`,
            animationDelay:    `${item.delay}s`,
          }}
        >
          {item.s}
        </span>
      ))}
    </div>
  );
}
