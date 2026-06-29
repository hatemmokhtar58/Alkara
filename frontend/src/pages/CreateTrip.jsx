import { useState, useEffect } from 'react';
import api from '../api';
import PremiumSelect from '../components/PremiumSelect';
import PremiumDatePicker from '../components/PremiumDatePicker';
import { useTranslation } from 'react-i18next';

import { useToast } from '../context/ToastContext';

const CreateTrip = ({ userRole }) => {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const isAdmin = userRole === 'Admin';
    const [customers, setCustomers] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [cars, setCars] = useState([]);

    // Form states
    const [customerId, setCustomerId] = useState('');
    const [driverId, setDriverId] = useState('');
    const [carId, setCarId] = useState('');
    const [pickupLocation, setPickupLocation] = useState(''); // New
    const [dropoffLocation, setDropoffLocation] = useState(''); // New
    const [scheduledFor, setScheduledFor] = useState(''); // Date of the trip
    const [pricingType, setPricingType] = useState(''); // Default empty
    const [fixedPrice, setFixedPrice] = useState('');
    const [hourlyRate, setHourlyRate] = useState('');
    const [sendSms, setSendSms] = useState(false); // مقفول مؤقتاً - تست

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [custRes, drvRes, carRes] = await Promise.all([
                api.get('/Customers'),
                api.get('/Drivers'),
                api.get('/Cars')
            ]);
            setCustomers(custRes.data);
            setDrivers(drvRes.data);
            setCars(carRes.data);
        } catch (error) {
            console.error("Error fetching data:", error);
        }
    };

    const toggleSms = () => {
        setSendSms(prev => {
            localStorage.setItem('smsEnabled', String(!prev));
            return !prev;
        });
    };

    const handleCreateTrip = async (e) => {
        e.preventDefault();
        try {
            await api.post('/Trips' + (!sendSms ? '?skipSms=true' : ''), {
                customerId: parseInt(customerId),
                driverId: parseInt(driverId),
                carId: parseInt(carId),
                pricingType: pricingType || null,
                fixedPrice: pricingType === 'Fixed' && fixedPrice ? parseFloat(fixedPrice) : null,
                hourlyRate: pricingType === 'Hourly' && hourlyRate ? parseFloat(hourlyRate) : null,
                pickupLocation: pickupLocation || null,
                dropoffLocation: dropoffLocation || null,
                scheduledFor: scheduledFor ? new Date(scheduledFor.getTime() - (scheduledFor.getTimezoneOffset() * 60000)).toISOString().slice(0, 19) : null,
                status: 'Scheduled',
                requestTime: new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 19),
                paymentMethod: 'Cash' // Default initial
            });
            // Reset
            setCustomerId(''); setDriverId(''); setCarId(''); setFixedPrice(''); setHourlyRate(''); setPricingType('');
            setPickupLocation(''); setDropoffLocation(''); setScheduledFor('');
            showToast(t('CreateTrip.Success'), 'success');
        } catch (err) {
            console.error(err);
        }
    };


    return (
        <div>
            <h1 className="page-title">{t('CreateTrip.Title')}</h1>
            
            <div className="card" style={{ marginBottom: '2rem' }}>
                <form onSubmit={handleCreateTrip} className="modern-form">
                    <div className="form-grid">
                        <div className="form-group">
                            <label className="form-label">{t('CreateTrip.Customer')}</label>
                            <PremiumSelect 
                                options={customers.map(c => ({value: c.id, label: c.name}))}
                                value={customerId}
                                onChange={setCustomerId}
                                placeholder={t('CreateTrip.SelectCustomer')}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">{t('CreateTrip.Driver')}</label>
                            <PremiumSelect 
                                options={drivers.map(d => ({value: d.id, label: d.name}))}
                                value={driverId}
                                onChange={setDriverId}
                                placeholder={t('CreateTrip.SelectDriver')}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">{t('CreateTrip.Car')}</label>
                            <PremiumSelect 
                                options={cars.map(c => ({value: c.id, label: `${c.make} ${c.model} - ${c.plateNumber}`}))}
                                value={carId}
                                onChange={setCarId}
                                placeholder={t('CreateTrip.SelectCar')}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">{t('CreateTrip.Pickup')}</label>
                            <input type="text" className="form-control" value={pickupLocation} onChange={e => setPickupLocation(e.target.value)} placeholder={t('CreateTrip.PickupPh')} />
                        </div>

                        <div className="form-group">
                            <label className="form-label">{t('CreateTrip.Dropoff')}</label>
                            <input type="text" className="form-control" value={dropoffLocation} onChange={e => setDropoffLocation(e.target.value)} placeholder={t('CreateTrip.DropoffPh')} />
                        </div>

                        <div className="form-group">
                            <label className="form-label">{t('CreateTrip.Date')}</label>
                            <PremiumDatePicker 
                                selected={scheduledFor} 
                                onChange={setScheduledFor} 
                                minDate={new Date()} 
                                showTimeSelect={true}
                            />
                        </div>

                        {isAdmin && (
                            <>
                                <div className="form-group">
                                    <label className="form-label">{t('CreateTrip.PricingType')}</label>
                                    <PremiumSelect 
                                        options={[
                                            {value: '', label: '--'},
                                            {value: 'Fixed', label: t('CreateTrip.Fixed')},
                                            {value: 'Hourly', label: t('CreateTrip.Hourly')}
                                        ]}
                                        value={pricingType}
                                        onChange={setPricingType}
                                    />
                                </div>

                                {pricingType === 'Fixed' && (
                                    <div className="form-group">
                                        <label className="form-label">{t('CreateTrip.FixedPrice')}</label>
                                        <input type="number" step="0.01" className="form-control" value={fixedPrice} onChange={e => setFixedPrice(e.target.value)} />
                                    </div>
                                )}
                                {pricingType === 'Hourly' && (
                                    <div className="form-group">
                                        <label className="form-label">{t('CreateTrip.HourlyRate')}</label>
                                        <input type="number" step="0.01" className="form-control" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} />
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* SMS Toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '1rem 0 0.5rem', padding: '0.8rem 1rem', background: sendSms ? 'rgba(79, 70, 229, 0.05)' : 'var(--gray-50)', borderRadius: '10px', border: `1px solid ${sendSms ? 'var(--primary-color)' : 'var(--gray-200)'}`, cursor: 'pointer', transition: 'all 0.3s ease', userSelect: 'none' }} onClick={toggleSms}>
                        <div style={{
                            width: '22px', height: '22px', borderRadius: '6px',
                            border: `2px solid ${sendSms ? 'var(--primary-color)' : 'var(--gray-300)'}`,
                            background: sendSms ? 'var(--primary-color)' : 'white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.3s ease', flexShrink: 0
                        }}>
                            {sendSms && <span style={{ color: 'white', fontSize: '14px', fontWeight: '700' }}>✓</span>}
                        </div>
                        <span style={{ fontSize: '0.95rem', fontWeight: '600', color: sendSms ? 'var(--primary-color)' : 'var(--gray-500)' }}>
                            {sendSms ? '📩' : '🔕'} {t('Dashboard.SmsToggle')}
                        </span>
                    </div>

                    <div className="form-actions">
                        <button type="submit" className="btn btn-large btn-large-blue">{t('CreateTrip.SaveBtn')}</button>
                    </div>
                </form>
            </div>

        </div>
    );
};


export default CreateTrip;
