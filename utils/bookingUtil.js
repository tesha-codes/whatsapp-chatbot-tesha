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
    if (!location || typeof location !== 'string') return "Unknown";

    // Clean and normalize the location string
    const cleanLocation = location.trim();
    if (cleanLocation === '') return "Unknown";

    try {
      // Try different patterns to extract city
      const cityMatch = cleanLocation.match(/in\s+([A-Za-z\s]+)$/i);
      if (cityMatch && cityMatch[1]) {
        return cityMatch[1].trim();
      }

      const splitLocation = cleanLocation.split(",");
      if (splitLocation.length > 1) {
        return splitLocation[splitLocation.length - 1].trim();
      }

      const words = cleanLocation.split(" ");
      if (words.length > 0) {
        return words[words.length - 1].trim();
      }

      return "Unknown";
    } catch (error) {
      console.error("Error in extractCity:", error);
      return "Unknown";
    }
  }
  static getCity(location) {
    if (!location || typeof location !== 'string') {
      console.log("✗ Invalid location provided, returning 'Unknown'");
      return "Unknown";
    }

    try {
      const result = cityLookupService.lookupFromText(location);
      
      if (result) {
        console.log(
          `✓ Found: ${result.matchedLocation} -> ${result.city} (Confidence: ${result.confidence})`
        );
        return result.city;
      } else {
        console.log(`✗ No location found, falling back to manual lookup`);
        return BookingUtil.extractCity(location);
      }
    } catch (error) {
      console.error("Error in getCity:", error);
      console.log("Falling back to manual extraction");
      return BookingUtil.extractCity(location);
    }
  }
}

module.exports = BookingUtil;
