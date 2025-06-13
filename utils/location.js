async function getLocationFromIP(ipAddress) {
  try {
    const response = await fetch(`http://ip-api.com/json/${ipAddress}`);
    const data = await response.json();

    if (data.status === "success") {
      const { country, regionName, city } = data;
      return {
        country: country || "Unknown",
        state: regionName || "Unknown",
        city: city || "Unknown",
      };
    } else {
      throw new Error(data.message || "Failed to fetch location");
    }
  } catch (error) {
    console.error("Error fetching location:", error.message);
    return {
      country: "Unknown",
      state: "Unknown",
      city: "Unknown",
    };
  }
}

module.exports = getLocationFromIP;