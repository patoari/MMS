import './Pagination.css';

export default function Pagination({ page, total, perPage, onChange }) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  if (totalPages <= 1) return null;

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…');
    }
  }

  return (
    <div className="pagination">
      <span className="pagination-info">
        {Math.min((page - 1) * perPage + 1, total)}–{Math.min(page * perPage, total)} / {total} টি
      </span>
      <div className="pagination-controls">
        <button className="pg-btn" onClick={() => onChange(1)}        disabled={page === 1}>«</button>
        <button className="pg-btn" onClick={() => onChange(page - 1)} disabled={page === 1}>‹</button>
        {pages.map((p, i) =>
          p === '…'
            ? <span key={`e${i}`} className="pg-ellipsis">…</span>
            : <button key={p} className={`pg-btn${p === page ? ' active' : ''}`} onClick={() => onChange(p)}>{p}</button>
        )}
        <button className="pg-btn" onClick={() => onChange(page + 1)} disabled={page === totalPages}>›</button>
        <button className="pg-btn" onClick={() => onChange(totalPages)} disabled={page === totalPages}>»</button>
      </div>
    </div>
  );
}
