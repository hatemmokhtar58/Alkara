const inputStyle = (width) => ({ width, textAlign: 'center', fontWeight: '700', fontSize: '1.1rem', padding: '6px 4px', border: '1px solid var(--border-color)', borderRadius: '4px' });
const labelStyle = { fontSize: '0.7rem', color: 'var(--gray-500)', marginBottom: '3px' };
const slash = <span style={{ fontSize: '1.3rem', color: 'var(--gray-400)', marginTop: '14px' }}>/</span>;

export default function PeriodPicker({ period, value, children }) {
    const { day, setDay, month, setMonth, year, setYear } = value;
    const now = new Date();

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
            {period === 'daily' && (
                <>
                    <div style={{ textAlign: 'center' }}>
                        <div style={labelStyle}>يوم</div>
                        <input type="text" inputMode="numeric" value={day} style={inputStyle('45px')}
                            onChange={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v <= 31) setDay(v); else if (e.target.value === '') setDay(''); }}
                            onBlur={() => { if (!day) setDay(now.getDate()); }} />
                    </div>
                    {slash}
                </>
            )}
            {period !== 'yearly' && (
                <>
                    <div style={{ textAlign: 'center' }}>
                        <div style={labelStyle}>شهر</div>
                        <input type="text" inputMode="numeric" value={month} style={inputStyle('45px')}
                            onChange={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v <= 12) setMonth(v); else if (e.target.value === '') setMonth(''); }}
                            onBlur={() => { if (!month) setMonth(now.getMonth() + 1); }} />
                    </div>
                    {slash}
                </>
            )}
            <div style={{ textAlign: 'center' }}>
                <div style={labelStyle}>سنة</div>
                <input type="text" inputMode="numeric" value={year} style={inputStyle('60px')}
                    onChange={(e) => { const v = parseInt(e.target.value); if (v > 0) setYear(v); else if (e.target.value === '') setYear(''); }}
                    onBlur={() => { if (!year) setYear(now.getFullYear()); }} />
            </div>
            {children}
        </div>
    );
}
