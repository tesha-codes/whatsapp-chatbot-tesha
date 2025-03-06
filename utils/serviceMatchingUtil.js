const Service = require("../models/services.model");
const Category = require("../models/category.model");

/**
 * Comprehensive service matching utility that maps natural language queries
 * to predefined service types and specific services
 */
class ServiceMatcher {
  constructor() {
    // Initialize the service mapping dictionary
    this.serviceMapping = this._buildServiceMapping();
    // Cached category mapping for performance
    this.categoryIdMapping = null;
  }

  /**
   * Build comprehensive mapping dictionary from services and their tasks
   */
  _buildServiceMapping() {
    // Core service type mapping - maps common terms to service types and categories
    const mapping = {
      // Household Services
      clean: ["Household", "Cleaning Services"],
      cleaning: ["Household", "Cleaning Services"],
      maid: ["Household", "Cleaning Services"],
      housekeeper: ["Household", "Cleaning Services"],
      dust: ["Household", "Cleaning Services"],
      vacuum: ["Household", "Cleaning Services"],
      mop: ["Household", "Cleaning Services"],
      "deep clean": ["Household", "Cleaning Services"],
      laundry: ["Household", "Laundry Service"],
      wash: ["Household", "Laundry Service"],
      fold: ["Household", "Laundry Service"],
      iron: ["Household", "Laundry Service"],
      organize: ["Household", "Home Organization"],
      declutter: ["Household", "Home Organization"],
      tidy: ["Household", "Home Organization"],
      handyman: ["Household", "Handyman Tasks", "Skilled Task"],
      assemble: ["Household", "Handyman Tasks", "Skilled Task"],
      "furniture assembly": ["Household", "Handyman Tasks", "Skilled Task"],
      "house sit": ["Household", "House Sitting"],
      overnight: ["Household", "House Sitting"],
      cook: ["Household", "Meal Preparation"],
      meal: ["Household", "Meal Preparation"],
      chef: ["Household", "Meal Preparation"],
      food: ["Household", "Meal Preparation"],
      errand: [
        "Household",
        "Errands and grocery shopping",
        "Errands & Shopping",
      ],
      grocery: [
        "Household",
        "Errands and grocery shopping",
        "Errands & Shopping",
      ],
      manage: ["Household", "Household Management"],
      administration: ["Household", "Household Management"],

      // Yard & Outdoor
      lawn: ["Yard Work", "Lawn care"],
      mow: ["Yard Work", "Lawn care"],
      trim: ["Yard Work", "Lawn care"],
      edge: ["Yard Work", "Lawn care"],
      grass: ["Yard Work", "Lawn care"],
      garden: ["Yard Work", "Gardening"],
      plant: ["Yard Work", "Gardening"],
      prune: ["Yard Work", "Gardening"],
      weed: ["Yard Work", "Gardening"],
      yard: ["Yard Work", "Yard cleanup"],
      leaf: ["Yard Work", "Yard cleanup"],
      debris: ["Yard Work", "Yard cleanup"],
      pool: ["Yard Work", "Pool Maintenance"],
      "outdoor furniture": ["Yard Work", "Outdoor Furniture Assembly"],
      patio: ["Yard Work", "Outdoor Furniture Assembly"],
      gutter: ["Yard Work", "Gutter Cleaning", "Home Maintenance"],
      "power wash": ["Yard Work", "Power Washing"],
      "pressure wash": ["Yard Work", "Power Washing"],
      tree: ["Yard Work", "Tree Trimming"],
      landscape: ["Yard Work", "Landscaping"],

      // Errands & Shopping
      shop: ["Errands & Shopping", "Grocery shopping"],
      pickup: ["Errands & Shopping"],
      pharmacy: ["Errands & Shopping", "Pharmacy pickups"],
      medicine: ["Errands & Shopping", "Pharmacy pickups"],
      prescription: ["Errands & Shopping", "Pharmacy pickups"],
      "dog walk": ["Errands & Shopping", "Dog walking & pet care", "Pet Care"],
      "pet care": ["Errands & Shopping", "Dog walking & pet care", "Pet Care"],
      "household item": ["Errands & Shopping", "Household item pickups"],
      gift: ["Errands & Shopping", "Gift shopping & event planning"],
      event: ["Errands & Shopping", "Gift shopping & event planning"],
      travel: ["Errands & Shopping", "Travel planning"],
      vacation: ["Errands & Shopping", "Travel planning"],
      delivery: ["Errands & Shopping", "Meal delivery", "Moving"],
      queue: ["Errands & Shopping", "Queue waiting"],
      wait: ["Errands & Shopping", "Queue waiting"],
      line: ["Errands & Shopping", "Queue waiting"],

      // Skilled Tasks
      plumb: ["Skilled Task", "Plumbing", "Home Maintenance"],
      plumbing: ["Skilled Task", "Plumbing", "Home Maintenance"],
      plumber: ["Skilled Task", "Plumbing", "Home Maintenance"],
      leak: ["Skilled Task", "Plumbing", "Home Maintenance"],
      drain: ["Skilled Task", "Plumbing", "Home Maintenance"],
      tap: ["Skilled Task", "Plumbing", "Home Maintenance"],
      faucet: ["Skilled Task", "Plumbing", "Home Maintenance"],
      toilet: ["Skilled Task", "Plumbing", "Home Maintenance"],
      sink: ["Skilled Task", "Plumbing", "Home Maintenance"],
      electric: ["Skilled Task", "Electrical work", "Home Maintenance"],
      electrical: ["Skilled Task", "Electrical work", "Home Maintenance"],
      electrician: ["Skilled Task", "Electrical work", "Home Maintenance"],
      light: ["Skilled Task", "Electrical work", "Home Maintenance"],
      outlet: ["Skilled Task", "Electrical work", "Home Maintenance"],
      switch: ["Skilled Task", "Electrical work", "Home Maintenance"],
      wiring: ["Skilled Task", "Electrical work", "Home Maintenance"],
      paint: ["Skilled Task", "Painting"],
      painter: ["Skilled Task", "Painting"],
      interior: ["Skilled Task", "Painting"],
      exterior: ["Skilled Task", "Painting"],
      carpet: ["Skilled Task", "Carpentry"],
      carpentry: ["Skilled Task", "Carpentry"],
      woodwork: ["Skilled Task", "Carpentry"],
      repair: ["Skilled Task", "Carpentry", "Home Maintenance"],
      tv: ["Skilled Task", "TV & electronics installation"],
      television: ["Skilled Task", "TV & electronics installation"],
      electronic: ["Skilled Task", "TV & electronics installation"],
      install: ["Skilled Task", "TV & electronics installation"],
      lock: ["Skilled Task", "Locksmith services"],
      locksmith: ["Skilled Task", "Locksmith services"],
      key: ["Skilled Task", "Locksmith services"],
      appliance: ["Skilled Task", "Appliance repair", "Home Maintenance"],
      fix: ["Skilled Task", "Appliance repair", "Home Maintenance"],
      hvac: ["Skilled Task", "HVAC maintenance", "Home Maintenance"],
      "air condition": ["Skilled Task", "HVAC maintenance", "Home Maintenance"],
      heat: ["Skilled Task", "HVAC maintenance", "Home Maintenance"],
      cooling: ["Skilled Task", "HVAC maintenance", "Home Maintenance"],
      pest: ["Skilled Task", "Pest control", "Home Maintenance"],
      exterminator: ["Skilled Task", "Pest control", "Home Maintenance"],
      bug: ["Skilled Task", "Pest control", "Home Maintenance"],
      rat: ["Skilled Task", "Pest control", "Home Maintenance"],
      rodent: ["Skilled Task", "Pest control", "Home Maintenance"],

      // Moving & Hauling
      move: ["Moving", "Local moving & hauling"],
      moving: ["Moving", "Local moving & hauling"],
      haul: ["Moving", "Local moving & hauling"],
      junk: ["Moving", "Junk removal"],
      trash: ["Moving", "Junk removal"],
      garbage: ["Moving", "Junk removal"],
      donation: ["Moving", "Donation pickups"],
      donate: ["Moving", "Donation pickups"],
      lift: ["Moving", "Heavy lifting"],
      heavy: ["Moving", "Heavy lifting"],
      pack: ["Moving", "Packing services"],
      packing: ["Moving", "Packing services"],
      "long distance": ["Moving", "Long-distance moving"],
      disassemble: ["Moving", "Furniture disassembly"],
      furniture: ["Moving", "Furniture disassembly"],
      storage: ["Moving", "Storage unit organization"],
      deliver: ["Moving", "Delivery services"],

      // Pet Care
      pet: ["Pet Care"],
      dog: ["Pet Care", "Dog walking"],
      cat: ["Pet Care", "Pet feeding & grooming"],
      walk: ["Pet Care", "Dog walking"],
      feed: ["Pet Care", "Pet feeding & grooming"],
      groom: ["Pet Care", "Pet feeding & grooming"],
      "pet sit": ["Pet Care", "Pet sitting & overnight care"],
      animal: ["Pet Care"],
      train: ["Pet Care", "Pet training"],
      "pet taxi": ["Pet Care", "Pet taxi & supply shopping"],
      "pet supply": ["Pet Care", "Pet taxi & supply shopping"],

      // Senior Care
      senior: ["Senior Care"],
      elder: ["Senior Care"],
      elderly: ["Senior Care"],
      companion: ["Senior Care", "Companion care"],
      "personal care": ["Senior Care", "Personal care"],
      medication: ["Senior Care", "Medication management"],
      "senior meal": ["Senior Care", "Meal prep & light housekeeping"],
      "senior transport": ["Senior Care", "Transportation & errands"],
      "safety assessment": ["Senior Care", "Home safety assessments"],

      // Home Maintenance
      maintenance: ["Home Maintenance"],
      maintain: ["Home Maintenance"],
      roof: ["Home Maintenance", "Roof & gutter cleaning", "Yard Work"],
      furnace: ["Home Maintenance", "HVAC & plumbing maintenance"],
      boiler: ["Home Maintenance", "HVAC & plumbing maintenance"],
    };

    return mapping;
  }

