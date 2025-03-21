import fs from "fs";
import path from "path";
import { Property } from "@/types/property";

// Cache configuration
const CACHE_DIR = path.join(process.cwd(), ".cache");
const PROPERTIES_CACHE_PREFIX = path.join(CACHE_DIR, "properties_page_");
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

// Get cached properties with pagination
export function getCachedProperties(page = 1): {properties: Property[], totalCount: number, totalPages: number} | null {
  try {
    const cacheFile = `${PROPERTIES_CACHE_PREFIX}${page}.json`;
    
    if (!fs.existsSync(cacheFile)) {
      return null;
    }

    const cacheContent = fs.readFileSync(cacheFile, "utf-8");
    const cacheData: CacheData<{properties: Property[], totalCount: number, totalPages: number}> = JSON.parse(cacheContent);

    // Check if cache is expired
    const now = Date.now();
    if (now - cacheData.timestamp > CACHE_TTL) {
      console.log(`Cache for page ${page} expired, will fetch fresh data`);
      return null;
    }

    console.log(`Using cached properties for page ${page}`);
    return cacheData.data;
  } catch (error) {
    console.error(`Error reading properties cache for page ${page}:`, error);
    return null;
  }
}

// Save properties to cache with pagination
export function cacheProperties(
  data: {properties: Property[], totalCount: number, totalPages: number}, 
  page = 1
): void {
  try {
    ensureCacheDir();
    const cacheFile = `${PROPERTIES_CACHE_PREFIX}${page}.json`;

    const cacheData: CacheData<{properties: Property[], totalCount: number, totalPages: number}> = {
      timestamp: Date.now(),
      data,
    };

    fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2));
    console.log(`Properties for page ${page} cached successfully`);
  } catch (error) {
    console.error(`Error caching properties for page ${page}:`, error);
  }
}

// Clear the cache
export function clearCache(): void {
  try {
    // Read all files in cache directory
    const files = fs.readdirSync(CACHE_DIR);
    
    // Filter for property cache files
    const propertyCacheFiles = files.filter(file => 
      file.startsWith('properties_page_') && file.endsWith('.json')
    );
    
    // Delete each property cache file
    let count = 0;
    for (const file of propertyCacheFiles) {
      fs.unlinkSync(path.join(CACHE_DIR, file));
      count++;
    }
    
    console.log(`Cache cleared (${count} property cache files deleted)`);
  } catch (error) {
    console.error("Error clearing cache:", error);
  }
}
