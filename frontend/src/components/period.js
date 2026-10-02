import { useState } from 'react';

/** Day / month / year inputs for daily, monthly and yearly reports. */
export function usePeriod() {
    const now = new Date();
    const [day, setDay] = useState(now.getDate());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    return { day, setDay, month, setMonth, year, setYear };
}

/** Query string for /Reports endpoints, or null while an input is empty. */
export function periodQuery(period, { day, month, year }) {
    if (!year || (period !== 'yearly' && !month) || (period === 'daily' && !day)) return null;
    const params = new URLSearchParams({ period, year });
    if (period !== 'yearly') params.set('month', month);
    if (period === 'daily') params.set('day', day);
    return params.toString();
}
