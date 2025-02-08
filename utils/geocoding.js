const axios = require("axios");
require('dotenv').config();

async function geocodeAddress(address) {
    try {
        // First try Google Maps API
        if (process.env.GOOGLE_MAPS_API_KEY) {
            try {
                const result = await geocodeWithGoogleMaps(address);
                if (result) return result;
            } catch (error) {
                console.warn("Google Maps geocoding failed:", error.message);
                // Continue to fallback
            }
        }

        // Fallback to OpenStreetMap Nominatim
        return await geocodeWithOpenStreetMap(address);
    } catch (error) {
        throw new Error(`Unable to geocode address: ${error.message}`);
    }
}

async function geocodeWithGoogleMaps(address) {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;

    const response = await axios.get(url);
    const { results, status } = response.data;

    if (status === 'ZERO_RESULTS' || results.length === 0) {
        return null;
    }

    if (status !== 'OK') {
        throw new Error(`Google Maps API error: ${status}`);
    }

    const { formatted_address, geometry } = results[0];
    const { lat, lng } = geometry.location;

    return {
        coordinates: [lng, lat],
        formattedAddress: formatted_address,
        provider: 'google',
        confidence: results[0].geometry.location_type === 'ROOFTOP' ? 'high' : 'medium',
        components: results[0].address_components
    };
}

async function geocodeWithOpenStreetMap(address) {
    // OpenStreetMap Nominatim has strict usage limits (1 request per second)
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;

    const response = await axios.get(url, {
        headers: {
            'User-Agent': 'YourAppName/1.0' // Required by Nominatim's terms of use
        }
    });

    if (!response.data || response.data.length === 0) {
        throw new Error('Location not found in both Google Maps and OpenStreetMap');
    }

    const result = response.data[0];

    return {
        coordinates: [parseFloat(result.lon), parseFloat(result.lat)],
        formattedAddress: result.display_name,
        provider: 'osm',
        confidence: 'medium',
        components: {
            city: result.address?.city,
            country: result.address?.country
        }
    };
}

// Helper function to validate coordinates
function isValidCoordinates(coordinates) {
    const [lng, lat] = coordinates;
    return Array.isArray(coordinates) &&
        coordinates.length === 2 &&
        !isNaN(lat) && !isNaN(lng) &&
        lat >= -90 && lat <= 90 &&
        lng >= -180 && lng <= 180;
}

function parseCoordinates(input) {
    try {
        // Handle "lat,lng" format
        const [lat, lng] = input.split(',').map(coord => parseFloat(coord.trim()));
        if (isValidCoordinates([lng, lat])) {
            return {
                coordinates: [lng, lat],
                formattedAddress: `${lat}, ${lng}`,
                provider: 'manual',
                confidence: 'high'
            };
        }
    } catch (error) {
        return null;
    }
}

module.exports = {
    geocodeAddress,
    isValidCoordinates,
    parseCoordinates
};