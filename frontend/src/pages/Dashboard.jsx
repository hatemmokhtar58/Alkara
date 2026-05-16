import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useToast } from '../context/ToastContext';
import PremiumSelect from '../components/PremiumSelect';

const Dashboard = ({ userRole }) => {
    const { t, i18n } = useTranslation();
    const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
    const navigate = useNavigate();
    const { showToast } = useToast();
    const isAdmin = userRole === 'Admin';

    const [selectedDriverId, setSelectedDriverId] = useState(null);
    const [drivers, setDrivers] = useState([]);
    const [trips, setTrips] = useState([]);
    const [cars, setCars] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [actionLoading, setActionLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [departedTrips, setDepartedTrips] = useState({});

    // Close trip modal
    const [closeModalOpen, setCloseModalOpen] = useState(false);
    const [closingTrip, setClosingTrip] = useState(null);
    const [closePricingType, setClosePricingType] = useState('Hourly');
    const [closeFixedPrice, setCloseFixedPrice] = useState('');
    const [closeHourlyRate, setCloseHourlyRate] = useState('');
    const [closePaymentMethod, setClosePaymentMethod] = useState('Cash');
    const [closeDiscount, setCloseDiscount] = useState('');
    const [closeExtra, setCloseExtra] = useState('');
    const [closeNotes, setCloseNotes] = useState('');
    const [closePaidAmount, setClosePaidAmount] = useState('');

    // Create trip modal
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [newPhone, setNewPhone] = useState('');
    const [foundCustomer, setFoundCustomer] = useState(null); // null = not searched, false = new, object = found
    const [newCustomerName, setNewCustomerName] = useState('');
    const [newCarId, setNewCarId] = useState('');
    const [newPickup, setNewPickup] = useState('');
    const [newDropoff, setNewDropoff] = useState('');
    const [newPricingType, setNewPricingType] = useState('Hourly');
    const [newHourlyRate, setNewHourlyRate] = useState('');
    const [newFixedPrice, setNewFixedPrice] = useState('');

    useEffect(() => {
        fetchAll();
        const interval = setInterval(fetchAll, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchAll = async () => {
        try {
            const [driversRes, tripsRes, carsRes, customersRes] = await Promise.all([
                api.get('/Drivers'),
                api.get('/Trips'),
                api.get('/Cars'),
                api.get('/Customers')
            ]);
            setDrivers(driversRes.data);
            setTrips(tripsRes.data);
            setCars(carsRes.data);
            setCustomers(customersRes.data);
        } catch (err) {
            console.error("Error fetching dashboard data", err);
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (dt) => {
        if (!dt) return '--';
        return new Date(dt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    };

    const getDriverRows = () => {
        return drivers.map(driver => {
            const activeTrip = trips.find(t =>
                t.driverId === driver.id && (t.status === 'Ongoing' || t.status === 'Scheduled')
            );
            let customer = null;
            let car = null;
            if (activeTrip) {
                customer = activeTrip.customer || customers.find(c => c.id === activeTrip.customerId);
                car = activeTrip.car || cars.find(c => c.id === activeTrip.carId);
            } else {
                car = cars.find(c => c.id === driver.carId);
            }
            return { driver, trip: activeTrip, customer, car };
        });
    };

    const getStatusBadge = (driver, trip) => {
        if (trip?.status === 'Ongoing') return <span className="status-badge status-ongoing">{t('Dashboard.StatusBusy')}</span>;
        if (trip?.status === 'Scheduled') return <span className="status-badge status-scheduled">{t('Dashboard.StatusScheduled')}</span>;
        return <span className="status-badge status-available">{t('Dashboard.StatusAvailable')}</span>;
    };

    const getRate = (trip) => {
        if (!trip) return '—';
        if (trip.pricingType === 'Hourly' && trip.hourlyRate) return `${trip.hourlyRate} ${t('Dashboard.PerHour')}`;
        if (trip.pricingType === 'Fixed' && trip.fixedPrice) return `${trip.fixedPrice} ${t('Dashboard.Currency')}`;
        return '—';
    };

    const getPlateNumber = (car) => car?.plateNumber || '—';

    // === ACTION HANDLERS ===

    // Open create trip modal for selected driver
    const handleOpenCreateModal = (driverId) => {
        const driver = drivers.find(d => d.id === driverId);
        if (!driver) return;
        setSelectedDriverId(driverId);
        setNewPhone('');
        setFoundCustomer(null);
        setNewCustomerName('');
        setNewCarId(driver.carId || '');
        setNewPickup('');
        setNewDropoff('');
        setNewPricingType('Hourly');
        setNewHourlyRate('');
        setNewFixedPrice('');
        setCreateModalOpen(true);
    };

    // Search customer by phone
    const handlePhoneSearch = (phone) => {
        setNewPhone(phone);
        if (phone.length >= 10) {
            const found = customers.find(c => c.phone === phone || c.phone === phone.replace(/^0/, ''));
            if (found) {
                setFoundCustomer(found);
                setNewCustomerName(found.name);
            } else {
                setFoundCustomer(false); // new customer
                setNewCustomerName('');
            }
        } else {
            setFoundCustomer(null);
            setNewCustomerName('');
        }
    };

    // Submit create trip
    const handleCreateTrip = async () => {
        if (!selectedDriverId || !newPhone || newPhone.length < 10) {
            showToast(t('Dashboard.Msg.FillRequired'), 'error');
            return;
        }

        setActionLoading(true);
        try {
            let customerId;

            if (foundCustomer && foundCustomer.id) {
                // Existing customer
                customerId = foundCustomer.id;
            } else {
                // New customer - create first
                if (!newCustomerName.trim()) {
                    showToast(t('Dashboard.Msg.EnterName'), 'error');
                    setActionLoading(false);
                    return;
                }
                const res = await api.post('/Customers', {
                    name: newCustomerName.trim(),
                    phone: newPhone,
                    walletBalance: 0
                });
                customerId = res.data.id;
                // Refresh customers list
                const custRes = await api.get('/Customers');
                setCustomers(custRes.data);
            }

            await api.post('/Trips', {
                customerId: customerId,
                driverId: selectedDriverId,
                carId: newCarId ? parseInt(newCarId) : null,
                pricingType: newPricingType || null,
                fixedPrice: newPricingType === 'Fixed' && newFixedPrice ? parseFloat(newFixedPrice) : null,
                hourlyRate: newPricingType === 'Hourly' && newHourlyRate ? parseFloat(newHourlyRate) : null,
                pickupLocation: newPickup || null,
                dropoffLocation: newDropoff || null,
                scheduledFor: new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 19),
                status: 'Scheduled',
                requestTime: new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 19),
                paymentMethod: 'Cash'
            });
            showToast(t('Dashboard.Msg.TripCreated'), 'success');
            setCreateModalOpen(false);
            await fetchAll();
        } catch (err) {
            const msg = err.response?.data?.message || t('Common.Error');
            showToast(msg, 'error');
        }
        setActionLoading(false);
    };


    // Start Trip (Scheduled → Ongoing)
    const handleStartTrip = async () => {
        const row = driverRows.find(r => r.driver.id === selectedDriverId);
        if (!row?.trip || row.trip.status !== 'Scheduled') return;

        setActionLoading(true);
        try {
            const tripData = { ...row.trip, status: 'Ongoing', customer: null, driver: null, car: null };
            await api.put(`/Trips/${row.trip.id}`, tripData);
            showToast(t('Dashboard.Msg.TripStarted'), 'success');
            await fetchAll();
        } catch (err) {
            const msg = err.response?.data?.message || t('Common.Error');
            showToast(msg, 'error');
        }
        setActionLoading(false);
    };

    // Open Close Trip Modal (Ongoing → show modal)
    const handleOpenCloseModal = () => {
        const row = driverRows.find(r => r.driver.id === selectedDriverId);
        if (!row?.trip || row.trip.status !== 'Ongoing') return;

        setClosingTrip(row.trip);
        setClosePricingType(row.trip.pricingType || 'Hourly');
        setCloseHourlyRate(row.trip.hourlyRate || '');
        setCloseFixedPrice(row.trip.fixedPrice || '');
        setClosePaymentMethod('Cash');
        setCloseDiscount('');
        setCloseNotes('');
        setClosePaidAmount('');

        // Auto-calculate extra charge for fixed-price trips exceeding 1 hour
        if (row.trip.pricingType === 'Fixed' && row.trip.fixedPrice) {
            const now = new Date();
            const start = row.trip.startTime ? new Date(row.trip.startTime) : now;
            const totalMin = Math.max(0, (now - start) / 60000);
            if (totalMin > 60) {
                const extraMin = totalMin - 60;
                const extraCharge = Math.round((extraMin * (parseFloat(row.trip.fixedPrice) / 60)) * 100) / 100;
                setCloseExtra(String(extraCharge));
            } else {
                setCloseExtra('');
            }
        } else {
            setCloseExtra('');
        }

        setCloseModalOpen(true);
    };

    // Calculate close modal totals
    const getCloseTotals = () => {
        if (!closingTrip) return { hours: 0, minutes: 0, hoursCost: 0, discount: 0, extra: 0, total: 0 };
        const now = new Date();
        const start = closingTrip.startTime ? new Date(closingTrip.startTime) : now;
        const totalMin = Math.max(0, (now - start) / 60000);
        const hours = Math.floor(totalMin / 60);
        const minutes = Math.round(totalMin % 60);

        let hoursCost = 0;
        let autoExtra = 0;
        if (closePricingType === 'Hourly' && closeHourlyRate) {
            const rate = parseFloat(closeHourlyRate);
            if (totalMin <= 60) {
                hoursCost = rate;
            } else {
                hoursCost = rate + ((totalMin - 60) * (rate / 60));
            }
        } else if (closePricingType === 'Fixed' && closeFixedPrice) {
            hoursCost = parseFloat(closeFixedPrice);
            if (totalMin > 60) {
                autoExtra = Math.round(((totalMin - 60) * (parseFloat(closeFixedPrice) / 60)) * 100) / 100;
            }
        }

        const discount = parseFloat(closeDiscount) || 0;
        const extra = closePricingType === 'Fixed' ? autoExtra : (parseFloat(closeExtra) || 0);
        const total = Math.max(0, hoursCost - discount + extra);
        return { hours, minutes, hoursCost: Math.round(hoursCost * 100) / 100, discount, extra, total: Math.round(total * 100) / 100 };
    };

    // Submit Close Trip
    const handleCloseTrip = async () => {
        if (!closingTrip) return;
        if (closePaidAmount === '' || closePaidAmount === null || closePaidAmount === undefined) {
            showToast(t('Dashboard.Msg.EnterPaidAmount'), 'error');
            return;
        }
        const totals = getCloseTotals();
        setActionLoading(true);
        try {
            const tripData = {
                ...closingTrip,
                status: 'Completed',
                pricingType: closePricingType,
                hourlyRate: closePricingType === 'Hourly' ? Number(closeHourlyRate) : null,
                fixedPrice: closePricingType === 'Fixed' ? Number(closeFixedPrice) : null,
                paymentMethod: closePaymentMethod,
                paidAmount: parseFloat(closePaidAmount) || 0,
                discountType: closeDiscount && parseFloat(closeDiscount) > 0 ? 'Amount' : 'None',
                discountValue: parseFloat(closeDiscount) || 0,
                notes: closeNotes || null,
                customer: null, driver: null, car: null
            };
            await api.put(`/Trips/${closingTrip.id}`, tripData);

            showToast(t('Dashboard.Msg.TripClosed'), 'success');
            setCloseModalOpen(false);
            setClosingTrip(null);
            await fetchAll();
        } catch (err) {
            const msg = err.response?.data?.message || t('Common.Error');
            showToast(msg, 'error');
        }
        setActionLoading(false);
    };

    // Cancel Trip
    const handleCancelTrip = async () => {
        const row = driverRows.find(r => r.driver.id === selectedDriverId);
        if (!row?.trip) return;

        setActionLoading(true);
        try {
            const tripData = { ...row.trip, status: 'Cancelled', customer: null, driver: null, car: null };
            await api.put(`/Trips/${row.trip.id}`, tripData);
            showToast(t('Dashboard.Msg.TripCancelled'), 'success');
            await fetchAll();
        } catch (err) {
            const msg = err.response?.data?.message || t('Common.Error');
            showToast(msg, 'error');
        }
        setActionLoading(false);
    };

    // Depart - خروج السائق من المكتب
    const handleDepart = async () => {
        const row = driverRows.find(r => r.driver.id === selectedDriverId);
        if (!row?.trip) return;

        setActionLoading(true);
        try {
            const res = await api.post(`/Trips/${row.trip.id}/depart`);
            setDepartedTrips(prev => ({ ...prev, [row.trip.id]: new Date() }));
            showToast(res.data.message || t('Dashboard.Msg.DepartSent'), 'success');
        } catch (err) {
            const msg = err.response?.data?.message || t('Common.Error');
            showToast(msg, 'error');
        }
        setActionLoading(false);
    };

    const driverRows = getDriverRows();
    const activeCount = driverRows.filter(r => r.trip?.status === 'Ongoing').length;
    const availableCount = driverRows.filter(r => !r.trip || r.trip.status !== 'Ongoing').length;

    // Get selected row info for display
    const selectedRow = driverRows.find(r => r.driver.id === selectedDriverId);

    return (
        <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
            {loading && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4rem 0' }}>
                    <div style={{ width: '40px', height: '40px', border: '4px solid #e2e8f0', borderTopColor: 'var(--primary-color)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                </div>
            )}
            {!loading && <>

            {/* Drivers Table */}
            <div className="table-responsive" style={{ marginTop: '1rem' }}>
                <table className="data-table drivers-live-table" style={{ tableLayout: 'fixed', width: '100%' }}>
                    <colgroup>
                        <col style={{ width: '4%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '9%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '13%' }} />
                        <col style={{ width: '11%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '9%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '10%' }} />
                    </colgroup>
                    <thead>
                        <tr>
                            <th style={{ textAlign: 'center' }}>#</th>
                            <th style={{ textAlign: 'center' }}>{t('Dashboard.Col.Driver')}</th>
                            <th style={{ textAlign: 'center' }}>{t('Dashboard.Col.Status')}</th>
                            <th style={{ textAlign: 'center' }}>{t('Dashboard.Col.Customer')}</th>
                            <th style={{ textAlign: 'center' }}>{t('Dashboard.Col.Phone')}</th>
                            <th style={{ textAlign: 'center' }}>{t('Dashboard.Col.Rate')}</th>
                            <th style={{ textAlign: 'center' }}>{t('Dashboard.Col.Departure')}</th>
                            <th style={{ textAlign: 'center' }}>{t('Dashboard.Col.EndTime')}</th>
                            <th style={{ textAlign: 'center' }}>{t('Dashboard.Col.Location')}</th>
                            <th style={{ textAlign: 'center' }}>{t('Dashboard.Col.Car')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {driverRows.map((row, idx) => (
                            <tr key={row.driver.id}
                                className={`${row.trip?.status === 'Ongoing' ? 'row-ongoing' : row.trip?.status === 'Scheduled' ? 'row-scheduled' : ''} ${selectedDriverId === row.driver.id ? 'row-selected' : ''}`}
                                onClick={() => setSelectedDriverId(row.driver.id)}
                                onDoubleClick={() => handleOpenCreateModal(row.driver.id)}
                                style={{ cursor: 'pointer' }}
                            >
                                <td style={{ fontWeight: 'bold', color: '#94a3b8', textAlign: 'center' }}>{idx + 1}</td>
                                <td style={{ fontWeight: '600', textAlign: 'center' }}>{row.driver.name}</td>
                                <td style={{ textAlign: 'center' }}>{getStatusBadge(row.driver, row.trip)}</td>
                                <td style={{ textAlign: 'center' }}>{row.customer?.name || '—'}</td>
                                <td dir="ltr" style={{ fontFamily: 'monospace', fontSize: '0.85rem', textAlign: 'center' }}>
                                    {row.customer?.phone || '—'}
                                </td>
                                <td style={{ textAlign: 'center' }}>{getRate(row.trip)}</td>
                                <td style={{ textAlign: 'center' }}>{departedTrips[row.trip?.id] ? formatTime(departedTrips[row.trip.id]) : '—'}</td>
                                <td style={{ textAlign: 'center' }}>{row.trip ? formatTime(row.trip.endTime) : '—'}</td>
                                <td style={{ textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {row.trip?.dropoffLocation || row.trip?.pickupLocation || '—'}
                                </td>
                                <td style={{ fontFamily: 'monospace', fontWeight: '600', textAlign: 'center' }}>
                                    {getPlateNumber(row.car)}
                                </td>
                            </tr>
                        ))}
                        {driverRows.length === 0 && (
                            <tr>
                                <td colSpan="10" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                    {t('Dashboard.NoDrivers')}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Action Buttons - Fixed at bottom */}
            <div className="dashboard-actions">
                <button className="action-btn action-new" onClick={() => {
                    if (selectedDriverId) handleOpenCreateModal(selectedDriverId);
                    else showToast(t('Dashboard.Msg.SelectDriver'), 'error');
                }} disabled={actionLoading}>
                    {t('Dashboard.Btn.NewTrip')}
                </button>
                <button className="action-btn action-start" onClick={handleStartTrip}
                    disabled={actionLoading || !selectedRow?.trip || selectedRow?.trip?.status !== 'Scheduled' || !departedTrips[selectedRow?.trip?.id]}>
                    {t('Dashboard.Btn.Start')}
                </button>
                <button className="action-btn action-depart" onClick={handleDepart}
                    disabled={actionLoading || !selectedRow?.trip || selectedRow?.trip?.status !== 'Scheduled' || !!departedTrips[selectedRow?.trip?.id]}>
                    {t('Dashboard.Btn.Depart')}
                </button>
                <button className="action-btn action-close" onClick={handleOpenCloseModal}
                    disabled={actionLoading || !selectedRow?.trip || selectedRow?.trip?.status !== 'Ongoing'}>
                    {t('Dashboard.Btn.CloseTrip')}
                </button>
                <button className="action-btn action-cancel" onClick={handleCancelTrip}
                    disabled={actionLoading || !selectedRow?.trip}>
                    {t('Dashboard.Btn.CancelTrip')}
                </button>
            </div>
            </>}

            {/* Close Trip Modal */}
            {closeModalOpen && closingTrip && (() => {
                const totals = getCloseTotals();
                const cust = closingTrip.customer || customers.find(c => c.id === closingTrip.customerId);
                const drv = closingTrip.driver || drivers.find(d => d.id === closingTrip.driverId);
                const car = closingTrip.car || cars.find(c => c.id === closingTrip.carId);
                return (
                <div className="modal-overlay" onClick={() => setCloseModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
                        <h2 style={{ textAlign: 'center', marginBottom: '0.8rem', color: '#10b981' }}>
                            {t('Dashboard.Modal.Title')}
                        </h2>

                        {/* Trip Info Grid */}
                        <div style={{
                            background: '#f8fafc', borderRadius: '10px', padding: '0.8rem',
                            marginBottom: '0.8rem', border: '1px solid #e2e8f0'
                        }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                <div><strong>{t('Dashboard.Col.Driver')}:</strong> {drv?.name}</div>
                                <div><strong>{t('CreateTrip.Customer')}:</strong> {cust?.name}</div>
                                <div><strong>{t('Dashboard.Col.Phone')}:</strong> <span dir="ltr">{cust?.phone || '--'}</span></div>
                                <div><strong>{t('Dashboard.Modal.WalletBalance')}:</strong> <span style={{ color: (cust?.walletBalance || 0) > 0 ? '#991b1b' : '#065f46', fontWeight: '700' }}>{(cust?.walletBalance || 0).toLocaleString()} {t('Dashboard.Currency')}</span></div>
                                <div><strong>{t('CreateTrip.Car')}:</strong> {car ? `${car.make} ${car.model}` : '--'}</div>
                                <div><strong>{t('Dashboard.Col.Location')}:</strong> {closingTrip.pickupLocation || '--'}</div>
                            </div>
                        </div>

                        {/* Times & Duration */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.8rem' }}>
                            <div style={{ background: '#dbeafe', borderRadius: '8px', padding: '0.5rem', textAlign: 'center', border: '1px solid #93c5fd' }}>
                                <div style={{ fontSize: '0.8rem', color: '#1e40af' }}>{t('Dashboard.Modal.StartTime')}</div>
                                <div style={{ fontWeight: '700', fontSize: '1.05rem' }}>{formatTime(closingTrip.startTime)}</div>
                            </div>
                            <div style={{ background: '#fef3c7', borderRadius: '8px', padding: '0.5rem', textAlign: 'center', border: '1px solid #fcd34d' }}>
                                <div style={{ fontSize: '0.8rem', color: '#92400e' }}>{t('Dashboard.Modal.EndTime')}</div>
                                <div style={{ fontWeight: '700', fontSize: '1.05rem' }}>{new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                            <div style={{ background: '#f3e8ff', borderRadius: '8px', padding: '0.5rem', textAlign: 'center', border: '1px solid #c4b5fd' }}>
                                <div style={{ fontSize: '0.8rem', color: '#6b21a8' }}>{t('Dashboard.Modal.Duration')}</div>
                                <div style={{ fontWeight: '700', fontSize: '1.05rem' }}>{totals.hours}:{String(totals.minutes).padStart(2, '0')}</div>
                            </div>
                        </div>

                        <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                            {/* Rate */}
                            {closingTrip.pricingType !== 'Fixed' && (
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">{t('CreateTrip.HourlyRate')}</label>
                                <input type="number" className="form-control" value={closeHourlyRate}
                                    onChange={e => setCloseHourlyRate(e.target.value)}
                                    style={{ textAlign: 'center', fontWeight: '700' }} />
                            </div>
                            )}

                            {/* Hours Cost (auto) */}
                            {closingTrip.pricingType !== 'Fixed' && (
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">{t('Dashboard.Modal.HoursCost')}</label>
                                <div style={{
                                    padding: '0.5rem', borderRadius: '8px', textAlign: 'center', fontWeight: '700',
                                    background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7'
                                }}>{totals.hoursCost} {t('Dashboard.Currency')}</div>
                            </div>
                            )}
                        </div>

                        {/* Total */}
                        <div style={{
                            background: 'linear-gradient(135deg, #065f46, #047857)', borderRadius: '10px', padding: '0.7rem',
                            marginTop: '0.8rem', textAlign: 'center', color: 'white'
                        }}>
                            <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>{t('Dashboard.Modal.TripTotal')}</div>
                            <div style={{ fontSize: '1.6rem', fontWeight: '800' }}>{totals.total} {t('Dashboard.Currency')}</div>
                        </div>

                        {/* Discount & Extra Charges */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginTop: '0.8rem' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">{t('Dashboard.Modal.Discount')}</label>
                                <input type="number" className="form-control" value={closeDiscount}
                                    onChange={e => setCloseDiscount(e.target.value)}
                                    placeholder="0" style={{ textAlign: 'center', fontWeight: '700' }} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">{t('Dashboard.Modal.ExtraCharge')}</label>
                                {closingTrip.pricingType === 'Fixed' ? (
                                    <div style={{
                                        padding: '0.5rem', borderRadius: '8px', textAlign: 'center', fontWeight: '700',
                                        background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d'
                                    }}>{totals.extra} {t('Dashboard.Currency')}</div>
                                ) : (
                                    <input type="number" className="form-control" value={closeExtra}
                                        onChange={e => setCloseExtra(e.target.value)}
                                        placeholder="0" style={{ textAlign: 'center', fontWeight: '700' }} />
                                )}
                            </div>
                        </div>

                        {/* Payment Method */}
                        <div className="form-group" style={{ marginTop: '0.8rem', marginBottom: 0 }}>
                            <label className="form-label">{t('Dashboard.Modal.PaymentMethod')}</label>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                                {['Cash', 'Wallet', 'Transfer'].map(method => (
                                    <button key={method} type="button"
                                        onClick={() => {
                                            setClosePaymentMethod(method);
                                            if (method === 'Wallet') {
                                                const walletBal = cust?.walletBalance ?? 0;
                                                const credit = walletBal < 0 ? Math.abs(walletBal) : 0;
                                                const autoPayFromWallet = Math.min(credit, totals.total);
                                                setClosePaidAmount(String(autoPayFromWallet));
                                            }
                                        }}
                                        style={{
                                            flex: 1, padding: '8px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem',
                                            background: closePaymentMethod === method ? '#10b981' : 'white',
                                            color: closePaymentMethod === method ? 'white' : '#333',
                                            border: `2px solid ${closePaymentMethod === method ? '#10b981' : '#e2e8f0'}`
                                        }}>
                                        {t(`Dashboard.Modal.${method}`)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Wallet Info when Wallet is selected */}
                        {closePaymentMethod === 'Wallet' && (() => {
                            const walletBal = cust?.walletBalance ?? 0;
                            const credit = walletBal < 0 ? Math.abs(walletBal) : 0;
                            const deductFromWallet = Math.min(credit, totals.total);
                            const walletRemaining = credit - deductFromWallet;
                            return (
                                <div style={{
                                    marginTop: '0.6rem', padding: '0.7rem', borderRadius: '10px',
                                    background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)', border: '1px solid #a5b4fc'
                                }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem', textAlign: 'center' }}>
                                        <div>
                                            <div style={{ fontSize: '0.75rem', color: '#6366f1', fontWeight: '600' }}>{t('Dashboard.Modal.WalletCredit')}</div>
                                            <div style={{ fontSize: '1.1rem', fontWeight: '800', color: credit > 0 ? '#059669' : '#dc2626' }}>{credit} {t('Dashboard.Currency')}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.75rem', color: '#6366f1', fontWeight: '600' }}>{t('Dashboard.Modal.WalletDeduct')}</div>
                                            <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#dc2626' }}>-{deductFromWallet} {t('Dashboard.Currency')}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.75rem', color: '#6366f1', fontWeight: '600' }}>{t('Dashboard.Modal.WalletAfter')}</div>
                                            <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#4f46e5' }}>{walletRemaining} {t('Dashboard.Currency')}</div>
                                        </div>
                                    </div>
                                    {credit < totals.total && (
                                        <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: '#dc2626', textAlign: 'center', fontWeight: '600' }}>
                                            {t('Dashboard.Modal.WalletNotEnough')}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Paid Amount & Remaining */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginTop: '0.8rem' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ color: closePaidAmount === '' ? '#ef4444' : 'inherit' }}>{t('Dashboard.Modal.PaidAmount')} *</label>
                                <input type="number" className="form-control" value={closePaidAmount}
                                    onChange={e => setClosePaidAmount(e.target.value)}
                                    placeholder="0"
                                    min="0"
                                    style={{ textAlign: 'center', fontWeight: '700', borderColor: closePaidAmount === '' ? '#ef4444' : undefined }} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">{t('Dashboard.Modal.RemainingDebt')}</label>
                                {(() => {
                                    const paid = closePaidAmount !== '' ? parseFloat(closePaidAmount) || 0 : 0;
                                    const rem = totals.total - paid;
                                    return (
                                        <div style={{
                                            padding: '0.5rem', borderRadius: '8px', textAlign: 'center', fontWeight: '700',
                                            background: rem > 0 ? '#fee2e2' : '#d1fae5',
                                            color: rem > 0 ? '#991b1b' : '#065f46',
                                            border: `1px solid ${rem > 0 ? '#fca5a5' : '#6ee7b7'}`
                                        }}>
                                            {rem > 0 ? `${rem} ${t('Dashboard.Currency')}` : rem < 0 ? `سداد ${Math.abs(rem)} ${t('Dashboard.Currency')}` : `0 ${t('Dashboard.Currency')}`}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>


                        {/* Notes */}
                        <div className="form-group" style={{ marginTop: '0.6rem', marginBottom: 0 }}>
                            <label className="form-label">{t('Dashboard.Modal.Notes')}</label>
                            <input type="text" className="form-control" value={closeNotes}
                                onChange={e => setCloseNotes(e.target.value)}
                                placeholder={t('Dashboard.Modal.NotesPlaceholder')} />
                        </div>

                        {/* Buttons */}
                        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem' }}>
                            <button onClick={handleCloseTrip} disabled={actionLoading}
                                style={{
                                    flex: 2, padding: '10px', borderRadius: '10px', fontWeight: '800', fontSize: '0.95rem',
                                    background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white',
                                    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                                }}>
                                {actionLoading ? '...' : t('Dashboard.Modal.Confirm')}
                            </button>
                            <button onClick={() => setCloseModalOpen(false)}
                                style={{
                                    flex: 1, padding: '10px', borderRadius: '10px', fontWeight: '700', fontSize: '0.95rem',
                                    background: 'transparent', color: '#ef4444', border: '2px solid #ef4444',
                                    cursor: 'pointer', fontFamily: 'inherit'
                                }}>
                                {t('Common.Cancel')}
                            </button>
                        </div>
                    </div>
                </div>
                );
            })()}
            {/* Create Trip Modal */}
            {createModalOpen && (
                <div className="modal-overlay" onClick={() => setCreateModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                        <h2 style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--primary-color)' }}>
                            {t('Dashboard.Btn.NewTrip')}
                        </h2>

                        {/* Driver Info */}
                        <div style={{
                            background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
                            borderRadius: '10px', padding: '0.6rem', marginBottom: '0.8rem',
                            border: '1px solid #bae6fd', textAlign: 'center', fontSize: '0.95rem'
                        }}>
                            <strong>{t('Dashboard.Col.Driver')}: </strong>
                            <span style={{ fontWeight: '700' }}>{drivers.find(d => d.id === selectedDriverId)?.name}</span>
                        </div>

                        <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                            {/* Phone */}
                            <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
                                <label className="form-label">{t('Dashboard.Col.Phone')}</label>
                                <input type="tel" className="form-control" dir="ltr"
                                    value={newPhone}
                                    onChange={e => handlePhoneSearch(e.target.value)}
                                    placeholder="05XXXXXXXX"
                                    style={{ textAlign: 'center', fontWeight: '700', letterSpacing: '1px' }} />
                            </div>

                            {/* Customer name - auto or input */}
                            {foundCustomer && (
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">{t('CreateTrip.Customer')}</label>
                                    <div style={{
                                        padding: '8px', borderRadius: '8px', fontWeight: '700',
                                        background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7', textAlign: 'center'
                                    }}>
                                        {foundCustomer.name}
                                    </div>
                                </div>
                            )}

                            {foundCustomer === false && (
                                <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
                                    <label className="form-label" style={{ color: '#f59e0b', fontWeight: '700' }}>
                                        {t('Dashboard.Modal.NewCustomer')}
                                    </label>
                                    <input type="text" className="form-control" value={newCustomerName}
                                        onChange={e => setNewCustomerName(e.target.value)}
                                        placeholder={t('Dashboard.Modal.EnterName')}
                                        style={{ fontWeight: '600', borderColor: '#f59e0b' }} />
                                </div>
                            )}

                            {/* Wallet Balance */}
                            {foundCustomer && (
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">{t('Dashboard.Modal.WalletBalance')}</label>
                                    <div style={{
                                        padding: '8px', borderRadius: '8px', fontWeight: '700', textAlign: 'center',
                                        background: (foundCustomer.walletBalance || 0) > 0 ? '#fee2e2' : '#f1f5f9',
                                        color: (foundCustomer.walletBalance || 0) > 0 ? '#991b1b' : '#64748b',
                                        border: `1px solid ${(foundCustomer.walletBalance || 0) > 0 ? '#fca5a5' : '#e2e8f0'}`
                                    }}>
                                        {(foundCustomer.walletBalance || 0).toLocaleString()} {t('Dashboard.Currency')}
                                    </div>
                                </div>
                            )}

                            {/* Car */}
                            <div className="form-group">
                                <label className="form-label">{t('CreateTrip.Car')}</label>
                                <PremiumSelect
                                    options={cars.map(c => ({value: c.id, label: `${c.make} ${c.model} - ${c.plateNumber}`}))}
                                    value={newCarId}
                                    onChange={setNewCarId}
                                    placeholder={t('CreateTrip.SelectCar')}
                                />
                            </div>

                            {/* Pricing Type */}
                            <div className="form-group">
                                <label className="form-label">{t('CreateTrip.PricingType')}</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button type="button" onClick={() => setNewPricingType('Hourly')}
                                        style={{
                                            flex: 1, padding: '8px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit',
                                            background: newPricingType === 'Hourly' ? 'var(--primary-color)' : 'white',
                                            color: newPricingType === 'Hourly' ? 'white' : '#333',
                                            border: `2px solid ${newPricingType === 'Hourly' ? 'var(--primary-color)' : '#e2e8f0'}`
                                        }}>{t('CreateTrip.Hourly')}</button>
                                    <button type="button" onClick={() => setNewPricingType('Fixed')}
                                        style={{
                                            flex: 1, padding: '8px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit',
                                            background: newPricingType === 'Fixed' ? 'var(--primary-color)' : 'white',
                                            color: newPricingType === 'Fixed' ? 'white' : '#333',
                                            border: `2px solid ${newPricingType === 'Fixed' ? 'var(--primary-color)' : '#e2e8f0'}`
                                        }}>{t('CreateTrip.Fixed')}</button>
                                </div>
                            </div>

                            {/* Rate */}
                            <div className="form-group">
                                <label className="form-label">{newPricingType === 'Hourly' ? t('CreateTrip.HourlyRate') : t('CreateTrip.FixedPrice')}</label>
                                <input type="number" step="0.01" className="form-control"
                                    value={newPricingType === 'Hourly' ? newHourlyRate : newFixedPrice}
                                    onChange={e => newPricingType === 'Hourly' ? setNewHourlyRate(e.target.value) : setNewFixedPrice(e.target.value)}
                                    placeholder="50" style={{ textAlign: 'center', fontWeight: '700' }} />
                            </div>

                            {/* Pickup */}
                            <div className="form-group">
                                <label className="form-label">{t('CreateTrip.Pickup')}</label>
                                <input type="text" className="form-control" value={newPickup}
                                    onChange={e => setNewPickup(e.target.value)} placeholder={t('CreateTrip.PickupPh')} />
                            </div>

                            {/* Dropoff */}
                            <div className="form-group">
                                <label className="form-label">{t('CreateTrip.Dropoff')}</label>
                                <input type="text" className="form-control" value={newDropoff}
                                    onChange={e => setNewDropoff(e.target.value)} placeholder={t('CreateTrip.DropoffPh')} />
                            </div>
                        </div>

                        {/* Buttons */}
                        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem' }}>
                            <button onClick={handleCreateTrip} disabled={actionLoading}
                                style={{
                                    flex: 2, padding: '10px', borderRadius: '10px', fontWeight: '800', fontSize: '0.95rem',
                                    background: 'linear-gradient(135deg, var(--primary-color), #2b6cb0)', color: 'white',
                                    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                                    boxShadow: '0 4px 12px rgba(66, 153, 225, 0.3)'
                                }}>
                                {actionLoading ? '...' : t('CreateTrip.SaveBtn')}
                            </button>
                            <button onClick={() => setCreateModalOpen(false)}
                                style={{
                                    flex: 1, padding: '10px', borderRadius: '10px', fontWeight: '700', fontSize: '0.95rem',
                                    background: 'transparent', color: '#ef4444', border: '2px solid #ef4444',
                                    cursor: 'pointer', fontFamily: 'inherit'
                                }}>
                                {t('Common.Cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
