import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api';
import PremiumSelect from '../components/PremiumSelect';

export default function Salaries() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const fetchSalaries = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/Salaries?month=${month}&year=${year}`);
      setData(res.data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => { fetchSalaries(); }, [month, year]);

  const monthNames = {
    ar: ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'],
    en: ['January','February','March','April','May','June','July','August','September','October','November','December']
  };

  const lang = t('Sidebar.Dashboard') === 'لوحة التحكم' ? 'ar' : 'en';
  const currency = t('Dashboard.Currency');

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>{t('Salaries.Title')}</h2>
        <p className="page-subtitle">{t('Salaries.Subtitle')}</p>
      </div>

      {/* Month/Year Selector */}
      <div className="salaries-filter-bar">
        <div className="salaries-filter-group">
          <label>{t('Salaries.Month')}</label>
          <div style={{minWidth: '180px'}}>
            <PremiumSelect
              options={monthNames[lang].map((name, i) => ({ value: i + 1, label: name }))}
              value={month}
              onChange={val => setMonth(Number(val))}
              placeholder={t('Salaries.Month')}
            />
          </div>
        </div>
        <div className="salaries-filter-group">
          <label>{t('Salaries.Year')}</label>
          <div style={{minWidth: '140px'}}>
            <PremiumSelect
              options={[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => ({ value: y, label: String(y) }))}
              value={year}
              onChange={val => setYear(Number(val))}
              placeholder={t('Salaries.Year')}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-spinner">{t('Common.Loading')}</div>
      ) : !data || data.drivers.length === 0 ? (
        <div className="empty-state">{t('Salaries.Empty')}</div>
      ) : (
        <>
          {/* Drivers Table */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('Salaries.Driver')}</th>
                  <th>{t('Salaries.TotalIncome')}</th>
                  <th>{t('Salaries.TotalExpenses')}</th>
                  <th>{t('Salaries.NetIncome')}</th>
                  <th>{t('Salaries.Percentage')}</th>
                  <th>{t('Salaries.Salary')}</th>
                </tr>
              </thead>
              <tbody>
                {data.drivers.map((d, i) => (
                  <tr key={d.driverId} className={d.salary > 0 ? '' : 'row-muted'}>
                    <td>{i + 1}</td>
                    <td className="driver-name-cell">{d.driverName}</td>
                    <td className="amount-cell income">{d.totalIncome.toFixed(2)}</td>
                    <td className="amount-cell expense">{d.totalExpenses.toFixed(2)}</td>
                    <td className={`amount-cell ${d.netIncome >= 0 ? 'income' : 'expense'}`}>
                      {d.netIncome.toFixed(2)}
                    </td>
                    <td><span className="percentage-badge">{d.salaryPercentage}%</span></td>
                    <td className="amount-cell salary-amount">{d.salary.toFixed(2)} {currency}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="totals-row">
                  <td colSpan="2"><strong>{t('Salaries.Totals')}</strong></td>
                  <td className="amount-cell income"><strong>{data.drivers.reduce((s, d) => s + d.totalIncome, 0).toFixed(2)}</strong></td>
                  <td className="amount-cell expense"><strong>{data.drivers.reduce((s, d) => s + d.totalExpenses, 0).toFixed(2)}</strong></td>
                  <td className="amount-cell"><strong>{data.drivers.reduce((s, d) => s + d.netIncome, 0).toFixed(2)}</strong></td>
                  <td></td>
                  <td className="amount-cell salary-amount"><strong>{data.totalSalaries.toFixed(2)} {currency}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
