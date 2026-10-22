import {pickControlServer} from '../utils/deviceControlUrl.js';

const default_api = import.meta.env.VITE_DEFAULT_SERVER_URL || 'http://localhost:8081/v1/api';

// API endpoints
export const API_ENDPOINTS = {
    // Authentication
    AUTH: {
        LOGIN: `${default_api}/auth/login`,
        REGISTER: `${default_api}/auth/register`,
        VERIFY: `${default_api}/auth/verify`,
        RESET_PASSWORD: `${default_api}/auth/reset-password`,
    },
    // Admin
    ADMIN: {
        REPORTS: `${default_api}/admin/reports`,
    },
    // Parking Stations
    STATIONS: {
        BASE: `${default_api}/station`,
        GET_ALL: `${default_api}/station`,
        GET_BY_ID: (id) => `${default_api}/station/${id}`,
        CREATE: `${default_api}/station`,
        UPDATE: (id) => `${default_api}/station/${id}`,
        DELETE: (id) => `${default_api}/station/${id}`,
    },
};

export const server =default_api;
export const presence_server =  import.meta.env.VITE_PRESENCE_EYE_SERVER_URL;
// Where device-control calls go (see utils/deviceControlUrl.js); the normal server unless configured.
export const presence_control_server = pickControlServer(import.meta.env);
