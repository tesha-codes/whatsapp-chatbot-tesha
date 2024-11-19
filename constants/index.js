const CONSTANTS = {
    SESSION_TIMEOUT: 24 * 60 * 60 * 1000, 
    MAX_LOCATION_HISTORY: 5, 
    LOCATION_SEARCH_RADIUS: 10000, 
    PROVIDER_SEARCH_TIMEOUT: 30 * 60 * 1000, 
    MAX_PROVIDER_RETRIES: 3, 
    PROVIDER_SEARCH_INTERVAL: 5 * 60 * 1000, 
    MIN_PROVIDER_RATING: 3.0,
    REQUEST_EXPIRY: 60 * 60 * 1000, 
    MAX_ACTIVE_REQUESTS: 3, 
    REQUEST_CANCELLATION_WINDOW: 10 * 60 * 1000, 
    MAX_REQUESTS_PER_HOUR: 10, 
    RATE_LIMIT_RESET: 60 * 60 * 1000, 
    MESSAGES: {
        PROVIDER_NOT_FOUND: "No service providers available at this time.",
        REQUEST_EXPIRED: "Your service request has expired.",
        RATE_LIMIT_EXCEEDED: "You have exceeded the maximum number of requests allowed.",
        INVALID_LOCATION: "Please provide a valid location within our service area."
    },
    SERVICE_AREA_BOUNDS: {
        MIN_LATITUDE: -90,
        MAX_LATITUDE: 90,
        MIN_LONGITUDE: -180,
        MAX_LONGITUDE: 180
    },

    STATUS: {
        PENDING: 'PENDING',
        PROVIDER_FOUND: 'PROVIDER_FOUND',
        PROVIDER_REJECTED: 'PROVIDER_REJECTED',
        ACCEPTED: 'ACCEPTED',
        COMPLETED: 'COMPLETED',
        CANCELLED: 'CANCELLED',
        EXPIRED: 'EXPIRED',
        NO_PROVIDER_FOUND: 'NO_PROVIDER_FOUND'
    },

    CACHE_TTL: {
        PROVIDER_LIST: 5 * 60, 
        USER_PROFILE: 15 * 60, 
        SERVICE_CATEGORIES: 60 * 60, 
        LOCATION_GEOCODE: 24 * 60 * 60 
    },

    VALIDATION: {
        MIN_NAME_LENGTH: 5,
        MAX_NAME_LENGTH: 50,
        PHONE_REGEX: /^\+?[1-9]\d{1,14}$/,
        ID_NUMBER_REGEX: /^(\d{2})-(\d{7})-([A-Z])-(\d{2})$/,
        MIN_ADDRESS_LENGTH: 10,
        MAX_ADDRESS_LENGTH: 200
    }
};

Object.freeze(CONSTANTS);

module.exports = CONSTANTS;