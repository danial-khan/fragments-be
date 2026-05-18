const UNKNOWN_LOCATION = {
  country: "Unknown",
  state: "Unknown",
  city: "Unknown",
};

function isPrivateOrLocalIP(ipAddress) {
  if (!ipAddress) return true;

  let ip = ipAddress.trim();

  if (ip.startsWith("::ffff:")) ip = ip.slice(7);

  if (
    ip === "::1" ||
    ip === "127.0.0.1" ||
    ip === "localhost" ||
    ip === "0.0.0.0"
  ) {
    return true;
  }

  // IPv4 private ranges: 10.x, 192.168.x, 172.16-31.x, 169.254.x (link-local)
  if (/^10\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^169\.254\./.test(ip)) return true;
  const m = ip.match(/^172\.(\d+)\./);
  if (m) {
    const second = parseInt(m[1], 10);
    if (second >= 16 && second <= 31) return true;
  }

  // IPv6 unique local (fc00::/7) and link-local (fe80::/10)
  if (/^fc/i.test(ip) || /^fd/i.test(ip) || /^fe8/i.test(ip)) return true;

  return false;
}

async function getLocationFromIP(ipAddress) {
  if (isPrivateOrLocalIP(ipAddress)) {
    return { ...UNKNOWN_LOCATION };
  }

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
    return { ...UNKNOWN_LOCATION };
  }
}

module.exports = getLocationFromIP;