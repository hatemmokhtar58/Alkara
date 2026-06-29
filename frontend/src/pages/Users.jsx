import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api';
import PremiumSelect from '../components/PremiumSelect';

import { useToast } from '../context/ToastContext';

const Users = () => {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Create/Edit states
    const [modalOpen, setModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('Employee');
    const [userPerms, setUserPerms] = useState([]);

    const availablePermissions = [
        { key: 'trips', icon: '🚖' },
        { key: 'fleet', icon: '🏢' },
        { key: 'expenses', icon: '💰' },
        { key: 'wallet', icon: '💳' },
        { key: 'reports', icon: '📈' },
        { key: 'users', icon: '🛡️' }
    ];

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await api.get('/Users');
            setUsers(res.data);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    const handleOpenModal = (u = null) => {
        if (u) {
            setEditingUser(u);
            setUsername(u.username || u.Username);
            setRole(u.role || u.Role || 'Employee');
            const p = u.permissions || u.Permissions || '';
            setUserPerms(p ? p.split(',') : []);

        } else {
            setEditingUser(null);
            setUsername('');
            setPassword('');
            setRole('Employee');
            setUserPerms(['trips']); // Default
        }
        setModalOpen(true);
    };

    const togglePermission = (perm) => {
        if (userPerms.includes(perm)) {
            setUserPerms(userPerms.filter(p => p !== perm));
        } else {
            setUserPerms([...userPerms, perm]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const payload = {
            id: editingUser ? editingUser.id : 0,
            username,
            passwordHash: password, // Controller hashes it
            role,
            permissions: userPerms.join(',')
        };

        try {
            if (editingUser) {
                await api.put(`/Users/${editingUser.id}`, payload);
            } else {
                await api.post('/Users', payload);
            }
            showToast(t('Common.Success'), 'success');
            setModalOpen(false);
            fetchUsers();
        } catch (err) {
            console.error(err);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm(t('Drivers.DeleteConfirm'))) {
            try {
                await api.delete(`/Users/${id}`);
                showToast(t('Common.Success'), 'success');
                fetchUsers();
            } catch (err) {
                console.error(err);
            }
        }
    };


    if (loading) return <div className="loader-container"><div className="loader"></div></div>;

    return (
        <div style={{animation: 'fadeIn 0.5s ease-out'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem'}}>
                <h1 className="page-title">{t('Users.Title')}</h1>
                <button className="btn btn-primary" onClick={() => handleOpenModal()}>{t('Users.AddBtn')}</button>
            </div>

            <div className="card" style={{padding: 0, overflow: 'hidden'}}>
                <div className="table-responsive">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>{t('Users.Username')}</th>
                                <th>{t('Users.Role')}</th>
                                <th>{t('Users.Permissions')}</th>
                                <th>{t('Common.Actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u) => (
                                <tr key={u.id}>
                                    <td>{u.id}</td>
                                    <td style={{fontWeight: 'bold'}}>{u.username}</td>
                                    <td>
                                        <span className={`badge ${u.role === 'Admin' ? 'badge-ongoing' : 'badge-completed'}`}>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{display: 'flex', gap: '5px', flexWrap: 'wrap'}}>
                                            {u.permissions && u.permissions.split(',').map(p => (
                                                <span key={p} style={{fontSize: '10px', padding: '2px 6px', background: 'var(--gray-100)', borderRadius: '4px', border: '1px solid var(--gray-200)'}}>
                                                    {t(`Users.Keys.${p}`)}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{display: 'flex', gap: '5px'}}>
                                            <button className="btn btn-secondary" style={{padding: '5px 8px', fontSize: '11px', background: 'var(--gray-200)', color: 'var(--gray-600)'}} onClick={() => handleOpenModal(u)}>{t('Common.Edit')}</button>
                                            <button className="btn btn-danger" style={{padding: '5px 8px', fontSize: '11px'}} onClick={() => handleDelete(u.id)}>{t('Common.Delete')}</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {modalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{maxWidth: '550px'}}>
                        <h2 style={{marginBottom:'1.5rem', color:'var(--primary-color)'}}>{editingUser ? t('Users.EditPermissions') : t('Users.AddBtn')}</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">{t('Users.Username')}</label>
                                <input className="form-control" value={username} onChange={e => setUsername(e.target.value)} required />
                            </div>
                            
                            {!editingUser && (
                                <div className="form-group">
                                    <label className="form-label">{t('Users.Password')}</label>
                                    <input className="form-control" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                                </div>
                            )}

                            <div className="form-group">
                                <label className="form-label">{t('Users.Role')}</label>
                                <PremiumSelect 
                                    options={[
                                        { value: 'Admin', label: 'Admin' },
                                        { value: 'Employee', label: 'Employee' }
                                    ]}
                                    value={role}
                                    onChange={setRole}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label" style={{display: 'block', marginBottom: '10px'}}>{t('Users.Permissions')}</label>
                                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
                                    {availablePermissions.map(p => (
                                        <label key={p.key} style={{display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: userPerms.includes(p.key) ? 'var(--primary-bg)' : 'var(--gray-50)', borderRadius: '8px', border: userPerms.includes(p.key) ? '1px solid var(--primary-border)' : '1px solid var(--gray-200)', cursor: 'pointer'}}>
                                            <input type="checkbox" checked={userPerms.includes(p.key)} onChange={() => togglePermission(p.key)} />
                                            <span style={{fontSize: '14px'}}>
                                                {p.icon} {t(`Users.Keys.${p.key}`)}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div style={{display:'flex', gap:'10px', justifyContent:'flex-end', marginTop:'2rem'}}>
                                <button type="button" className="btn" onClick={() => setModalOpen(false)}>{t('Common.Close')}</button>
                                <button type="submit" className="btn btn-primary">{t('Common.Save')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Users;
