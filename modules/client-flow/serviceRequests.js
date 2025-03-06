const Service = require("../../models/services.model");
const User = require("../../models/user.model");
const ServiceRequest = require("../../models/request.model");
const mongoose = require("mongoose");
const crypto = require("crypto");
const { redisHelper: redis } = require("../../utils/redis");

class ServiceRequestManager {
  constructor(userId) {
    this.userId = userId;
    this.cachePrefix = `tesha_service_${userId}_`;
  }

  // Generate a cryptographically secure unique request ID
  async generateUniqueRequestId() {
    const attempts = 10;

    for (let i = 0; i < attempts; i++) {
      // Generate 8 random bytes and convert to alphanumeric string
      const randomBytes = crypto.randomBytes(4); // 4 bytes gives 8 hex characters
      const id = `req_${randomBytes.toString("hex").substring(0, 8)}`;

      // Check if this ID exists in Redis cache
      const exists = await redis.exists(`request_id:${id}`);
      if (!exists) {
        // Check if ID exists in database
        const requestExists = await ServiceRequest.exists({ id });
        if (!requestExists) {
          // Cache this ID to prevent simultaneous generation of the same ID
          await redis.set(`request_id:${id}`, "1", "EX", 3600); // Cache for 1 hour
          return id;
        }
      }
    }

    // Fallback to timestamp-based ID if all attempts fail, but this should be rare
    const timestamp = Date.now().toString();
    return `req_${timestamp.slice(-8)}`;
  }

  extractCity(location) {
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

  async createServiceRequest(
    serviceType,
    description,
    location,
    preferredDate,
    preferredTime
  ) {
    console.log(`Creating service request for ${serviceType} at ${location}`);
    try {
      // Find the service in the database
      let serviceObj = await Service.findOne({
        $text: { $search: serviceType, $caseSensitive: false },
      });

      if (!serviceObj) {
        // Try to find by title
        serviceObj = await Service.findOne({
          title: { $regex: new RegExp(serviceType, "i") },
        });

        if (!serviceObj) {
          throw new Error(`Service type '${serviceType}' not found`);
        }
      }

      // Generate a unique request ID
      const requestId = await this.generateUniqueRequestId();

      // Extract city from location
      const city = this.extractCity(location);

      // Create service request in database
      const serviceRequest = new ServiceRequest({
        service: serviceObj._id,
        requester: this.userId,
        status: "Pending",
        address: {
          physicalAddress: location,
        },
        city: city,
        notes: description || "No additional details provided",
        id: requestId,
        date: preferredDate,
        time: preferredTime,
        createdAt: new Date(),
      });

      await serviceRequest.save();
      console.log(`Service request created with ID: ${requestId}`);

      // Return the created request details
      return {
        requestId,
        serviceType: serviceObj.title,
        description: description || "No description provided",
        location,
        date: preferredDate,
        time: preferredTime,
      };
    } catch (error) {
      console.error("Error creating service request:", error);
      throw new Error(`Failed to create service request: ${error.message}`);
    }
  }

  async getAvailableServices() {
    console.log("Fetching available services");
    try {
      // Try to get from cache first
      const cachedServices = await redis.get(
        `${this.cachePrefix}available_services`
      );
      if (cachedServices) {
        try {
          const services = JSON.parse(cachedServices);
          console.log(`Retrieved ${services.length} services from cache`);
          return { services };
        } catch (e) {
          console.error("Error parsing cached services:", e);
        }
      }

      // Fetch services from database
      const services = await Service.find()
        .select("title description serviceType")
        .limit(30);

      if (!services || services.length === 0) {
        throw new Error("No services found in database");
      }

      // Format services for response
      const formattedServices = services.map((service) => ({
        name: service.title,
        description: service.description || `${service.title} services`,
        types: service.serviceType || [],
      }));

      // Cache the results for 1 day
      await redis.set(
        `${this.cachePrefix}available_services`,
        JSON.stringify(formattedServices),
        "EX",
        86400
      );

      return { services: formattedServices };
    } catch (error) {
      console.error("Error fetching available services:", error);
      throw new Error(`Failed to fetch available services: ${error.message}`);
    }
  }

  async getServiceProviders(serviceType, location) {
    console.log(
      `Fetching service providers for ${serviceType} in ${
        location || "any location"
      }`
    );
    try {
      // Cache key for these specific search parameters
      const cacheKey = `${this.cachePrefix}providers_${serviceType.replace(
        /\s+/g,
        "_"
      )}_${location ? this.extractCity(location).replace(/\s+/g, "_") : "any"}`;

      // Try to get from cache first
      const cachedProviders = await redis.get(cacheKey);
      if (cachedProviders) {
        try {
          const result = JSON.parse(cachedProviders);
          console.log(
            `Retrieved ${result.providers.length} providers from cache`
          );
          return result;
        } catch (e) {
          console.error("Error parsing cached providers:", e);
        }
      }

      // Find the service in database
      let serviceObj = await Service.findOne({
        $text: { $search: serviceType, $caseSensitive: false },
      });

      if (!serviceObj) {
        // Try to find by title
        serviceObj = await Service.findOne({
          title: { $regex: new RegExp(serviceType, "i") },
        });

        if (!serviceObj) {
          throw new Error(`Service type '${serviceType}' not found`);
        }
      }

      // Extract city from location
      const city = this.extractCity(location);
      console.log(`Searching for providers in city: ${city}`);

      // Find providers offering this service in the given location
      const providers = await User.find({
        accountType: "ServiceProvider",
        services: serviceObj._id,
        ...(city && city !== "Unknown"
          ? {
              $or: [
                {
                  "address.physicalAddress": { $regex: new RegExp(city, "i") },
                },
                { "address.city": { $regex: new RegExp(city, "i") } },
              ],
            }
          : {}),
      })
        .select("_id name rating reviewCount services rate specialties")
        .limit(5);

      if (!providers || providers.length === 0) {
        throw new Error(
          `No service providers available for ${serviceType} in ${
            location || "your area"
          }`
        );
      }

      // Format providers data
      const formattedProviders = providers.map((provider) => ({
        id: provider._id.toString(),
        name: provider.name || "Unknown Provider",
        specialties: provider.specialties || [serviceType],
        rating: provider.rating || 4.5,
        reviewCount: provider.reviewCount || 20,
        rate: provider.rate || 25,
      }));

      const result = {
        serviceType: serviceObj.title,
        location: location || "Not specified",
        providers: formattedProviders,
      };

      // Cache for 1 hour
      await redis.set(cacheKey, JSON.stringify(result), "EX", 3600);

      return result;
    } catch (error) {
      console.error("Error fetching service providers:", error);
      throw new Error(`Failed to find service providers: ${error.message}`);
    }
  }
}

module.exports = ServiceRequestManager;
