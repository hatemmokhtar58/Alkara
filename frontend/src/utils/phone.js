// Same rules as the API's PhoneNumbers.NormalizeSaudiMobile: returns 05XXXXXXXX or null.
export function normalizeSaudiMobile(input) {
    if (!input) return null;
    const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
    let digits = '';
    for (const ch of String(input).trim()) {
        const arabic = arabicDigits.indexOf(ch);
        if (arabic >= 0) digits += arabic;
        else if (ch >= '0' && ch <= '9') digits += ch;
        else if (!' -()+'.includes(ch)) return null;
    }
    if (digits.startsWith('00966')) digits = digits.slice(5);
    else if (digits.startsWith('966')) digits = digits.slice(3);
    if (digits.startsWith('05')) digits = digits.slice(1);
    return digits.length === 9 && digits[0] === '5' ? '0' + digits : null;
}
