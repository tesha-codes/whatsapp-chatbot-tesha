const fs = require("fs");
const path = require("path");

// Load the locations data from the JSON file
const locationsData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "locations_dict.json"), "utf8")
);

class CityLookupService {
  constructor(citiesData) {
    this.citiesData = citiesData;
    this.exactLookup = this.createExactLookup(citiesData);
    this.searchIndex = this.createSearchIndex(citiesData);
    console.log(
      `CityLookupService initialized with ${
        Object.keys(citiesData).length
      } cities and ${Object.keys(this.exactLookup).length} locations`
    );
  }

  // Create exact lookup map for O(1) performance
  createExactLookup(citiesData) {
    const lookup = {};

    for (const [city, neighborhoods] of Object.entries(citiesData)) {
      lookup[city.toLowerCase()] = city;

      for (const neighborhood of neighborhoods) {
        if (
          lookup[neighborhood.toLowerCase()] &&
          lookup[neighborhood.toLowerCase()] !== city
        ) {
          // Handle duplicate neighborhood names
          if (!Array.isArray(lookup[neighborhood.toLowerCase()])) {
            lookup[neighborhood.toLowerCase()] = [
              lookup[neighborhood.toLowerCase()],
            ];
          }
          lookup[neighborhood.toLowerCase()].push(city);
        } else {
          lookup[neighborhood.toLowerCase()] = city;
        }
      }
    }

    return lookup;
  }

  // Create search index for fuzzy matching
  createSearchIndex(citiesData) {
    const index = new Map();

    // Index all city names and neighborhoods
    for (const [city, neighborhoods] of Object.entries(citiesData)) {
      // Index the city name
      this.indexLocation(index, city, city);

      // Index each neighborhood
      for (const neighborhood of neighborhoods) {
        this.indexLocation(index, neighborhood, city);
      }
    }

    return index;
  }

  // Index a location by words and prefixes for fuzzy matching
  indexLocation(index, location, city) {
    const words = location.toLowerCase().split(/\s+/);

    // Index each complete word
    for (const word of words) {
      if (word.length < 3) continue; // Skip very short words

      if (!index.has(word)) {
        index.set(word, new Set());
      }
      index.get(word).add(city);

      // Index prefixes of the word for partial matching
      // e.g., "Kapondoro" -> "ka", "kap", "kapo", etc.
      for (let i = 3; i < word.length; i++) {
        const prefix = word.substring(0, i);
        if (!index.has(prefix)) {
          index.set(prefix, new Set());
        }
        index.get(prefix).add(city);
      }
    }
  }

  // Main lookup function
  lookup(location) {
    if (!location) return null;
    const query = location.trim().toLowerCase();

    // Try exact match first (O(1) operation)
    const exactMatch = this.exactLookup[query];
    if (exactMatch) return exactMatch;

    // If no exact match, try fuzzy matching
    return this.fuzzyLookup(query);
  }

  // Fuzzy lookup implementation
  fuzzyLookup(query) {
    // For very short queries, don't do fuzzy matching
    if (query.length < 3) return null;

    const words = query.split(/\s+/);
    const candidates = new Map();

    // Check for word and prefix matches
    for (const word of words) {
      if (word.length < 3) continue;

      // Try complete word
      if (this.searchIndex.has(word)) {
        for (const city of this.searchIndex.get(word)) {
          candidates.set(city, (candidates.get(city) || 0) + 2); // Complete word match is stronger
        }
      }

      // Try prefixes
      for (let i = 3; i <= word.length; i++) {
        const prefix = word.substring(0, i);
        if (this.searchIndex.has(prefix)) {
          for (const city of this.searchIndex.get(prefix)) {
            candidates.set(city, (candidates.get(city) || 0) + 1); // Prefix match is weaker
          }
        }
      }
    }

    // Return the best match or null
    if (candidates.size === 0) return null;

    // Find city with highest score
    let bestMatch = null;
    let bestScore = 0;

    for (const [city, score] of candidates.entries()) {
      if (score > bestScore) {
        bestMatch = city;
        bestScore = score;
      }
    }

    return bestMatch;
  }

  // Get all possible matches with scores (useful for autocomplete)
  getSuggestions(query, limit = 5) {
    if (!query || query.length < 2) return [];
    const normalizedQuery = query.trim().toLowerCase();

    // Try exact match first
    const exactMatch = this.exactLookup[normalizedQuery];
    if (exactMatch) {
      return [{ location: exactMatch, score: 100 }];
    }

    // Collect all candidates with their scores
    const words = normalizedQuery.split(/\s+/);
    const candidates = new Map();

    for (const word of words) {
      if (word.length < 2) continue;

      // Complete word matches
      if (this.searchIndex.has(word)) {
        for (const city of this.searchIndex.get(word)) {
          candidates.set(city, (candidates.get(city) || 0) + 3);
        }
      }

      // Prefix matches
      for (let i = 2; i <= word.length; i++) {
        const prefix = word.substring(0, i);
        if (this.searchIndex.has(prefix)) {
          for (const city of this.searchIndex.get(prefix)) {
            candidates.set(
              city,
              (candidates.get(city) || 0) + 1 + i / word.length
            );
          }
        }
      }
    }

    // Convert to array, sort by score, and limit results
    return Array.from(candidates.entries())
      .map(([location, score]) => ({ location, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // Find all neighborhoods for a given city
  getNeighborhoods(city) {
    if (!city) return [];
    const normalizedCity = city.trim();

    // Try to find the exact city
    return this.citiesData[normalizedCity] || [];
  }
}

// Create and export a singleton instance
const cityLookupService = new CityLookupService(locationsData);

// : UNCOMMENT TO TEST CITY LOOKUP SERVICE
// const tests = [
//   { input: "Harare", expected: "Harare" },
//   { input: "avondale", expected: "Harare" },
//   { input: "mbare", expected: "Harare" },
//   { input: "Kapond", expected: "Mutoko" },
//   { input: "chite", expected: "Fuzzy match" }, 
//   { input: "unknown", expected: null },
// ];

// const results = tests.map((test) => ({
//   input: test.input,
//   expected: test.expected,
//   actual: cityLookupService.lookup(test.input),
//   success:
//     (test.expected === null && cityLookupService.lookup(test.input) === null) ||
//     (test.expected !== null && cityLookupService.lookup(test.input) !== null),
// }));
// console.table(results);

// You can also test the suggestions and neighborhoods functions
// const suggestions = cityLookupService.getSuggestions("sino");
// const neighborhoods = cityLookupService.getNeighborhoods("Harare");

// console.log("Suggestions:", suggestions);
// console.log("Neighborhoods:", neighborhoods);

module.exports = cityLookupService;
