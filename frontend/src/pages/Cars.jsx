import { useState, useEffect } from 'react';
import api from '../api';
import { useTranslation } from 'react-i18next';

import { useToast } from '../context/ToastContext';

const Cars = () => {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [cars, setCars] = useState([]);

    const [make, setMake] = useState('');
    const [model, setModel] = useState('');
    const [year, setYear] = useState('');
    const [color, setColor] = useState('');
    const [plateNumber, setPlateNumber] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const [statsModalOpen, setStatsModalOpen] = useState(false);
    const [selectedCarStats, setSelectedCarStats] = useState(null);
    const [carStatsData, setCarStatsData] = useState(null);

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userPermissions = user.permissions ? user.permissions.split(',') : [];
    const hasFinancePerm = userPermissions.includes('expenses') || userPermissions.includes('wallet') || userPermissions.includes('reports') || user.role === 'Admin';

    
    // Edit states
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingCar, setEditingCar] = useState(null);
    const [editMake, setEditMake] = useState('');
    const [editModel, setEditModel] = useState('');
    const [editYear, setEditYear] = useState('');
    const [editColor, setEditColor] = useState('');
    const [editPlateNumber, setEditPlateNumber] = useState('');

    useEffect(() => {
        fetchCars();
    }, []);

    const fetchCars = () => {
        api.get('/Cars').then(res => setCars(res.data)).catch(console.error);
    }

    const handleAdd = async (e) => {
        e.preventDefault();
        try {
            await api.post('/Cars', { 
                make, 
                model, 
                year: year ? parseInt(year) : null,
                color,
                plateNumber 
            });
            showToast(t('Cars.Success'), 'success');
            setMake(''); setModel(''); setYear(''); setColor(''); setPlateNumber('');
            fetchCars();
        } catch (err) {
            console.error(err);
        }
    };


    const handleToggleStatus = async (car) => {
        const newStatus = car.status === 'Available' ? 'Busy' : 'Available';
        try {
            await api.put(`/Cars/${car.id}`, { ...car, status: newStatus });
            showToast(t('Common.Success'), 'success');
            fetchCars();
        } catch (err) {
            console.error(err);
        }

    };


    const handleViewStats = async (car) => {
        try {
            const res = await api.get(`/Cars/${car.id}/stats`);
            setCarStatsData(res.data);
            setStatsModalOpen(true);
        } catch(err) {
            console.error(err);
        }
    };


    const handleEditClick = (car) => {
        setEditingCar(car);
        setEditMake(car.make);
        setEditModel(car.model);
        setEditYear(car.year || '');
        setEditColor(car.color || '');
        setEditPlateNumber(car.plateNumber);
        setEditModalOpen(true);
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/Cars/${editingCar.id}`, { 
                ...editingCar, 
                make: editMake, 
                model: editModel,
                year: editYear ? parseInt(editYear) : null,
                color: editColor,
                plateNumber: editPlateNumber
            });
            showToast(t('Common.Success'), 'success');
            setEditModalOpen(false);
            fetchCars();
        } catch (err) {
            console.error(err);
        }

    };


    const handleDelete = async (car) => {
        if (window.confirm(t('Cars.DeleteConfirm'))) {
            try {
                await api.delete(`/Cars/${car.id}`);
                showToast(t('Common.Success'), 'success');
                fetchCars();
            } catch (err) {
                console.error(err);
            }

        }
    };


    const filteredCars = cars.filter(c => 
        (c.make?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
        (c.model?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
        (c.plateNumber?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );

    return (
        <div>
            <h1 className="page-title">{t('Cars.Title')}</h1>
            
            <div className="card" style={{ marginBottom: '2rem' }}>
                <h3 className="card-title">{t('Cars.AddTitle')}</h3>
                <form onSubmit={handleAdd} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '150px' }}>
                        <label className="form-label">{t('Cars.Make')}</label>
                        <input className="form-control" placeholder={t('Cars.MakePh')} value={make} onChange={e => setMake(e.target.value)} required />
                    </div>
                    <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '150px' }}>
                        <label className="form-label">{t('Cars.Model')}</label>
                        <input className="form-control" placeholder={t('Cars.ModelPh')} value={model} onChange={e => setModel(e.target.value)} required />
                    </div>
                    <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '100px' }}>
                        <label className="form-label">{t('Cars.Year')}</label>
                        <input className="form-control" type="number" placeholder={t('Cars.YearPh')} value={year} onChange={e => setYear(e.target.value)} />
                    </div>
                    <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '100px' }}>
                        <label className="form-label">{t('Cars.Color')}</label>
                        <input className="form-control" placeholder={t('Cars.ColorPh')} value={color} onChange={e => setColor(e.target.value)} />
                    </div>
                    <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '150px' }}>
                        <label className="form-label">{t('Cars.Plate')}</label>
                        <input className="form-control" value={plateNumber} onChange={e => setPlateNumber(e.target.value)} required />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{backgroundColor: '#E53E3E'}}>{t('Cars.AddBtn')}</button>
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
                <div style={{ padding: '0 12px', color: '#a0aec0', display: 'flex' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                </div>
                
                <input 
                    type="text" 
                    placeholder={t('Cars.SearchPlaceholder')} 
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
                    {t('Cars.SearchBtn')}
                </div>
            </div>

            <div className="table-responsive">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>{t('Cars.Id')}</th>
                            <th>{t('Cars.Make')}</th>
                            <th>{t('Cars.Model')}</th>
                            <th>{t('Cars.Year')}</th>
                            <th>{t('Cars.Color')}</th>
                            <th>{t('Cars.Plate')}</th>
                            <th>{t('Cars.Status')}</th>
                            <th>{t('Cars.Stats')}</th>
                            <th>{t('Common.Actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredCars.map((c, index) => (
                            <tr key={c.id}>
                                <td>{index + 1}</td>
                                <td>{c.make}</td>
                                <td>{c.model}</td>
                                <td>{c.year || '-'}</td>
                                <td>{c.color || '-'}</td>
                                <td><span className="badge badge-warning">{c.plateNumber}</span></td>
                                <td>
                                    <button 
                                        className={`badge ${c.status === 'Available' ? 'badge-success' : 'badge-danger'}`}
                                        style={{ border: 'none', cursor: 'pointer', padding: '5px 10px' }}
                                        onClick={() => handleToggleStatus(c)}
                                    >
                                        {c.status === 'Available' ? t('Cars.Available') : t('Cars.Busy')}
                                    </button>
                                </td>
                                <td>
                                    <button className="btn btn-secondary" style={{padding: '4px 10px', fontSize: '13px', background: '#3b82f6', color: 'white'}} onClick={() => handleViewStats(c)}>
                                        {t('Cars.StatsBtn')}
                                    </button>
                                </td>
                                <td>
                                    <div style={{display: 'flex', gap: '5px'}}>
                                        <button 
                                            className="btn btn-secondary" 
                                            style={{padding: '5px 8px', fontSize: '11px', background: '#e2e8f0', color: '#4a5568'}}
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
                        {filteredCars.length === 0 && <tr><td colSpan="8" style={{textAlign:'center'}}>{t('Cars.Empty')}</td></tr>}
                    </tbody>
                </table>
            </div>

            {/* Stats Modal */}
            {statsModalOpen && selectedCarStats && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{maxWidth: '850px', padding: '40px', borderRadius: '16px'}}>
                        
                        <div style={{borderBottom: '1px solid #e2e8f0', paddingBottom: '20px', marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                            <h2 style={{color: 'var(--primary-color)', margin: 0, fontSize: '1.5rem', fontWeight: 'bold'}}>
                                    {t('Drivers.StatsModalTitle')} 
                                    <span style={{color: '#64748b', fontSize: '1.1rem', marginRight: '10px', fontWeight: 'normal'}}>
                                        ( {selectedCarStats.make} {selectedCarStats.model} )
                                    </span>
                                </h2>
                                <span style={{fontSize: '0.9rem', backgroundColor: '#f1f5f9', color: '#334155', padding: '6px 12px', borderRadius: '8px', fontWeight: 'bold', border: '1px solid #cbd5e1'}}>
                                    {t('Cars.Plate')}: {selectedCarStats.plateNumber}
                                </span>
                        </div>
                        
                        <div style={{display: 'flex', gap: '25px'}}>
                            
                            {/* Trips Area */}
                            <div style={{flex: 1, backgroundColor: '#f8fafc', padding: '25px', borderRadius: '16px', border: '1px solid #e2e8f0'}}>
                                <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '30px'}}>
                                    <div style={{width: '45px', height: '45px', borderRadius: '12px', backgroundColor: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem'}}>
                                        📍
                                    </div>
                                    <h3 style={{margin: 0, fontSize: '1.25rem', color: '#1e293b'}}>{t('Drivers.TotalTrips')}</h3>
                                </div>
                                
                                <div style={{textAlign: 'center', marginBottom: '30px'}}>
                                    <p style={{color: '#64748b', fontSize: '0.95rem', marginBottom: '8px'}}>{t('Statements.Tabs.Trips')}</p>
                                    <p style={{fontSize: '3rem', fontWeight: 'bold', color: '#0f172a', margin: 0, lineHeight: 1}}>{carStatsData?.trips?.total}</p>
                                </div>

                                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px'}}>
                                    <div style={{backgroundColor: '#ffffff', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.02)'}}>
                                        <span style={{color: '#64748b', fontSize: '0.9rem'}}>{t('Statements.Ranges.Today')}</span>
                                        <span style={{fontWeight: 'bold', color: '#3b82f6', fontSize: '1.2rem'}}>{carStatsData?.trips?.today}</span>
                                    </div>
                                    <div style={{backgroundColor: '#ffffff', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.02)'}}>
                                        <span style={{color: '#64748b', fontSize: '0.9rem'}}>{t('Drivers.WeekIncome')}</span>
                                        <span style={{fontWeight: 'bold', color: '#3b82f6', fontSize: '1.2rem'}}>{carStatsData?.trips?.week}</span>
                                    </div>
                                    <div style={{backgroundColor: '#ffffff', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.02)'}}>
                                        <span style={{color: '#64748b', fontSize: '0.9rem'}}>{t('Statements.Ranges.ThisMonth')}</span>
                                        <span style={{fontWeight: 'bold', color: '#3b82f6', fontSize: '1.2rem'}}>{carStatsData?.trips?.month}</span>
                                    </div>
                                    <div style={{backgroundColor: '#ffffff', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.02)'}}>
                                        <span style={{color: '#64748b', fontSize: '0.9rem'}}>{t('Statements.Ranges.ThisYear')}</span>
                                        <span style={{fontWeight: 'bold', color: '#3b82f6', fontSize: '1.2rem'}}>{carStatsData?.trips?.year}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Expenses Area */}
                            {hasFinancePerm && (
                                <div style={{flex: 1, backgroundColor: '#fef2f2', padding: '25px', borderRadius: '16px', border: '1px solid #fecaca'}}>
                                    <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '30px'}}>
                                        <div style={{width: '45px', height: '45px', borderRadius: '12px', backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem'}}>
                                            💸
                                        </div>
                                        <h3 style={{margin: 0, fontSize: '1.25rem', color: '#991b1b'}}>{t('Statements.Tabs.Expenses')}</h3>
                                    </div>
                                    
                                    <div style={{textAlign: 'center', marginBottom: '30px'}}>
                                        <p style={{color: '#991b1b', fontSize: '0.95rem', marginBottom: '8px'}}>{t('Statements.Tabs.Expenses')}</p>
                                        <p style={{fontSize: '3rem', fontWeight: 'bold', color: '#7f1d1d', margin: 0, lineHeight: 1}}>
                                            {carStatsData?.expenses?.total} <span style={{fontSize: '1.2rem', color: '#991b1b'}}>{t('Dashboard.Currency')}</span>
                                        </p>
                                    </div>

                                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px'}}>
                                        <div style={{backgroundColor: '#ffffff', padding: '12px 16px', borderRadius: '10px', border: '1px solid #fecaca', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.02)'}}>
                                            <span style={{color: '#991b1b', fontSize: '0.9rem'}}>{t('Statements.Ranges.Today')}</span>
                                            <span style={{fontWeight: 'bold', color: '#dc2626', fontSize: '1.1rem'}}>{carStatsData?.expenses?.today}</span>
                                        </div>
                                        <div style={{backgroundColor: '#ffffff', padding: '12px 16px', borderRadius: '10px', border: '1px solid #fecaca', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.02)'}}>
                                            <span style={{color: '#991b1b', fontSize: '0.9rem'}}>{t('Drivers.WeekIncome')}</span>
                                            <span style={{fontWeight: 'bold', color: '#dc2626', fontSize: '1.1rem'}}>{carStatsData?.expenses?.week}</span>
                                        </div>
                                        <div style={{backgroundColor: '#ffffff', padding: '12px 16px', borderRadius: '10px', border: '1px solid #fecaca', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.02)'}}>
                                            <span style={{color: '#991b1b', fontSize: '0.9rem'}}>{t('Statements.Ranges.ThisMonth')}</span>
                                            <span style={{fontWeight: 'bold', color: '#dc2626', fontSize: '1.1rem'}}>{carStatsData?.expenses?.month}</span>
                                        </div>
                                        <div style={{backgroundColor: '#ffffff', padding: '12px 16px', borderRadius: '10px', border: '1px solid #fecaca', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.02)'}}>
                                            <span style={{color: '#991b1b', fontSize: '0.9rem'}}>{t('Statements.Ranges.ThisYear')}</span>
                                            <span style={{fontWeight: 'bold', color: '#dc2626', fontSize: '1.1rem'}}>{carStatsData?.expenses?.year}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                        </div>

                        <div style={{marginTop: '30px', textAlign: 'center'}}>
                            <button className="btn" onClick={() => setStatsModalOpen(false)} style={{backgroundColor: '#f1f5f9', color: '#334155', padding: '10px 40px', fontSize: '1.1rem', fontWeight: 'bold', border: '1px solid #cbd5e1', borderRadius: '8px'}}>{t('Common.Close')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{maxWidth: '500px'}}>
                        <h2 style={{marginBottom:'1.5rem', color:'var(--primary-color)'}}>{t('Cars.EditTitle')}</h2>
                        <form onSubmit={handleUpdate}>
                            <div className="form-group">
                                <label className="form-label">{t('Cars.Make')}</label>
                                <input className="form-control" value={editMake} onChange={e => setEditMake(e.target.value)} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('Cars.Model')}</label>
                                <input className="form-control" value={editModel} onChange={e => setEditModel(e.target.value)} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('Cars.Year')}</label>
                                <input className="form-control" type="number" value={editYear} onChange={e => setEditYear(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('Cars.Color')}</label>
                                <input className="form-control" value={editColor} onChange={e => setEditColor(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('Cars.Plate')}</label>
                                <input className="form-control" value={editPlateNumber} onChange={e => setEditPlateNumber(e.target.value)} required />
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

export default Cars;
