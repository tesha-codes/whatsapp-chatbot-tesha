const axios = require("axios");
require('dotenv').config()

async function geocodeAddress(address) {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY; // Or use OpenStreetMap
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;

    const response = await axios.get(url);
    const { results } = response.data;

    if (results.length === 0) {
        throw new Error("Address not found.");
    }

    const { formatted_address, geometry } = results[0];
    const { lat, lng } = geometry.location;

    return {
        coordinates: [lng, lat], 
        formattedAddress: formatted_address,
    };
}

module.exports = { geocodeAddress };