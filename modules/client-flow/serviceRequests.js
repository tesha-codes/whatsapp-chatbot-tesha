const ServiceProvider = require("./../../models/serviceProvider.model");
const serviceMatcher = require("../../utils/serviceMatchingUtil");
const BookingUtil = require("../../utils/bookingUtil");


class ServiceRequestManager {
  constructor(userId) {
    this.userId = userId;
  }

  async getAvailableServices() {
    console.log("Fetching available services");
    return `
    🏠 Household Services:
- Cleaning (one-time, regular, deep cleaning)
- Laundry (wash, dry, fold)
- Home organization (decluttering, tidying)
- Handyman tasks (minor repairs, furniture assembly)
- House sitting (overnight, pet care)
- Meal preparation
- Errands and grocery shopping
- Household management

🌳 Yard & Outdoor:
- Lawn care (mowing, trimming, edging)
- Gardening (planting, pruning, weeding)
- Yard cleanup (leaf and debris removal)
- Pool maintenance
- Outdoor furniture assembly
- Gutter cleaning
- Power washing
- Tree trimming
- Landscaping

🛍️ Errands & Shopping:
- Grocery shopping
- Pharmacy pickups
- Dog walking & pet care
- Household item pickups
- Gift shopping & event planning
- Travel planning
- Meal delivery
- Queue waiting

🛠️ Skilled Tasks:
- Plumbing (leaks, drains)
- Electrical work (lighting, outlets)
- Painting (interior, exterior)
- Carpentry (woodwork, repairs)
- TV & electronics installation
- Locksmith services
- Appliance repair
- HVAC maintenance
- Pest control

🚚 Moving & Hauling:
- Local moving & hauling
- Junk removal
- Donation pickups
- Heavy lifting
- Packing services
- Long-distance moving
- Furniture disassembly
- Storage unit organization
- Delivery services

🐾 Pet Care:
- Dog walking
- Pet feeding & grooming
- Pet sitting & overnight care
- Pet training
- Pet taxi & supply shopping

👵 Senior Care:
- Companion care
- Personal care
- Medication management
- Meal prep & light housekeeping
- Transportation & errands
- Home safety assessments

🏡 Home Maintenance:
- HVAC & plumbing maintenance
- Electrical repairs
- Pest control
- Roof & gutter cleaning
- Appliance maintenance
    `;
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

      console.log(
        `Searching for service providers for services: ${serviceIds.join(", ")}`
      );

      // Extract city from location for geographic filtering
      const city = BookingUtil.getCity(location);
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
          select: "firstName lastName phone address rating hourlyRate",
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
            service_id: sp.service._id,
            rating: sp.rating || 4.5,
            reviewCount: Math.floor(Math.random() * 10) + 10, // Mock data
            specialties: [sp.service?.title || primaryServiceTitle],
            rate: sp.hourlyRate || 'Unspecified',
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
