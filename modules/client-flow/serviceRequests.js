const Service = require("./../../models/services.model");
const User = require("./../../models/user.model");
const ServiceProvider = require("./../../models/serviceProvider.model");
const serviceMatcher = require("../../utils/serviceMatchingUtil");

class ServiceRequestManager {
  constructor(userId) {
    this.userId = userId;
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
  //  get service providers
  async getServiceProviders(serviceType, location) {
    console.log(
      `Fetching service providers for ${serviceType} in ${
        location || "any location"
      }`
    );

    try {
      // Use the service matcher utility to find matching services
      const matchedServices = await serviceMatcher.findMatchingServices(
        serviceType
      );

      console.log("matched services", matchedServices);

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

      // Extract city from location for geographic filtering
      const city = this.extractCity(location);
      console.log(`Searching for providers in city: ${city}`);

      // Find service providers with geographic filtering if city is available
      let query = { service: { $in: serviceIds } };

      console.log("query", query);
      // Add city filter if available
      if (city && city !== "Unknown") {
        query.city = { $regex: new RegExp(city, "i") };
      }

      // Find service providers through the ServiceProvider model]
      const serviceProviders = await ServiceProvider.find(query)
        .populate({
          path: "user",
          select: "firstName lastName phone address rating",
        })
        .populate("service")
        .limit(10);

      let providers = [];

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
            reviewCount: Math.floor(Math.random() * 30) + 10, // Mock data
            specialties: [sp.service?.title || primaryServiceTitle],
            rate: Math.floor(Math.random() * 30) + 20, // Mock rate
          };
        });
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
