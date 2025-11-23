// src/config.js
const config = {
    API_BASE_URL: process.env.NODE_ENV === 'production'
        ? 'https://web-production-74f6.up.railway.app'
        : 'http://localhost:5000'
};

export default config;
