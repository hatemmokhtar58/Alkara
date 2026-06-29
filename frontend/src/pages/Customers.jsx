import { useState, useEffect } from 'react';
import api from '../api';
import { useTranslation } from 'react-i18next';

import { useToast } from '../context/ToastContext';

const Customers = () => {
    const { t, i18n } = useTranslation();
    const { showToast } = useToast();
    const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
    const [customers, setCustomers] = useState([]);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const [statsModalOpen, setStatsModalOpen] = useState(false);
    const [selectedCustomerStats, setSelectedCustomerStats] = useState(null);
    const [customerStatsData, setCustomerStatsData] = useState(null);
    
    const userStr = localStorage.getItem('user') || '{}';
    const user = JSON.parse(userStr);
    const pStr = user.permissions || user.Permissions || '';
    const userPermissions = pStr ? pStr.split(',') : [];
    const role = user.role || user.Role || 'Employee';
    const hasFinancePerm = userPermissions.includes('wallet') || userPermissions.includes('reports') || role === 'Admin';


    
    // Edit states
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');

    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = () => {
        api.get('/Customers').then(res => setCustomers(res.data)).catch(console.error);
    }

    const handleAdd = async (e) => {
        e.preventDefault();
        try {
            await api.post('/Customers', { name, phone });
            showToast(t('Common.Success'), 'success');
            setName(''); setPhone('');
            fetchCustomers();
        } catch (err) {
            console.error(err);
        }
    };

    const handleViewStats = async (customer) => {
        try {
            const res = await api.get(`/Customers/${customer.id}/stats`);
            setCustomerStatsData(res.data);
            setSelectedCustomerStats(customer);
            setStatsModalOpen(true);
        } catch(err) {
            console.error(err);
        }
    };

    const handleEditClick = (customer) => {
        setEditingCustomer(customer);
        setEditName(customer.name);
        setEditPhone(customer.phone);
        setEditModalOpen(true);
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/Customers/${editingCustomer.id}`, { 
                ...editingCustomer, 
                name: editName, 
                phone: editPhone 
            });
            showToast(t('Common.Success'), 'success');
            setEditModalOpen(false);
            fetchCustomers();
        } catch (err) {
            console.error(err);
        }
    };

    const handleDelete = async (customer) => {
        if (window.confirm(t('Customers.DeleteConfirm'))) {
            try {
                await api.delete(`/Customers/${customer.id}`);
                showToast(t('Common.Success'), 'success');
                fetchCustomers();
            } catch (err) {
                console.error(err);
            }
        }
    };


    const filteredCustomers = customers.filter(c => 
        (c.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
        (c.phone || '').includes(searchQuery)
    );

    return (
        <div>
            <h1 className="page-title">{t('Customers.Title')}</h1>
            
            <div className="card" style={{ marginBottom: '2rem' }}>
                <h3 className="card-title">{t('Customers.AddTitle')}</h3>
                <form onSubmit={handleAdd} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '200px' }}>
                        <label className="form-label">{t('Customers.Name')}</label>
                        <input className="form-control" value={name} onChange={e => setName(e.target.value)} required />
                    </div>
                    <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '200px' }}>
                        <label className="form-label">{t('Customers.Phone')}</label>
                        <input className="form-control" type="tel" value={phone} onChange={e => setPhone(e.target.value)} required />
                    </div>
                    <button type="submit" className="btn btn-secondary">{t('Customers.AddBtn')}</button>
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
                    placeholder={t('Customers.SearchPlaceholder')} 
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
                    {t('Customers.SearchBtn')}
                </div>
            </div>

            <div className="table-responsive">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>{t('Customers.Id')}</th>
                            <th>{t('Customers.Name')}</th>
                            <th>{t('Customers.Phone')}</th>
                            <th>{t('Customers.Date')}</th>
                            <th>{t('Customers.Stats')}</th>
                            <th>{t('Common.Actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredCustomers.map((c, index) => (
                            <tr key={c.id}>
                                <td>{index + 1}</td>
                                <td>{c.name}</td>
                                <td>{c.phone}</td>
                                <td>{new Date(c.createdAt).toLocaleDateString(locale)}</td>
                                <td>
                                    <button className="btn btn-secondary" style={{padding: '4px 10px', fontSize: '13px', background: 'var(--primary-color)', color: 'white'}} onClick={() => handleViewStats(c)}>
                                        {t('Customers.StatsBtn')}
                                    </button>
                                </td>
                                <td>
                                    <div style={{display: 'flex', gap: '5px'}}>
                                        <button 
                                            className="btn btn-secondary" 
                                            style={{padding: '5px 8px', fontSize: '11px', background: 'var(--gray-200)', color: 'var(--gray-600)'}}
                                            onClick={() => handleEditClick(c)}
                                        >
                                            {t('Common.Edit')}
                                        </button>
                                        <button 
                                            className="btn btn-danger" 
                                            style={{padding: '5px 8px', fontSize: '11px'}}
                                            onClick={() => handleDelete(c)}
                                        >
                                            {t('Common.Delete')}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredCustomers.length === 0 && <tr><td colSpan="5" style={{textAlign:'center'}}>{t('Customers.Empty')}</td></tr>}
                    </tbody>
                </table>
            </div>

        {/* Stats Modal */}
            {statsModalOpen && selectedCustomerStats && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{maxWidth: '500px'}}>
                        <h2 style={{color: 'var(--primary-color)', textAlign: 'center', marginBottom: '2rem'}}>{t('Drivers.StatsModalTitle')} {selectedCustomerStats.name}</h2>
                        
                        <div style={{display: 'grid', gridTemplateColumns: hasFinancePerm ? '1fr 1fr' : '1fr', gap: '15px'}}>
                            <div style={{border: '1px solid var(--gray-200)', padding: '20px', borderRadius: '10px', textAlign: 'center'}}>
                                <p style={{fontWeight: 'bold', marginBottom: '10px', fontSize: '1.1rem'}}>{t('Drivers.TotalTrips')}</p>
                                <span style={{fontSize: '2.5rem', color: 'var(--primary-color)'}}>{customerStatsData?.totalTrips}</span>
                            </div>
                            {hasFinancePerm && (
                                <div style={{border: '1px solid var(--gray-200)', padding: '20px', borderRadius: '10px', textAlign: 'center'}}>
                                    <p style={{fontWeight: 'bold', marginBottom: '10px', fontSize: '1.2rem'}}>{t('TripsLog.TotalAmount')}</p>
                                    <span style={{fontSize: '2.5rem', color: 'var(--success-color)'}}>{customerStatsData?.yearSpent}</span> <span style={{fontSize: '1rem', color: 'var(--success-color)'}}>{t('Dashboard.Currency')}</span>
                                </div>
                            )}
                        </div>


                        <div style={{marginTop: '2rem', textAlign: 'end'}}>
                            <button className="btn" onClick={() => setStatsModalOpen(false)} style={{backgroundColor: 'var(--gray-200)', color: 'var(--gray-900)'}}>{t('Common.Close')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{maxWidth: '400px'}}>
                        <h2 style={{marginBottom:'1.5rem', color:'var(--primary-color)'}}>{t('Customers.EditTitle')}</h2>
                        <form onSubmit={handleUpdate}>
                            <div className="form-group">
                                <label className="form-label">{t('Customers.Name')}</label>
                                <input className="form-control" value={editName} onChange={e => setEditName(e.target.value)} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('Customers.Phone')}</label>
                                <input className="form-control" value={editPhone} onChange={e => setEditPhone(e.target.value)} required />
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

export default Customers;
