import axios from "axios";
import getConfig from "next/config";

// Get server-side config
const { serverRuntimeConfig } = getConfig() || { serverRuntimeConfig: {} };
const GEOAPIFY_API_KEY = serverRuntimeConfig.NEXT_PUBLIC_GEOAPIFY_API_KEY || process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY || "YOUR_API_KEY_HERE";

// Geocode an address to get lat/lng coordinates
export async function geocodeAddress(address: string) {
  try {
    const response = await axios.get("https://api.geoapify.com/v1/geocode/search", {
      params: {
        text: address,
        format: "json",
        apiKey: GEOAPIFY_API_KEY,
      },
    });

    if (response.data.results && response.data.results.length > 0) {
      const result = response.data.results[0];
      return {
        lat: result.lat,
        lon: result.lon,
        formatted: result.formatted,
      };
    }

    throw new Error("No results found for this address");
  } catch (error) {
    console.error("Error geocoding address:", error);
    throw error;
  }
}

// Get isochrone (drive time polygon) for a location
export async function getDriveTimeIsochrone(lat: number, lon: number, timeMinutes: number) {
  try {
    // Using correct parameters based on Geoapify documentation
    const response = await axios.get("https://api.geoapify.com/v1/isoline", {
      params: {
        lat,
        lon,
        type: "time", // 'time' is the type, not 'drive'
        mode: "drive", // 'drive' is the mode
        range: timeMinutes * 60, // Convert minutes to seconds (900 = 15 minutes)
        apiKey: GEOAPIFY_API_KEY,
      },
    });

    return response.data;
  } catch (error) {
    console.error("Error getting isochrone:", error);
    throw error;
  }
}

// Parse drive time string to minutes
export function parseDriveTime(driveTime: string): number {
  const match = driveTime.match(/(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return 15; // Default to 15 minutes if parsing fails
}
