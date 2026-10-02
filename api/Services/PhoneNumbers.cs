using System.Text;

namespace api.Services
{
    public static class PhoneNumbers
    {
        /// <summary>
        /// Returns a Saudi mobile number as 05XXXXXXXX, or null if it is not one.
        /// Accepts 05..., 5..., 9665..., +9665..., 009665..., with spaces or dashes and Arabic digits.
        /// </summary>
        public static string? NormalizeSaudiMobile(string? input)
        {
            if (string.IsNullOrWhiteSpace(input)) return null;

            var digits = new StringBuilder();
            foreach (var ch in input.Trim())
            {
                if (char.IsDigit(ch)) digits.Append((int)char.GetNumericValue(ch));
                else if (ch is ' ' or '-' or '(' or ')' or '+') continue;
                else return null;
            }

            var number = digits.ToString();
            if (number.StartsWith("00966")) number = number[5..];
            else if (number.StartsWith("966")) number = number[3..];
            if (number.StartsWith("05")) number = number[1..];

            return number.Length == 9 && number[0] == '5' ? "0" + number : null;
        }

        /// <summary>Plates are compared and stored trimmed, upper case, with single spaces.</summary>
        public static string NormalizePlate(string? input) =>
            string.Join(' ', (input ?? string.Empty).Trim().ToUpperInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }
}
