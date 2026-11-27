// The logged-in user as saved at login (role and comma separated permissions).
const readUser = () => {
  try { return JSON.parse(localStorage.getItem('user') || '{}') || {}; } catch { return {}; }
};

// Admins have every permission.
export const hasPermission = (key) => {
  const user = readUser();
  return user.role === 'Admin' || (user.permissions || '').split(',').includes(key);
};

export const canCorrect = () => hasPermission('corrections');
