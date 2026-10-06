/** Previous / next buttons for a paged list. Hidden when everything fits on one page. */
export default function Pager({ page, pageSize, total, onChange }) {
    const pages = Math.max(1, Math.ceil(total / pageSize));
    if (pages <= 1) return null;
    return (
        <div className="no-print" style={{ display: 'flex', justifyContent: 'center', gap: '10px', margin: '1rem 0', alignItems: 'center' }}>
            <button className="btn" disabled={page <= 1} onClick={() => onChange(page - 1)}>السابق</button>
            <span>{page} / {pages}</span>
            <button className="btn" disabled={page >= pages} onClick={() => onChange(page + 1)}>التالي</button>
        </div>
    );
}
