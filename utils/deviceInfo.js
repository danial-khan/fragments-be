function parseUserAgent(ua) {
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Mac/.test(ua)
    ? "MacOS"
    : /Linux/.test(ua)
    ? "Linux"
    : /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad/.test(ua)
    ? "iOS"
    : "Unknown";

  const browser = /Chrome/.test(ua)
    ? "Chrome"
    : /Firefox/.test(ua)
    ? "Firefox"
    : /Safari/.test(ua) && !/Chrome/.test(ua)
    ? "Safari"
    : /Edge/.test(ua)
    ? "Edge"
    : /MSIE|Trident/.test(ua)
    ? "IE"
    : "Unknown";

  const device = /Mobile/.test(ua) ? "mobile" : "desktop";

  return { device, os, browser };
}


module.exports = parseUserAgent;
