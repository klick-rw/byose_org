// Calls that the PresenceEye backend turns into MQTT messages for a device ("device control") must go to the
// host that holds the broker connection: Google App Engine. The Vercel host serves plain HTTP only and does
// not connect to the broker. Until VITE_PRESENCE_EYE_CONTROL_SERVER_URL is set, they keep using the normal
// PresenceEye server, so nothing changes by deploying this alone.

/** Base URL for device-control calls: the control server if configured, otherwise the normal server. */
export const pickControlServer = (env) =>
    env.VITE_PRESENCE_EYE_CONTROL_SERVER_URL || env.VITE_PRESENCE_EYE_SERVER_URL;

/** URL of the lock/unlock device logs call (the backend publishes LOCK_LOGS / UNLOCK_LOGS over MQTT). */
export const deviceLogsUrl = (base, serialNumber) =>
    `${base}/api/admin/remotes/${serialNumber}/logs`;
