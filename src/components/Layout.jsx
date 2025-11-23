// src/components/Layout.jsx
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LineChart, History } from 'lucide-react';
import './Layout.css';

const Layout = ({ children }) => {
    const location = useLocation();

    return (
        <div className="app-container">
            <nav className="sidebar">
                <div className="logo">
                    <h2>TX Observer</h2>
                </div>
                <ul className="nav-links">
                    <li>
                        <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
                            <LineChart size={20} />
                            <span>即時盤勢</span>
                        </Link>
                    </li>
                    <li>
                        <Link to="/replay" className={location.pathname === '/replay' ? 'active' : ''}>
                            <History size={20} />
                            <span>歷史回放</span>
                        </Link>
                    </li>
                </ul>
            </nav>
            <main className="main-content">
                {children}
            </main>
        </div>
    );
};

export default Layout;
