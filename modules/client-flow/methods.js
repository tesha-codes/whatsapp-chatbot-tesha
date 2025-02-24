const ServiceProvider =  require("./../../models/serviceProvider.model")


exports.getServiceProviders = async (location, serviceTypes) => {
    try {
        const results = await ServiceProvider.find({
            serviceType: { $in: serviceTypes }, 
            location: {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: location.coordinates 
                    },
                    $maxDistance: 10000 
                }
            }
        }).limit(10); 

        return results.length > 0 ? results : [];
    } catch (error) {
        console.error("Error finding service providers:", error);
        return "Failed to search for service providers"
    }
};