import fs from "fs";
import path from "path";
import { Property } from "@/types/property";

// Cache configuration
const CACHE_DIR = path.join(process.cwd(), ".cache");
const PROPERTIES_CACHE_PREFIX = path.join(CACHE_DIR, "properties_page_");
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

// Debug function to check if cache files have unique content
export function debugCacheFiles(): void {
  try {
    ensureCacheDir();
    
    // Read all files in cache directory
    const files = fs.readdirSync(CACHE_DIR);
    
    // Filter for property cache files
    const propertyCacheFiles = files.filter(file => 
      file.startsWith('properties_page_') && file.endsWith('.json')
    ).sort();
    
    console.log(`Found ${propertyCacheFiles.length} property cache files`);
    
    // Compare file sizes
    const fileSizes = propertyCacheFiles.map(file => {
      const stats = fs.statSync(path.join(CACHE_DIR, file));
      return { file, size: stats.size };
    });
    
    console.log("Cache file sizes:");
    fileSizes.forEach(({file, size}) => {
      console.log(`  ${file}: ${size} bytes`);
    });
    
    // Check if all files have the same size (a potential indicator of duplicate content)
    const uniqueSizes = new Set(fileSizes.map(f => f.size));
    if (uniqueSizes.size === 1) {
      console.warn("WARNING: All cache files have the same size. They might contain duplicate data!");
    }
    
    // Sample a few files to check their content
    if (propertyCacheFiles.length > 1) {
      try {
        const file1 = fs.readFileSync(path.join(CACHE_DIR, propertyCacheFiles[0]), 'utf-8');
        const file2 = fs.readFileSync(path.join(CACHE_DIR, propertyCacheFiles[1]), 'utf-8');
        
        const data1 = JSON.parse(file1);
        const data2 = JSON.parse(file2);
        
        // Check if properties arrays have the same length
        const props1Len = data1.data.properties.length;
        const props2Len = data2.data.properties.length;
        
        console.log(`Page 1 has ${props1Len} properties, Page 2 has ${props2Len} properties`);
        
        // Check the first few property IDs
        const ids1 = data1.data.properties.slice(0,3).map((p:any) => p.id);
        const ids2 = data2.data.properties.slice(0,3).map((p:any) => p.id);
        
        console.log(`Page 1 first property IDs: ${ids1.join(', ')}`);
        console.log(`Page 2 first property IDs: ${ids2.join(', ')}`);
        
        // Check if they're identical
        const sameIds = ids1.every((id:string, i:number) => id === ids2[i]);
        if (sameIds) {
          console.warn("WARNING: First few property IDs are identical between pages!");
        }
      } catch (e) {
        console.error("Error comparing cache files:", e);
      }
    }
  } catch (e) {
    console.error("Error debugging cache files:", e);
  }
}

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
