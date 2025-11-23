// src/config.js
const config = {
    // Use VITE_API_URL if defined, otherwise default to localhost
    API_BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:5000'
};

export default config;
