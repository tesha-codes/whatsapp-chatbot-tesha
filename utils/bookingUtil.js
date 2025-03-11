const crypto = require("crypto");
const ServiceRequest = require("../models/request.model");
const cityLookupService = require("./cityLookup");
class BookingUtil {
  static async generateUniqueBookingId() {
    const attempts = 10;
    for (let i = 0; i < attempts; i++) {
      // Generate 8 random bytes and convert to alphanumeric string
      const randomBytes = crypto.randomBytes(4); // 4 bytes gives 8 hex characters
      const id = `REQ${randomBytes
        .toString("hex")
        .substring(0, 8)
        .toUpperCase()}`;

      // Check if ID exists in database
      const bookingExists = await ServiceRequest.exists({ id });
      if (!bookingExists) {
        return id;
      }
    }
    // Fallback to timestamp-based ID if all attempts fail, but this should be rare
    const timestamp = Date.now().toString();
    return `REQ${timestamp.slice(-8)}`;
  }
  static extractCity(location) {
    if (!location) return "Unknown";

    // Try different patterns to extract city
    const cityMatch = location.match(/in\s+([A-Za-z\s]+)$/i);
    if (cityMatch && cityMatch[1]) {
      return cityMatch[1].trim();
    }

    const splitLocation = location.split(",");
    if (splitLocation.length > 1) {
      return splitLocation[splitLocation.length - 1].trim();
    }

    const words = location.split(" ");
    if (words.length > 0) {
      return words[words.length - 1].trim();
    }

    return "Unknown";
  }
  static getCity(location) {
    const result = cityLookupService.lookupFromText(location);
    // 
    if (result) {
      console.log(
        `✓ Found: ${result.matchedLocation} -> ${result.city} (Confidence: ${result.confidence})`
      );
      return result.city;
    } else {
      console.log(`✗ No location found, falling back to manual lookup`);
      return extractCity(location);
    }
  }
}

module.exports = BookingUtil;
