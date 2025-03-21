import axios from "axios";
import getConfig from "next/config";
import { Property, PropertySearchParams, DriveTimePolygon } from "@/types/property";
import { getCachedProperties, cacheProperties, clearCache } from "./cache";
import { 
  fetchDriveTimePolygons, 
  createCombinedPolygon, 
  isPointInPolygons 
} from "./driveTimeLocations";
import { withRateLimit } from "./rateLimit";

// Get server-side config
const { serverRuntimeConfig } = getConfig() || { serverRuntimeConfig: {} };

// Calculate monthly mortgage payment
export function calculateMonthlyPayment(
  price: number,
  downPaymentPercent: number,
  interestRate = 0.065, // Default to 6.5%
  loanTermYears = 30
): number {
  // Calculate loan amount
  const downPayment = price * (downPaymentPercent / 100);
  const loanAmount = price - downPayment;

  // Calculate monthly interest rate
  const monthlyRate = interestRate / 12;

  // Calculate number of payments
  const numPayments = loanTermYears * 12;

  // Calculate monthly payment using the mortgage formula
  const monthlyPayment =
    loanAmount *
    ((monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
      (Math.pow(1 + monthlyRate, numPayments) - 1));

  // Add property tax (estimated at 1.1% of home value annually)
  const monthlyPropertyTax = (price * 0.011) / 12;

  // Add homeowners insurance (estimated at $1200 annually)
  const monthlyInsurance = 1200 / 12;

  // Return total monthly payment
  return monthlyPayment + monthlyPropertyTax + monthlyInsurance;
}

// Calculate maximum home price based on monthly payment
export function calculateMaxHomePrice(
  maxMonthlyPayment: number,
  downPaymentPercent: number,
  interestRate = 0.065, // Default to 6.5%
  loanTermYears = 30
): number {
  // Estimate tax and insurance costs
  const estimatedTaxAndInsurance = 500; // Monthly

  // Available payment for principal and interest
  const availableForPI = maxMonthlyPayment - estimatedTaxAndInsurance;

  // Monthly interest rate
  const monthlyRate = interestRate / 12;

  // Number of payments
  const numPayments = loanTermYears * 12;

  // Calculate loan amount using mortgage formula rearranged
  const loanAmount =
    availableForPI /
    ((monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
      (Math.pow(1 + monthlyRate, numPayments) - 1));

  // Calculate total price including down payment
  const totalPrice = loanAmount / (1 - downPaymentPercent / 100);

  return totalPrice;
}

// Fetch a single page of properties from RapidAPI
export async function fetchPropertiesFromRapidApi(page = 1, limit = 200): Promise<{properties: Property[], totalCount: number, totalPages: number}> {
  // Try to get properties from cache first
  const cachedData = getCachedProperties(page);
  if (cachedData) {
    return cachedData;
  }

  const RAPIDAPI_KEY = serverRuntimeConfig.NEXT_RAPIDAPI_KEY;
  const RAPIDAPI_HOST = serverRuntimeConfig.NEXT_RAPIDAPI_HOST;

  if (!RAPIDAPI_KEY || !RAPIDAPI_HOST) {
    console.error("RapidAPI credentials are missing");
    return { properties: [], totalCount: 0, totalPages: 0 };
  }

  // Calculate offset based on page and limit
  const offset = (page - 1) * limit;

  const options = {
    method: "GET",
    url: "https://realtor16.p.rapidapi.com/search/forsale",
    params: {
      location: "hamilton county, tn",
      type: "single_family,duplex_triplex,multi_family",
      limit: limit.toString(),
      offset: offset.toString(),
      search_radius: "25",
      foreclosure: "false",
      "list_price-max": "500000",
      sort: "relevant",
    },
    headers: {
      "x-rapidapi-key": RAPIDAPI_KEY,
      "x-rapidapi-host": RAPIDAPI_HOST,
    },
  };

  // Wrap the API call with rate limiting
  return withRateLimit(async () => {
    console.log(`Fetching properties from RapidAPI (page ${page}, limit ${limit})...`);
    
    try {
      const response = await axios.request(options);

      // Check if response data needs to be parsed
      const data = typeof response.data === "string" ? JSON.parse(response.data) : response.data;

      if (!data.properties || !Array.isArray(data.properties)) {
        console.error("Invalid response format from RapidAPI:", data);
        return { properties: [], totalCount: 0, totalPages: 0 };
      }

      // Get the total count of properties if available
      const totalCount = data.matching_rows || data.total || data.properties.length;
      const totalPages = Math.ceil(totalCount / limit);

      // Transform the API response into our Property type
      const properties = data.properties.map((property: any) => {
        const price = property.list_price || 0;
        const address = property.location?.address || {};

        return {
          id: property.property_id || property.listing_id || String(Math.random()),
          address: `${address.line || ""}, ${address.city || ""}, ${
            address.state_code || ""
          } ${address.postal_code || ""}`,
          price: price,
          bedrooms: property.description?.beds || 0,
          bathrooms: parseFloat(property.description?.baths_consolidated || "0"),
          squareFeet: property.description?.sqft || 0,
          lat: address.coordinate?.lat || 0,
          lng: address.coordinate?.lon || 0,
          imageUrl: property.primary_photo?.href || "https://via.placeholder.com/300x200",
          listingUrl: property.permalink
            ? `https://www.realtor.com/realestateandhomes-detail/${property.permalink}`
            : "#",
          monthlyPayment: 0, // We'll calculate this later
        };
      });

      // Cache the fetched properties with pagination info
      const result = { properties, totalCount, totalPages };
      cacheProperties(result, page);

      return result;
    } catch (error: any) {
      // Check if it's a rate limit error
      if (error?.response?.status === 429) {
        console.warn(`Rate limit hit (429) for page ${page} - letting retry mechanism handle it`);
        // Re-throw the error so the rate limit retry mechanism can catch it
        throw error;
      }
      
      // For other errors, log and return empty result
      console.error(`Error fetching properties from RapidAPI (page ${page}):`, error);
      return { properties: [], totalCount: 0, totalPages: 0 };
    }
  });
}

// Pre-fetch all available properties (this will respect rate limits)
export async function prefetchAllProperties(onProgressUpdate?: (current: number, total: number) => void): Promise<{
  properties: Property[], 
  totalCount: number, 
  totalPages: number,
  loadedPages: number[]
}> {
  try {
    // Get the first page to determine total pages
    const firstPageResult = await fetchPropertiesFromRapidApi(1);
    let totalPages = firstPageResult.totalPages;
    let allProperties: Property[] = [...firstPageResult.properties];
    let loadedPages = [1]; // Track which pages have been loaded
    
    // Update progress
    if (onProgressUpdate) {
      onProgressUpdate(1, totalPages);
    }
    
    // Fetch remaining pages
    const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
    
    for (const page of remainingPages) {
      try {
        // Check if page is already cached
        const cachedPage = getCachedProperties(page);
        if (cachedPage) {
          allProperties = [...allProperties, ...cachedPage.properties];
          loadedPages.push(page);
          
          // Update progress
          if (onProgressUpdate) {
            onProgressUpdate(loadedPages.length, totalPages);
          }
          continue;
        }
        
        // Fetch the page with rate limiting and retry
        try {
          const pageResult = await fetchPropertiesFromRapidApi(page);
          allProperties = [...allProperties, ...pageResult.properties];
          loadedPages.push(page);
        } catch (pageError) {
          console.error(`Failed to fetch page ${page} after retries:`, pageError);
          // Continue with next page, the error has already been logged
        }
        
        // Update progress
        if (onProgressUpdate) {
          onProgressUpdate(loadedPages.length, totalPages);
        }
      } catch (error) {
        console.error(`Error fetching page ${page}:`, error);
        // Continue with other pages even if one fails
      }
    }
    
    return {
      properties: allProperties,
      totalCount: firstPageResult.totalCount,
      totalPages: totalPages,
      loadedPages
    };
  } catch (error) {
    console.error("Error prefetching all properties:", error);
    return { properties: [], totalCount: 0, totalPages: 0, loadedPages: [] };
  }
}

// Search for properties with pagination
export async function searchProperties(
  params: PropertySearchParams, 
  page = 1
): Promise<{properties: Property[], driveTimePolygons: DriveTimePolygon[], pagination: {currentPage: number, totalPages: number, totalCount: number}}> {
  try {
    // Calculate maximum home price based on monthly payment and down payment
    const maxPrice = calculateMaxHomePrice(params.maxMonthlyPayment, params.downPaymentPercent);

    console.log(`Searching properties with max price: ${maxPrice}, page: ${page}`);

    // Fetch drive time polygons
    const driveTimePolygons = await fetchDriveTimePolygons();
    
    // Create a combined polygon for visualization (not critical if it fails)
    let combinedPolygon;
    try {
      combinedPolygon = createCombinedPolygon(driveTimePolygons);
    } catch (e) {
      console.warn("Error creating combined polygon:", e);
      // Continue without the combined polygon
    }

    // Fetch properties from RapidAPI with pagination
    const propertiesData = await fetchPropertiesFromRapidApi(page);
    const { properties, totalCount, totalPages } = propertiesData;

    // Filter properties based on price, location (in polygons), and calculate monthly payment
    const filteredProperties = properties
      .filter((property) => {
        // Filter by price
        if (property.price > maxPrice) return false;
        
        // Filter by location - must be inside at least one of the drive time polygons
        if (property.lat && property.lng) {
          return isPointInPolygons(property.lat, property.lng, driveTimePolygons);
        }
        
        return false; // Skip properties without coordinates
      })
      .map((property) => ({
        ...property,
        monthlyPayment: calculateMonthlyPayment(property.price, params.downPaymentPercent),
      }));

    // Apply optional filters
    let result = filteredProperties;
    
    // Filter by minimum bedrooms
    if (params.minBedrooms) {
      result = result.filter(property => property.bedrooms >= params.minBedrooms!);
    }
    
    // Filter by minimum bathrooms
    if (params.minBathrooms) {
      result = result.filter(property => property.bathrooms >= params.minBathrooms!);
    }
    
    // Filter by minimum square feet
    if (params.minSquareFeet) {
      result = result.filter(property => property.squareFeet >= params.minSquareFeet!);
    }

    console.log(`Found ${result.length} properties on page ${page} after filtering (Total: ${totalCount})`);

    return {
      properties: result,
      driveTimePolygons,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount
      }
    };
  } catch (error) {
    console.error(`Error searching properties on page ${page}:`, error);
    throw error;
  }
}
