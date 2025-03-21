import fs from "fs";
import path from "path";
import { Property } from "@/types/property";

// Cache configuration
const CACHE_DIR = path.join(process.cwd(), ".cache");
const PROPERTIES_CACHE_FILE = path.join(CACHE_DIR, "properties.json");
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

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

// Get cached properties
export function getCachedProperties(): Property[] | null {
  try {
    if (!fs.existsSync(PROPERTIES_CACHE_FILE)) {
      return null;
    }

    const cacheContent = fs.readFileSync(PROPERTIES_CACHE_FILE, "utf-8");
    const cacheData: CacheData<Property[]> = JSON.parse(cacheContent);

    // Check if cache is expired
    const now = Date.now();
    if (now - cacheData.timestamp > CACHE_TTL) {
      console.log("Cache expired, will fetch fresh data");
      return null;
    }

    console.log("Using cached properties");
    return cacheData.data;
  } catch (error) {
    console.error("Error reading properties cache:", error);
    return null;
  }
}

// Save properties to cache
export function cacheProperties(properties: Property[]): void {
  try {
    ensureCacheDir();

    const cacheData: CacheData<Property[]> = {
      timestamp: Date.now(),
      data: properties,
    };

    fs.writeFileSync(PROPERTIES_CACHE_FILE, JSON.stringify(cacheData, null, 2));
    console.log("Properties cached successfully");
  } catch (error) {
    console.error("Error caching properties:", error);
  }
}

// Clear the cache
export function clearCache(): void {
  try {
    if (fs.existsSync(PROPERTIES_CACHE_FILE)) {
      fs.unlinkSync(PROPERTIES_CACHE_FILE);
      console.log("Cache cleared");
    }
  } catch (error) {
    console.error("Error clearing cache:", error);
  }
}