  /**
   * Load and cache category ID mapping for better performance
   */
  async _loadCategoryMapping() {
    if (this.categoryIdMapping) return this.categoryIdMapping;

    try {
      const categories = await Category.find().select("_id name code");
      this.categoryIdMapping = {};

      categories.forEach((category) => {
        // Clean up the category name (remove emoji and trim)
        const cleanName = category.name
          .replace(/[\u{1F300}-\u{1F6FF}]/gu, "")
          .trim();
        this.categoryIdMapping[cleanName.toLowerCase()] = category._id;
      });

      return this.categoryIdMapping;
    } catch (error) {
      console.error("Error loading category mapping:", error);
      return {};
    }
  }

  /**
   * Find potential service types and specific services from user query
   * @param {string} query - User's natural language query
   * @returns {Object} Object containing matched service types, services, and score
   */
  async matchService(query) {
    if (!query) return { serviceTypes: [], specificServices: [], score: 0 };

    // Normalize query for better matching
    const normalizedQuery = query.toLowerCase().trim();

    // Track matched items with their frequency for scoring
    const matchedServiceTypes = {};
    const matchedSpecificServices = {};
    let totalScore = 0;

    // Check for exact matches in our mapping
    for (const [keyword, mappings] of Object.entries(this.serviceMapping)) {
      // Full word match gets higher score
      if (
        normalizedQuery.includes(` ${keyword} `) ||
        normalizedQuery === keyword ||
        normalizedQuery.startsWith(`${keyword} `) ||
        normalizedQuery.endsWith(` ${keyword}`)
      ) {
        mappings.forEach((mapping) => {
          if (
            [
              "Household",
              "Skilled Task",
              "Yard Work",
              "Moving",
              "Pet Care",
              "Senior Care",
              "Home Maintenance",
              "Errands & Shopping",
            ].includes(mapping)
          ) {
            matchedServiceTypes[mapping] =
              (matchedServiceTypes[mapping] || 0) + 3; // Higher score for full word match
          } else {
            matchedSpecificServices[mapping] =
              (matchedSpecificServices[mapping] || 0) + 3;
          }
          totalScore += 3;
        });
      }
      // Partial match gets lower score
      else if (normalizedQuery.includes(keyword)) {
        mappings.forEach((mapping) => {
          if (
            [
              "Household",
              "Skilled Task",
              "Yard Work",
              "Moving",
              "Pet Care",
              "Senior Care",
              "Home Maintenance",
              "Errands & Shopping",
            ].includes(mapping)
          ) {
            matchedServiceTypes[mapping] =
              (matchedServiceTypes[mapping] || 0) + 1;
          } else {
            matchedSpecificServices[mapping] =
              (matchedSpecificServices[mapping] || 0) + 1;
          }
          totalScore += 1;
        });
      }
    }

    // Sort results by frequency (score)
    const sortedServiceTypes = Object.entries(matchedServiceTypes)
      .sort((a, b) => b[1] - a[1])
      .map(([type]) => type);

    const sortedSpecificServices = Object.entries(matchedSpecificServices)
      .sort((a, b) => b[1] - a[1])
      .map(([service]) => service);

    return {
      serviceTypes: sortedServiceTypes,
      specificServices: sortedSpecificServices,
      score: totalScore,
    };
  }

