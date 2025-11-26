// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import RealTimePage from './pages/RealTimePage';
import ReplayPage from './pages/ReplayPage';
import './App.css';

function App() {
  return (
    <Router basename="/tx-observer">
      <Layout>
        <Routes>
          <Route path="/" element={<RealTimePage />} />
          <Route path="/replay" element={<ReplayPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
