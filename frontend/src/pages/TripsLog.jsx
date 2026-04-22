import { useState, useEffect } from 'react';
import api from '../api';
import PremiumSelect from '../components/PremiumSelect';
import PremiumDatePicker from '../components/PremiumDatePicker';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';

const TripsLog = ({ userRole }) => {
    const { t, i18n } = useTranslation();
    const { showToast } = useToast();
    const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
    const isAdmin = userRole === 'Admin';
    const [trips, setTrips] = useState([]);
    const [drivers, setDrivers] = useState([]); // Array to store drivers for editing
    const [searchQuery, setSearchQuery] = useState('');

    // Completion states
    const [completionModalOpen, setCompletionModalOpen] = useState(false);
    const [selectedTrip, setSelectedTrip] = useState(null);
    const [completionPricingType, setCompletionPricingType] = useState('Fixed');
    const [completionFixedPrice, setCompletionFixedPrice] = useState('');
    const [completionHourlyRate, setCompletionHourlyRate] = useState('');
    const [paymentMethodForCompletion, setPaymentMethodForCompletion] = useState('Cash');

    // Edit/Update Trip states
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [newScheduleDate, setNewScheduleDate] = useState(null);
    const [newDriverId, setNewDriverId] = useState('');

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userPermissions = user.permissions ? user.permissions.split(',') : [];
    const hasFinancePerm = userPermissions.includes('wallet') || userPermissions.includes('reports') || user.role === 'Admin';



    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [tripsRes, driversRes] = await Promise.all([
                api.get('/Trips'),
                api.get('/Drivers')
            ]);
            setTrips(tripsRes.data);
            setDrivers(driversRes.data);
        } catch (error) {
            console.error("Error fetching data:", error);
        }
    };

    const confirmCompletion = async () => {
        if (!selectedTrip) return;
        
        const updatedTrip = { 
            ...selectedTrip, 
            status: 'Completed',
            endTime: new Date().toISOString(),
            paymentMethod: paymentMethodForCompletion,
            pricingType: completionPricingType,
            fixedPrice: completionPricingType === 'Fixed' ? parseFloat(completionFixedPrice || 0) : selectedTrip.fixedPrice,
            hourlyRate: completionPricingType === 'Hourly' ? parseFloat(completionHourlyRate || 0) : selectedTrip.hourlyRate,
        };

        try {
            await api.put(`/Trips/${selectedTrip.id}`, updatedTrip);
            setCompletionModalOpen(false);
            fetchData();
        } catch (err) {
            console.error(err);
            if (err.response?.data?.message) {
                showToast(err.response.data.message, "error");
            } else if (err.response?.data?.errors) {
                // If standard .NET validation error
                showToast(JSON.stringify(err.response.data.errors), "error");
            } else {
                showToast(t('Common.Error'), "error");
            }
        }
    };

    const confirmEdit = async () => {
        if (!selectedTrip) return;

        const updatedTrip = {
            ...selectedTrip,
            scheduledFor: newScheduleDate ? new Date(newScheduleDate.getTime() - (newScheduleDate.getTimezoneOffset() * 60000)).toISOString().slice(0, 19) : selectedTrip.scheduledFor,
            driverId: newDriverId ? parseInt(newDriverId) : selectedTrip.driverId
        };

        try {
            await api.put(`/Trips/${selectedTrip.id}`, updatedTrip);
            setEditModalOpen(false);
            setNewScheduleDate(null);
            setNewDriverId('');
            fetchData();
            showToast(t('TripsLog.EditSuccess') || "تم تعديل المشوار بنجاح", "success");
        } catch (err) {
            console.error(err);
            showToast(t('Common.Error'), "error");
        }
    };

    const updateTripStatus = async (trip, newStatus) => {
        if (newStatus === 'Completed') {
            setSelectedTrip(trip);
            setCompletionPricingType(trip.pricingType || 'Fixed');
            setCompletionFixedPrice(trip.fixedPrice || '');
            setCompletionHourlyRate(trip.hourlyRate || '');
            setPaymentMethodForCompletion('Cash');
            setCompletionModalOpen(true);
            return;
        }

        if (newStatus === 'Edit') {
            setSelectedTrip(trip);
            setNewScheduleDate(trip.scheduledFor ? new Date(trip.scheduledFor) : null);
            setNewDriverId(trip.driverId || '');
            setEditModalOpen(true);
            return;
        }

        const updatedTrip = { ...trip, status: newStatus };
        if (newStatus === 'Ongoing') updatedTrip.startTime = new Date().toISOString();

        try {
            await api.put(`/Trips/${trip.id}`, updatedTrip);
            fetchData();
        } catch (err) {
            console.error(err);
            if (err.response?.data?.message) {
                showToast(err.response.data.message, "error");
            } else {
                showToast(t('Common.Error'), "error");
            }
        }
    };

    const getStatusBadge = (status) => {
        switch(status){
            case 'Scheduled': return <span className="badge badge-warning">{t('Status.Scheduled')}</span>;
            case 'Ongoing': return <span className="badge badge-primary" style={{backgroundColor: 'var(--primary-color)', color: 'white'}}>{t('Status.Ongoing')}</span>;
            case 'Completed': return <span className="badge badge-success">{t('Status.Completed')}</span>;
            case 'Cancelled': return <span className="badge badge-danger">{t('Status.Cancelled')}</span>;
            default: return <span className="badge">{status}</span>;
        }
    }

    const filteredTrips = trips.filter(t => 
        (t.customer?.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
        (t.driver?.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
        (t.pickupLocation?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (t.dropoffLocation?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 className="page-title">{t('TripsLog.Title')}</h1>
            </div>

            <div style={{
                position: 'relative', 
                marginBottom: '20px', 
                maxWidth: '450px',
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                padding: '4px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
                display: 'flex',
                alignItems: 'center',
                border: '1px solid #edf2f7',
                transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04)'}
            onMouseOut={(e) => e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)'}
            >
                <div style={{ padding: '0 12px', color: '#a0aec0', display: 'flex' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                </div>
                
                <input 
                    type="text" 
                    placeholder={t('TripsLog.SearchPlaceholder')} 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                        flex: 1,
                        padding: '8px 0', 
                        border: 'none', 
                        fontSize: '0.95rem', 
                        outline: 'none', 
                        background: 'transparent',
                        color: '#2d3748',
                        fontFamily: 'inherit',
                        fontWeight: '500'
                    }}
                />
                
                <div style={{
                    marginLeft: '4px',
                    background: 'linear-gradient(135deg, var(--primary-color) 0%, #2b6cb0 100%)',
                    color: 'white',
                    padding: '8px 20px',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    fontSize: '0.9rem',
                    boxShadow: '0 2px 8px rgba(49, 130, 206, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    {t('TripsLog.SearchBtn')}
                </div>
            </div>
            
            <div className="table-responsive">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>{t('TripsLog.Id')}</th>
                            <th>{t('TripsLog.Customer')}</th>
                            <th>{t('TripsLog.RouteDriver')}</th>
                            <th>{t('TripsLog.Date')}</th>
                            <th>{t('TripsLog.Status')}</th>
                            <th>{t('TripsLog.Payment')}</th>
                            <th>{t('TripsLog.Actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredTrips.map(trip => (
                            <tr key={trip.id}>
                                <td>#{trip.id}</td>
                                <td>{trip.customer?.name}</td>
                                <td>
                                    {(trip.pickupLocation || trip.dropoffLocation) && (
                                        <div style={{fontSize: '0.95rem', marginBottom: '6px', color: 'var(--primary-color)', fontWeight: 'bold'}}>
                                            {trip.pickupLocation || '?'} ⬅️ {trip.dropoffLocation || '?'}
                                        </div>
                                    )}
                                    <div style={{fontSize: '0.85rem', color: '#6b7280'}}>
                                        🚗 {trip.driver?.name}
                                    </div>
                                </td>
                                <td>
                                    {trip.scheduledFor && (
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            <div style={{display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px'}}>
                                                <span>📅</span> 
                                                <span>{new Date(trip.scheduledFor).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                            </div>
                                            <div style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
                                                <span>⏰</span>
                                                <span dir="ltr">{new Date(trip.scheduledFor).toLocaleTimeString(locale, { hour: '2-digit', minute:'2-digit' })}</span>
                                            </div>
                                        </div>
                                    )}
                                    {trip.startTime && (
                                        <div style={{ fontSize: '0.85rem', color: 'var(--success-color)' }}>
                                            {t('TripsLog.StartTime')}: {new Date(trip.startTime).toLocaleTimeString(locale, { timeZone: 'Asia/Riyadh', hour: '2-digit', minute:'2-digit' })}
                                        </div>
                                    )}
                                    {trip.endTime && (
                                        <div style={{ fontSize: '0.85rem', color: 'var(--danger-color)' }}>
                                            {t('TripsLog.EndTime')}: {new Date(trip.endTime).toLocaleTimeString(locale, { timeZone: 'Asia/Riyadh', hour: '2-digit', minute:'2-digit' })}
                                        </div>
                                    )}
                                    {(!trip.scheduledFor && !trip.startTime) && '-'}
                                </td>
                                <td>{getStatusBadge(trip.status)}</td>
                                <td>{trip.status === 'Completed' ? (trip.paymentMethod === 'Wallet' ? t('TripsLog.WalletOption') : t('TripsLog.CashOption')) : '-'}</td>
                                <td>
                                    {trip.status === 'Scheduled' && (
                                        <div style={{display:'flex', gap:'5px', flexWrap: 'wrap',  maxWidth: '180px'}}>
                                            <button className="btn btn-primary" style={{padding: '5px 8px', fontSize: '11px'}} onClick={() => updateTripStatus(trip, 'Ongoing')}>{t('TripsLog.Start')}</button>
                                            <button className="btn" style={{padding: '5px 8px', fontSize: '11px', backgroundColor: '#f3f4f6', color: '#374151'}} onClick={() => updateTripStatus(trip, 'Edit')}>{t('Common.Edit')}</button>
                                            <button className="btn btn-danger" style={{padding: '5px 8px', fontSize: '11px'}} onClick={() => updateTripStatus(trip, 'Cancelled')}>{t('Common.Cancel')}</button>
                                        </div>
                                    )}
                                    {trip.status === 'Ongoing' && (
                                        <button className="btn btn-success" style={{padding: '5px 10px', fontSize: '12px'}} onClick={() => updateTripStatus(trip, 'Completed')}>{t('TripsLog.Finish')}</button>
                                    )}
                                    {trip.status === 'Completed' && (
                                        <span style={{fontWeight:'bold', color:'var(--success-color)'}}>
                                            {hasFinancePerm ? `${trip.finalTotal} ${t('Dashboard.Currency')}` : t('TripsLog.Calculated')}
                                        </span>
                                    )}

                                </td>
                            </tr>
                        ))}
                        {trips.length === 0 && <tr><td colSpan="8" style={{textAlign:'center'}}>{t('TripsLog.Empty')}</td></tr>}
                    </tbody>
                </table>
            </div>

            {/* Modal for Editing */}
            {editModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{maxWidth: '450px', padding: '30px', borderRadius: '16px'}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #edf2f7', paddingBottom: '15px'}}>
                            <span style={{fontSize: '1.5rem'}}>✍️</span>
                            <h2 style={{margin: 0, color: 'var(--primary-color)', fontSize: '1.4rem'}}>{t('TripsLog.PostponeTitle')}</h2>
                        </div>
                        
                        <div className="form-group" style={{marginBottom: '20px'}}>
                            <label className="form-label" style={{fontWeight: 'bold', color: '#4a5568'}}>{t('TripsLog.ChangeDriver')}</label>
                            <PremiumSelect 
                                options={drivers.map(d => ({value: d.id, label: d.name}))}
                                value={newDriverId}
                                onChange={setNewDriverId}
                                placeholder={t('CreateTrip.SelectDriver')}
                            />
                        </div>
                        <div className="form-group" style={{marginBottom: '10px'}}>
                            <label className="form-label" style={{fontWeight: 'bold', color: '#4a5568'}}>{t('TripsLog.NewDate')}</label>
                            <PremiumDatePicker 
                                selected={newScheduleDate} 
                                onChange={setNewScheduleDate} 
                                minDate={new Date()} 
                                showTimeSelect={true}
                            />
                            <p style={{fontSize: '0.8rem', color: '#a0aec0', marginTop: '5px'}}>* {t('TripsLog.NewDateHint') || "يمكنك تغيير الموعد والساعة يدوياً"}</p>
                        </div>
                        
                        <div style={{display:'flex', gap:'12px', justifyContent:'flex-end', marginTop:'30px'}}>
                            <button className="btn" style={{backgroundColor: '#f7fafc', color: '#4a5568', padding: '10px 20px'}} onClick={() => setEditModalOpen(false)}>{t('Common.Cancel')}</button>
                            <button className="btn btn-primary" style={{padding: '10px 25px', boxShadow: '0 4px 6px rgba(49, 130, 206, 0.2)'}} onClick={confirmEdit}>{t('Common.Save')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal for Completion */}
            {completionModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2 style={{marginBottom:'1rem', color:'var(--primary-color)'}}>{t('TripsLog.FinishTitle')}</h2>
                        {hasFinancePerm && (
                            <>
                                <div className="form-group">
                                    <label className="form-label">{t('TripsLog.PricingType')}</label>
                                    <PremiumSelect 
                                        options={[
                                            {value: 'Fixed', label: t('TripsLog.Fixed')},
                                            {value: 'Hourly', label: t('TripsLog.Hourly')}
                                        ]}
                                        value={completionPricingType}
                                        onChange={setCompletionPricingType}
                                    />
                                </div>
                                {completionPricingType === 'Fixed' ? (
                                    <div className="form-group">
                                        <label className="form-label">{t('TripsLog.TotalAmount')}</label>
                                        <input type="number" step="0.01" className="form-control" value={completionFixedPrice} onChange={e => setCompletionFixedPrice(e.target.value)} required />
                                    </div>
                                ) : (
                                    <div className="form-group">
                                        <label className="form-label">{t('TripsLog.HourlyRate')}</label>
                                        <input type="number" step="0.01" className="form-control" value={completionHourlyRate} onChange={e => setCompletionHourlyRate(e.target.value)} required />
                                    </div>
                                )}
                            </>
                        )}


                        <div className="form-group">
                            <label className="form-label">{t('TripsLog.PaidVia')}</label>
                            <PremiumSelect 
                                options={[
                                    {value: 'Cash', label: t('TripsLog.CashOption')},
                                    {value: 'Wallet', label: t('TripsLog.WalletOption')}
                                ]}
                                value={paymentMethodForCompletion}
                                onChange={setPaymentMethodForCompletion}
                            />
                            {paymentMethodForCompletion === 'Wallet' && <small style={{color:'var(--danger-color)', marginTop:'5px', display:'block'}}>{t('TripsLog.WalletWarning')}</small>}
                        </div>

                        <div style={{display:'flex', gap:'10px', justifyContent:'flex-end', marginTop:'2rem'}}>
                            <button className="btn" onClick={() => setCompletionModalOpen(false)}>{t('Common.Cancel')}</button>
                            <button className="btn btn-success" onClick={confirmCompletion}>{t('TripsLog.ConfirmFinish')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TripsLog;