  /**
   * Find services in the database based on the user query
   * @param {string} query - User's natural language query
   * @returns {Promise<Array>} - Matched services from the database
   */
  async findMatchingServices(query) {
    try {
      // Get matched service types and specific services
      const { serviceTypes, specificServices, score } = await this.matchService(
        query
      );

      if (score === 0) {
        // If no matches in our dictionary, just do a text search
        return await Service.find({
          $text: { $search: query, $caseSensitive: false },
        })
          .sort({ score: { $meta: "textScore" } })
          .limit(5);
      }

      // Load category mapping if needed
      await this._loadCategoryMapping();

      // Use the matched service types to find services
      let services = [];

      // First try: search by service type
      if (serviceTypes.length > 0) {
        services = await Service.find({
          serviceType: { $in: serviceTypes },
        }).limit(10);
      }

      // Second try: search by specific service name
      if (services.length === 0 && specificServices.length > 0) {
        const regexPatterns = specificServices.map(
          (service) => new RegExp(service, "i")
        );

        services = await Service.find({
          $or: [
            { title: { $in: regexPatterns } },
            { description: { $in: regexPatterns } },
          ],
        }).limit(10);
      }

      // Last resort: direct text search
      if (services.length === 0) {
        services = await Service.find({
          $text: { $search: query, $caseSensitive: false },
        })
          .sort({ score: { $meta: "textScore" } })
          .limit(5);
      }

      return services;
    } catch (error) {
      console.error("Error finding matching services:", error);
      return [];
    }
  }
}

// Create a singleton instance
const serviceMatcher = new ServiceMatcher();

module.exports = serviceMatcher;
