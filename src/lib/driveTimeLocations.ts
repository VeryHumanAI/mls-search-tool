import { DriveTimePolygon } from "@/types/property";
import { geocodeAddress, getDriveTimeIsochrone, parseDriveTime } from "./geoapify";
import * as turf from "@turf/turf";
import fs from "fs";
import path from "path";

// Cache configuration
const CACHE_DIR = path.join(process.cwd(), ".cache");
const ISOCHRONES_CACHE_FILE = path.join(CACHE_DIR, "isochrones.json");
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// Hardcoded locations with drive times
export const DRIVE_TIME_LOCATIONS = [
  // 15 minutes
  { address: "3727 Forest Highland Circle, Chattanooga, TN 37415", driveTime: "15 minutes" },
  { address: "Society of Work - Northshore, 110 Somerville Avenue, Chattanooga, TN 37405", driveTime: "15 minutes" },
  
  // 20 minutes
  { address: "Greenway Farms Dog Park, Walker Cemetery, Chattanooga, TN 37344", driveTime: "20 minutes" },
  { address: "McKamey Animal Center, 4500 N Access Rd, Chattanooga, TN 37415", driveTime: "20 minutes" },
  { address: "Miller's Ale House, 2119 Gunbarrel Road, Chattanooga, TN 37421", driveTime: "20 minutes" },
  { address: "Liberty Tower, 605 Chestnut Street, Chattanooga, TN 37450", driveTime: "20 minutes" },
  
  // 25 minutes
  { address: "Brainerd Baptist School, 4107 Mayfair Ave, Chattanooga, TN 37411", driveTime: "25 minutes" },
  { address: "Chattanooga Christian School, 3354 Charger Drive, Chattanooga, TN 37409", driveTime: "25 minutes" },
];

// Ensure cache directory exists
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

// Cache interface
interface CacheData<T> {
  timestamp: number;
  data: T;
}

// Get cached isochrones
export function getCachedIsochrones(): DriveTimePolygon[] | null {
  try {
    if (!fs.existsSync(ISOCHRONES_CACHE_FILE)) {
      return null;
    }

    const cacheContent = fs.readFileSync(ISOCHRONES_CACHE_FILE, "utf-8");
    const cacheData: CacheData<DriveTimePolygon[]> = JSON.parse(cacheContent);

    // Check if cache is expired
    const now = Date.now();
    if (now - cacheData.timestamp > CACHE_TTL) {
      console.log("Isochrones cache expired, will fetch fresh data");
      return null;
    }

    console.log("Using cached isochrones");
    return cacheData.data;
  } catch (error) {
    console.error("Error reading isochrones cache:", error);
    return null;
  }
}

// Save isochrones to cache
export function cacheIsochrones(isochrones: DriveTimePolygon[]): void {
  try {
    ensureCacheDir();

    const cacheData: CacheData<DriveTimePolygon[]> = {
      timestamp: Date.now(),
      data: isochrones,
    };

    fs.writeFileSync(ISOCHRONES_CACHE_FILE, JSON.stringify(cacheData, null, 2));
    console.log("Isochrones cached successfully");
  } catch (error) {
    console.error("Error caching isochrones:", error);
  }
}

// Fetch drive time polygons for all hardcoded locations
export async function fetchDriveTimePolygons(forceRefresh = false): Promise<DriveTimePolygon[]> {
  try {
    // Try to get isochrones from cache first (unless forceRefresh is true)
    if (!forceRefresh) {
      const cachedIsochrones = getCachedIsochrones();
      if (cachedIsochrones) {
        return cachedIsochrones;
      }
    }

    console.log("Fetching drive time polygons...");
    const polygons: DriveTimePolygon[] = [];

    // Process each location
    for (const location of DRIVE_TIME_LOCATIONS) {
      const { address, driveTime } = location;
      const timeMinutes = parseDriveTime(driveTime);
      
      // Geocode the address to get coordinates
      console.log(`Geocoding address: ${address}`);
      const geocoded = await geocodeAddress(address);
      
      // Get the isochrone (drive time polygon)
      console.log(`Getting ${timeMinutes} minute drive time polygon for ${address} at coordinates ${geocoded.lat}, ${geocoded.lon}`);
      const isochroneData = await getDriveTimeIsochrone(geocoded.lat, geocoded.lon, timeMinutes);
      
      console.log(`Received isochrone data type: ${isochroneData.type}`);
      
      // Add to polygons array
      polygons.push({
        address,
        driveTime,
        geoJson: isochroneData,
      });
    }

    // Cache the polygons
    cacheIsochrones(polygons);
    
    return polygons;
  } catch (error) {
    console.error("Error fetching drive time polygons:", error);
    return [];
  }
}

