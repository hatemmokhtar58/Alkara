import { NavLink } from 'react-router-dom';

// Switch between closely related pages (daily / monthly / yearly, add / log) without going back to the menu.
export default function PageTabs({ tabs }) {
    return (
        <div className="page-tabs no-print">
            {tabs.map(tab => (
                <NavLink key={tab.path} to={tab.path} end className={({ isActive }) => `page-tab ${isActive ? 'active' : ''}`}>
                    {tab.label}
                </NavLink>
            ))}
        </div>
    );
}
