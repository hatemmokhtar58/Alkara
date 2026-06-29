import { useState, useEffect } from 'react';
import api from '../api';
import { useTranslation } from 'react-i18next';

import { useToast } from '../context/ToastContext';

const Drivers = ({ userRole }) => {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const isAdmin = userRole === 'Admin';
    const [drivers, setDrivers] = useState([]);
    const [trips, setTrips] = useState([]);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [baseSalary, setBaseSalary] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    
    const [statsModalOpen, setStatsModalOpen] = useState(false);
    const [selectedDriverStats, setSelectedDriverStats] = useState(null);
    const [selectedDriverName, setSelectedDriverName] = useState('');
    
    const userStr = localStorage.getItem('user') || '{}';
    const user = JSON.parse(userStr);
    const pStr = user.permissions || user.Permissions || '';
    const userPermissions = pStr ? pStr.split(',') : [];
    const role = userRole || user.role || user.Role || 'Employee';
    const hasFinancePerm = userPermissions.includes('wallet') || userPermissions.includes('reports') || role === 'Admin';
    const hasReportsPerm = userPermissions.includes('reports') || role === 'Admin';


    
    // Edit states
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingDriver, setEditingDriver] = useState(null);
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editBaseSalary, setEditBaseSalary] = useState('');

    useEffect(() => {
        fetchDrivers();
    }, []);

    const fetchDrivers = () => {
        api.get('/Drivers').then(res => setDrivers(res.data)).catch(console.error);
        api.get('/Trips').then(res => setTrips(res.data)).catch(console.error);
    }

    const driverHasActiveTrip = (driverId) => {
        return trips.some(t => t.driverId === driverId && t.status === 'Ongoing');
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        try {
            await api.post('/Drivers', { name, phone, baseSalary: parseFloat(baseSalary) || 0 });
            showToast(t('Common.Success'), 'success');
            setName(''); setPhone(''); setBaseSalary('');
            fetchDrivers();
        } catch (err) {
            console.error(err);
        }
    };

    const handleToggleStatus = async (driver) => {
        if (driverHasActiveTrip(driver.id)) {
            showToast(t('Drivers.CannotChangeStatus'), 'error');
            return;
        }
        const newStatus = driver.status === 'Available' ? 'Busy' : 'Available';
        try {
            await api.put(`/Drivers/${driver.id}`, { ...driver, status: newStatus });
            showToast(t('Common.Success'), 'success');
            fetchDrivers();
        } catch (err) {
            console.error(err);
        }
    };

    const handleViewStats = async (driver) => {
        try {
            const res = await api.get(`/Drivers/${driver.id}/stats`);
            setSelectedDriverStats(res.data);
            setSelectedDriverName(driver.name);
            setStatsModalOpen(true);
        } catch (err) {
            console.error(err);
        }
    };

    const handleEditClick = (driver) => {
        setEditingDriver(driver);
        setEditName(driver.name);
        setEditPhone(driver.phone);
        setEditBaseSalary(driver.baseSalary || '');
        setEditModalOpen(true);
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/Drivers/${editingDriver.id}`, { 
                ...editingDriver, 
                name: editName, 
                phone: editPhone,
                baseSalary: parseFloat(editBaseSalary) || 0
            });
            showToast(t('Common.Success'), 'success');
            setEditModalOpen(false);
            fetchDrivers();
        } catch (err) {
            console.error(err);
        }
    };

    const handleDelete = async (driver) => {
        if (window.confirm(t('Drivers.DeleteConfirm'))) {
            try {
                await api.delete(`/Drivers/${driver.id}`);
                showToast(t('Common.Success'), 'success');
                fetchDrivers();
            } catch (err) {
                console.error(err);
            }
        }
    };


    const filteredDrivers = drivers.filter(d => 
        (d.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
        (d.phone || '').includes(searchQuery)
    );

    return (
        <div>
            <h1 className="page-title">{t('Drivers.Title')}</h1>
            
            <div className="card" style={{ marginBottom: '2rem' }}>
                <h3 className="card-title">{t('Drivers.AddTitle')}</h3>
                <form onSubmit={handleAdd} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '200px' }}>
                        <label className="form-label">{t('Drivers.Name')}</label>
                        <input className="form-control" value={name} onChange={e => setName(e.target.value)} required />
                    </div>
                    <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '200px' }}>
                        <label className="form-label">{t('Drivers.Phone')}</label>
                        <input className="form-control" type="tel" value={phone} onChange={e => setPhone(e.target.value)} required />
                    </div>
                    <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '120px' }}>
                        <label className="form-label">الراتب الشهري</label>
                        <input className="form-control" type="number" value={baseSalary} onChange={e => setBaseSalary(e.target.value)} placeholder="0" />
                    </div>
                    <button type="submit" className="btn btn-primary">{t('Drivers.AddBtn')}</button>
                </form>
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
                <div style={{ padding: '0 12px', color: 'var(--gray-400)', display: 'flex' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                </div>
                
                <input 
                    type="text" 
                    placeholder={t('Drivers.SearchPlaceholder')} 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                        flex: 1,
                        padding: '8px 0', 
                        border: 'none', 
                        fontSize: '0.95rem', 
                        outline: 'none', 
                        background: 'transparent',
                        color: 'var(--text-dark)',
                        fontFamily: 'inherit',
                        fontWeight: '500'
                    }}
                />
                
                <div style={{
                    marginLeft: '4px',
                    background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%)',
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
                    {t('Drivers.SearchBtn')}
                </div>
            </div>

            <div className="table-responsive">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>{t('Drivers.Id')}</th>
                            <th>{t('Drivers.Name')}</th>
                            <th>{t('Drivers.Phone')}</th>
                            <th>الراتب</th>
                            <th>{t('Drivers.Status')}</th>
                            {hasReportsPerm && <th>{t('Drivers.StatsTitle')}</th>}

                            <th>{t('Common.Actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredDrivers.map((d, index) => (
                            <tr key={d.id}>
                                <td>{index + 1}</td>
                                <td>{d.name}</td>
                                <td>{d.phone}</td>
                                <td>{d.baseSalary || 0}</td>
                                <td>
                                    <button 
                                        className={`badge ${d.status === 'Available' ? 'badge-success' : 'badge-danger'}`}
                                        style={{ border: 'none', cursor: driverHasActiveTrip(d.id) ? 'not-allowed' : 'pointer', padding: '5px 10px', opacity: driverHasActiveTrip(d.id) ? 0.6 : 1 }}
                                        onClick={() => handleToggleStatus(d)}
                                        title={driverHasActiveTrip(d.id) ? t('Drivers.CannotChangeStatus') : ''}
                                    >
                                        {d.status === 'Available' ? t('Drivers.Available') : t('Drivers.Busy')}
                                    </button>
                                </td>
                                {hasReportsPerm && (
                                    <td>
                                        <button className="btn" style={{padding: '5px 10px', fontSize: '12px'}} onClick={() => handleViewStats(d)}>{t('Drivers.StatsBtn')}</button>
                                    </td>
                                )}

                                <td>
                                    <div style={{display: 'flex', gap: '5px'}}>
                                        <button 
                                            className="btn btn-secondary" 
                                            style={{padding: '5px 8px', fontSize: '11px', background: 'var(--gray-200)', color: 'var(--gray-600)'}}
                                            onClick={() => handleEditClick(d)}
                                        >
                                            {t('Common.Edit')}
                                        </button>
                                        <button 
                                            className="btn btn-danger" 
                                            style={{padding: '5px 8px', fontSize: '11px'}}
                                            onClick={() => handleDelete(d)}
                                        >
                                            {t('Common.Delete')}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredDrivers.length === 0 && <tr><td colSpan="6" style={{textAlign:'center'}}>{t('Drivers.Empty')}</td></tr>}
                    </tbody>
                </table>
            </div>

            {/* Stats Modal */}
            {statsModalOpen && selectedDriverStats && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{maxWidth: '500px'}}>
                        <h2 style={{marginBottom:'1rem', color:'var(--primary-color)'}}>
                            {t('Drivers.StatsModalTitle')} {selectedDriverName}
                        </h2>
                        
                        <div className="grid-cards" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="card" style={{padding: '1rem'}}>
                                <h4>{t('Drivers.TotalTrips')}</h4>
                                <div style={{fontSize: '2rem', color: 'var(--primary-color)'}}>{selectedDriverStats.totalTrips}</div>
                            </div>
                            {hasFinancePerm && (
                                <>
                                    <div className="card" style={{padding: '1rem'}}>
                                        <h4>{t('Drivers.TodayIncome')}</h4>
                                        <div style={{fontSize: '2rem', color: 'var(--success-color)'}}>{selectedDriverStats.todayIncome} <small style={{fontSize:'1rem'}}>{t('Dashboard.Currency')}</small></div>
                                    </div>
                                    <div className="card" style={{padding: '1rem'}}>
                                        <h4>{t('Drivers.WeekIncome')}</h4>
                                        <div style={{fontSize: '2rem', color: 'var(--success-color)'}}>{selectedDriverStats.weekIncome} <small style={{fontSize:'1rem'}}>{t('Dashboard.Currency')}</small></div>
                                    </div>
                                    <div className="card" style={{padding: '1rem'}}>
                                        <h4>{t('Drivers.MonthIncome')}</h4>
                                        <div style={{fontSize: '2rem', color: 'var(--success-color)'}}>{selectedDriverStats.monthIncome} <small style={{fontSize:'1rem'}}>{t('Dashboard.Currency')}</small></div>
                                    </div>
                                </>
                            )}
                        </div>

                        {hasFinancePerm && (
                            <div className="card" style={{marginTop: '1rem', padding: '1rem', background: 'var(--gray-50)'}}>
                                <h4>{t('Drivers.YearIncome')}</h4>
                                <div style={{fontSize: '2.5rem', color: 'var(--success-color)'}}>{selectedDriverStats.yearIncome} <small style={{fontSize:'1rem'}}>{t('Dashboard.Currency')}</small></div>
                            </div>
                        )}


                        <div style={{display:'flex', justifyContent:'flex-end', marginTop:'2rem'}}>
                            <button className="btn" onClick={() => setStatsModalOpen(false)}>{t('Drivers.Close')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{maxWidth: '400px'}}>
                        <h2 style={{marginBottom:'1.5rem', color:'var(--primary-color)'}}>{t('Drivers.EditTitle')}</h2>
                        <form onSubmit={handleUpdate}>
                            <div className="form-group">
                                <label className="form-label">{t('Drivers.Name')}</label>
                                <input className="form-control" value={editName} onChange={e => setEditName(e.target.value)} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('Drivers.Phone')}</label>
                                <input className="form-control" value={editPhone} onChange={e => setEditPhone(e.target.value)} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">الراتب الشهري</label>
                                <input className="form-control" type="number" value={editBaseSalary} onChange={e => setEditBaseSalary(e.target.value)} placeholder="0" />
                            </div>
                            <div style={{display:'flex', gap:'10px', justifyContent:'flex-end', marginTop:'2rem'}}>
                                <button type="button" className="btn" onClick={() => setEditModalOpen(false)}>{t('Common.Close')}</button>
                                <button type="submit" className="btn btn-primary">{t('Common.Save')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Drivers;