// Create a combined polygon from all the isochrones
export function createCombinedPolygon(polygons: DriveTimePolygon[]): any {
  try {
    if (polygons.length === 0) {
      return null;
    }

    // Debug info about polygons
    polygons.forEach((polygon, index) => {
      console.log(`Polygon ${index} (${polygon.address}): Type=${polygon.geoJson?.type}, HasFeatures=${polygon.geoJson?.features?.length > 0}`);
    });

    // Instead of trying to union, let's just create a FeatureCollection
    // with all the individual polygons for visualization
    const allFeatures = [];
    
    for (const polygon of polygons) {
      if (polygon.geoJson?.type === 'FeatureCollection' && polygon.geoJson.features?.length > 0) {
        // Add all features from the FeatureCollection
        for (const feature of polygon.geoJson.features) {
          if (feature && feature.geometry) {
            // Add metadata about the source
            if (!feature.properties) feature.properties = {};
            feature.properties.address = polygon.address;
            feature.properties.driveTime = polygon.driveTime;
            allFeatures.push(feature);
          }
        }
      } else if (polygon.geoJson?.type === 'Feature' && polygon.geoJson.geometry) {
        // Add the feature directly
        const feature = polygon.geoJson;
        if (!feature.properties) feature.properties = {};
        feature.properties.address = polygon.address;
        feature.properties.driveTime = polygon.driveTime;
        allFeatures.push(feature);
      }
    }

    console.log(`Created collection with ${allFeatures.length} features`);

    // Return a FeatureCollection with all the polygons
    return {
      type: 'FeatureCollection',
      features: allFeatures
    };
  } catch (error) {
    console.error("Error creating combined polygon:", error);
    return null;
  }
}

// Check if a point (property location) is inside any of the drive time polygons
export function isPointInPolygons(lat: number, lng: number, polygons: DriveTimePolygon[]): boolean {
  if (!lat || !lng || polygons.length === 0) {
    return false;
  }

  // Create a point
  const point = turf.point([lng, lat]);

  try {
    // Check if the point is inside any of the polygons
    for (const polygon of polygons) {
      const geoJson = polygon.geoJson;

      // Handle different GeoJSON structure possibilities
      if (!geoJson) {
        console.warn(`No geoJson data for polygon at address: ${polygon.address}`);
        continue;
      }

      // Case: FeatureCollection
      if (geoJson.type === 'FeatureCollection' && geoJson.features) {
        for (const feature of geoJson.features) {
          try {
            if (turf.booleanPointInPolygon(point, feature)) {
              return true;
            }
          } catch (e) {
            console.warn(`Error checking point in polygon feature: ${e}`);
          }
        }
      } 
      // Case: Direct Feature
      else if (geoJson.type === 'Feature' && geoJson.geometry) {
        try {
          if (turf.booleanPointInPolygon(point, geoJson)) {
            return true;
          }
        } catch (e) {
          console.warn(`Error checking point in direct feature: ${e}`);
        }
      }
      // Case: Direct Geometry (like Polygon)
      else if (geoJson.type === 'Polygon' || geoJson.type === 'MultiPolygon') {
        try {
          // Convert to a feature
          const feature = turf.feature(geoJson);
          if (turf.booleanPointInPolygon(point, feature)) {
            return true;
          }
        } catch (e) {
          console.warn(`Error checking point in direct geometry: ${e}`);
        }
      } else {
        console.warn(`Unhandled geoJson type: ${geoJson.type}`);
      }
    }
  } catch (error) {
    console.error("Error in isPointInPolygons:", error);
  }

  return false;
}