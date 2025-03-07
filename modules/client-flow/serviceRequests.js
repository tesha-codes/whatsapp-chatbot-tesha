const Service = require("./../../models/services.model");
const User = require("./../../models/user.model");
const ServiceProvider = require("./../../models/serviceProvider.model");
const ServiceRequest = require("../../models/request.model");
const crypto = require("crypto");
const serviceMatcher = require("../../utils/serviceMatchingUtil");
const dateParser = require("../../utils/dateParser");

class ServiceRequestManager {
  constructor(userId) {
    this.userId = userId;
  }

  async generateUniqueRequestId() {
    const attempts = 10;

    for (let i = 0; i < attempts; i++) {
      // Generate 8 random bytes and convert to alphanumeric string
      const randomBytes = crypto.randomBytes(4); // 4 bytes gives 8 hex characters
      const id = `REQ${randomBytes.toString("hex").substring(0, 8)}`;

      // Check if ID exists in database directly (no Redis cache check)
      const requestExists = await ServiceRequest.exists({ id });
      if (!requestExists) {
        return id;
      }
    }

    // Fallback to timestamp-based ID if all attempts fail, but this should be rare
    const timestamp = Date.now().toString();
    return `REQ${timestamp.slice(-8)}`;
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
      // Parse date and time if provided
      let finalDate = new Date();
      let finalTime = "12:00";
      let formattedDate = "Not specified";
      let formattedTime = "Not specified";

      if (preferredDate) {
        const parsedDate = dateParser.parseDate(preferredDate);
        if (parsedDate.success) {
          finalDate = new Date(parsedDate.date);
          formattedDate = parsedDate.formattedDate;
        } else {
          console.warn(
            `Could not parse date: ${preferredDate}, using today instead`
          );
          finalDate = new Date();
          formattedDate = finalDate.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          });
        }
      }

      if (preferredTime) {
        const parsedTime = dateParser.parseTime(preferredTime);
        if (parsedTime.success) {
          finalTime = parsedTime.time;
          formattedTime = parsedTime.formattedTime;
        } else {
          console.warn(
            `Could not parse time: ${preferredTime}, using default time instead`
          );
        }
      }

      // Find the service in the database using service matcher or text search
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
        date: finalDate,
        time: finalTime,
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
        date: formattedDate,
        time: formattedTime,
      };
    } catch (error) {
      console.error("Error creating service request:", error);
      throw new Error(`Failed to create service request: ${error.message}`);
    }
  }

  async getAvailableServices() {
    console.log("Fetching available services");
    try {
      // Fetch services directly from database (no cache check)
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

      return { services: formattedServices };
    } catch (error) {
      console.error("Error fetching available services:", error);
      throw new Error(`Failed to fetch available services: ${error.message}`);
    }
  }

  /**
   * Get service providers based on service type and location
   * @param {string} serviceType - Natural language service description
   * @param {string} location - Location where service is needed
   * @returns {Promise<Object>} - Service providers data
   */
  async getServiceProviders(serviceType, location) {
    console.log(
      `Fetching service providers for ${serviceType} in ${
        location || "any location"
      }`
    );

    try {
      // Use the service matcher utility to find matching services (no cache check)
      const matchedServices = await serviceMatcher.findMatchingServices(
        serviceType
      );

      console.log('matched services', matchedServices);

      if (!matchedServices || matchedServices.length === 0) {
        return {
          serviceType,
          location: location || "Not specified",
          providers: [],
          message: `No services found matching "${serviceType}". Try a different service type.`,
        };
      }

      console.log(
        `Found ${matchedServices.length} matching services for "${serviceType}"`
      );

      // Get service IDs for provider search
      const serviceIds = matchedServices.map((service) => service._id);
      const primaryServiceTitle = matchedServices[0]?.title || serviceType;

      console.log('serviveIds', serviceIds);

      // Extract city from location for geographic filtering
      const city = this.extractCity(location);
      console.log(`Searching for providers in city: ${city}`);

      // Find service providers through the ServiceProvider model
      const serviceProviders = await ServiceProvider.find({
        service: { $in: serviceIds },
      })
        .populate({
          path: "user",
          select: "firstName lastName phone address rating",
        })
        .limit(10);

      let providers = [];

      console.log('serviceProviders', serviceProviders);

      if (serviceProviders && serviceProviders.length > 0) {
        // Format service providers with user data
        providers = serviceProviders.map((sp) => {
          const user = sp.user || {};
          return {
            id: sp._id.toString(),
            name:
              `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
              "Unknown Provider",
            rating: sp.rating || 4.5,
            reviewCount: Math.floor(Math.random() * 30) + 10, // Mock data until you have real reviews
            specialties: [
              matchedServices.find((s) => s._id.equals(sp.service))?.title ||
                primaryServiceTitle,
            ],
            rate: Math.floor(Math.random() * 30) + 20, // Mock rate until you have real rates
          };
        });
      }

      // If no providers found through service providers, look for users who are service providers
      if (providers.length === 0) {
        const userProviders = await User.find({
          accountType: "ServiceProvider",
          ...(city && city !== "Unknown"
            ? {
                $or: [
                  {
                    "address.physicalAddress": {
                      $regex: new RegExp(city, "i"),
                    },
                  },
                  { "address.city": { $regex: new RegExp(city, "i") } },
                ],
              }
            : {}),
        })
          .select("_id firstName lastName rating")
          .limit(5);

        if (userProviders && userProviders.length > 0) {
          providers = userProviders.map((user) => ({
            id: user._id.toString(),
            name:
              `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
              "Unknown Provider",
            rating: user.rating || 4.5,
            reviewCount: Math.floor(Math.random() * 30) + 10, // Mock data
            specialties: [primaryServiceTitle],
            rate: Math.floor(Math.random() * 30) + 20, // Mock rate
          }));
        }
      }

      // Prepare result
      return {
        serviceType: primaryServiceTitle,
        location: location || "Not specified",
        providers: providers,
        message:
          providers.length === 0
            ? `No service providers available for ${serviceType} in ${
                location || "your area"
              }`
            : undefined,
      };
    } catch (error) {
      console.error("Error fetching service providers:", error);
      return {
        serviceType,
        location: location || "Not specified",
        providers: [],
        message: `No service providers found. Please try a different service type or location.`,
      };
    }
  }
}

module.exports = ServiceRequestManager;