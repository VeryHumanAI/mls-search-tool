import axios from "axios";
import getConfig from "next/config";
import { Property, PropertySearchParams, DriveTimePolygon } from "@/types/property";
import { getCachedProperties, cacheProperties, clearCache } from "./cache";
import {
  fetchDriveTimePolygons,
  createCombinedPolygon,
  isPointInPolygons,
} from "./driveTimeLocations";
import { withRateLimit } from "./rateLimit";

// Get server-side config
const { serverRuntimeConfig } = getConfig() || { serverRuntimeConfig: {} };

// Calculate monthly mortgage payment
export function calculateMonthlyPayment(
  price: number,
  downPaymentPercent: number,
  interestRate = 0.065, // Default to 6.5%
  loanTermYears = 30,
  verbose = false
): number {
  // Calculate loan amount
  const downPayment = price * (downPaymentPercent / 100);
  const loanAmount = price - downPayment;

  // Calculate monthly interest rate
  const monthlyRate = interestRate / 12;

  // Calculate number of payments
  const numPayments = loanTermYears * 12;

  // Calculate monthly payment using the mortgage formula
  const principalAndInterest =
    loanAmount *
    ((monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
      (Math.pow(1 + monthlyRate, numPayments) - 1));

  // Add property tax (estimated at 1.1% of home value annually)
  const monthlyPropertyTax = (price * 0.011) / 12;

  // Add homeowners insurance (estimated at $1200 annually)
  const monthlyInsurance = 1200 / 12;

  // Calculate total monthly payment
  const totalMonthlyPayment = principalAndInterest + monthlyPropertyTax + monthlyInsurance;

  // Log detailed breakdown if verbose is true
  if (verbose) {
    console.log(`MONTHLY PAYMENT BREAKDOWN for $${price.toLocaleString()} home:
    - Down Payment (${downPaymentPercent}%): $${downPayment.toLocaleString()}
    - Loan Amount: $${loanAmount.toLocaleString()}
    - Interest Rate: ${(interestRate * 100).toFixed(2)}%
    - Loan Term: ${loanTermYears} years
    - Principal & Interest: $${Math.round(principalAndInterest).toLocaleString()}/month
    - Property Tax (1.1%): $${Math.round(monthlyPropertyTax).toLocaleString()}/month
    - Insurance: $${Math.round(monthlyInsurance).toLocaleString()}/month
    - TOTAL MONTHLY PAYMENT: $${Math.round(totalMonthlyPayment).toLocaleString()}/month`);
  }

  return totalMonthlyPayment;
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

  // Log the calculation inputs
  console.log(`MAX PRICE CALCULATION INPUTS:
    - Max Monthly Payment: $${maxMonthlyPayment.toLocaleString()}
    - Down Payment %: ${downPaymentPercent}%
    - Interest Rate: ${(interestRate * 100).toFixed(2)}%
    - Loan Term: ${loanTermYears} years
    - Estimated Tax & Insurance: $${estimatedTaxAndInsurance}/month`);

  // Available payment for principal and interest
  const availableForPI = Math.max(0, maxMonthlyPayment - estimatedTaxAndInsurance);
  console.log(`  - Available for principal & interest: $${availableForPI.toLocaleString()}/month`);

  // If no money is available for P&I, return 0
  if (availableForPI <= 0) {
    console.log(`  - No money available for principal & interest, max home price is $0`);
    return 0;
  }

  // Monthly interest rate
  const monthlyRate = interestRate / 12;

  // Number of payments
  const numPayments = loanTermYears * 12;

  // Calculate loan amount using mortgage formula rearranged
  const loanAmount =
    availableForPI /
    ((monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
      (Math.pow(1 + monthlyRate, numPayments) - 1));

  console.log(`  - Maximum loan amount: $${loanAmount.toLocaleString()}`);

  // Calculate total price including down payment
  const totalPrice = loanAmount / (1 - downPaymentPercent / 100);
  console.log(`  - Maximum home price: $${totalPrice.toLocaleString()}`);

  // Double-check the calculation by using the reverse function
  const calculatedMonthly = calculateMonthlyPayment(
    totalPrice,
    downPaymentPercent,
    interestRate,
    loanTermYears
  );
  console.log(
    `  - Verification: Monthly payment for $${totalPrice.toLocaleString()} home: $${calculatedMonthly.toLocaleString()}`
  );

  return totalPrice;
}

// Fetch a single page of properties from RapidAPI
export async function fetchPropertiesFromRapidApi(
  page = 1,
  limit = 200
): Promise<{ properties: Property[]; totalCount: number; totalPages: number }> {
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
      search_radius: "50",
      foreclosure: "false",
      "list_price-max": "650000",
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
export async function prefetchAllProperties(
  onProgressUpdate?: (current: number, total: number) => void
): Promise<{
  properties: Property[];
  totalCount: number;
  totalPages: number;
  loadedPages: number[];
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
      loadedPages,
    };
  } catch (error) {
    console.error("Error prefetching all properties:", error);
    return { properties: [], totalCount: 0, totalPages: 0, loadedPages: [] };
  }
}

// Search for properties with pagination
export async function searchProperties(
  params: PropertySearchParams,
  page = 1,
  enabledPolygonIndices?: number[]
): Promise<{
  properties: Property[];
  driveTimePolygons: DriveTimePolygon[];
  pagination: { currentPage: number; totalPages: number; totalCount: number };
}> {
  try {
    // Calculate maximum home price based on monthly payment and down payment
    const maxPrice = calculateMaxHomePrice(params.maxMonthlyPayment, params.downPaymentPercent);

    console.log(`Searching properties with max price: ${maxPrice}, page: ${page}`);
    if (enabledPolygonIndices) {
      console.log(`Filtering by polygon indices: ${enabledPolygonIndices.join(", ")}`);
    }

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
    console.log(
      `Filtering ${properties.length} properties with max price: $${maxPrice.toLocaleString()}`
    );

    const filteredProperties = properties
      .filter((property) => {
        // For random properties (roughly 1 in 20), show detailed breakdown
        const showVerbose = Math.random() < 0.05;

        // Calculate monthly payment (with verbose logging for random properties)
        const monthlyPayment = calculateMonthlyPayment(
          property.price,
          params.downPaymentPercent,
          0.065, // Default interest rate
          30, // Default loan term
          showVerbose // Detailed logging for random properties
        );

        const priceFilter = property.price <= maxPrice;

        // Debug log for properties being filtered out by price
        if (!priceFilter) {
          console.log(
            `PRICE FILTER: Property ID ${property.id}: $${property.price.toLocaleString()} exceeds max price $${maxPrice.toLocaleString()} [Address: ${property.address}]`
          );
          console.log(
            `PRICE FILTER: Monthly payment would be $${Math.round(monthlyPayment).toLocaleString()} vs max $${params.maxMonthlyPayment.toLocaleString()}`
          );

          // Show detailed breakdown for edge cases where price is close to limit
          if (property.price <= maxPrice * 1.1) {
            calculateMonthlyPayment(property.price, params.downPaymentPercent, 0.065, 30, true);
          }
        }

        // If already failing price filter, return early before location check
        if (!priceFilter) return false;

        // Filter by location - must be inside ALL of the enabled drive time polygons
        if (property.lat && property.lng) {
          const locationFilter = isPointInPolygons(
            property.lat,
            property.lng,
            driveTimePolygons,
            enabledPolygonIndices
          );

          // Debug log for properties being filtered out by location
          if (!locationFilter) {
            console.log(
              `LOCATION FILTER: Property ID ${property.id}: Failed location filter [Address: ${property.address}]`
            );
          }

          return locationFilter;
        }

        console.log(
          `LOCATION FILTER: Property ID ${property.id}: Missing coordinates [Address: ${property.address}]`
        );
        return false; // Skip properties without coordinates
      })
      .map((property) => {
        const monthlyPayment = calculateMonthlyPayment(property.price, params.downPaymentPercent);
        console.log(
          `PASSED: Property ID ${property.id}: $${property.price.toLocaleString()} [Est. monthly: $${Math.round(monthlyPayment).toLocaleString()}] [Address: ${property.address}]`
        );

        return {
          ...property,
          monthlyPayment,
        };
      });

    // Apply optional filters
    let result = filteredProperties;

    // Filter by minimum bedrooms
    if (params.minBedrooms) {
      result = result.filter((property) => property.bedrooms >= params.minBedrooms!);
    }

    // Filter by minimum bathrooms
    if (params.minBathrooms) {
      result = result.filter((property) => property.bathrooms >= params.minBathrooms!);
    }

    // Filter by minimum square feet
    if (params.minSquareFeet) {
      result = result.filter((property) => property.squareFeet >= params.minSquareFeet!);
    }

    // Calculate how many properties were filtered by each criteria
    const totalAfterPriceFilter = properties.filter((p) => p.price <= maxPrice).length;
    const totalFilteredByPrice = properties.length - totalAfterPriceFilter;
    const totalFilteredByLocation = totalAfterPriceFilter - result.length;

    // Log detailed filtering statistics
    console.log(`FILTER STATS:
    - Starting with ${properties.length} properties on page ${page}
    - Filtered out ${totalFilteredByPrice} properties by price (${Math.round((totalFilteredByPrice / properties.length) * 100)}%)
    - Filtered out ${totalFilteredByLocation} properties by location (${Math.round((totalFilteredByLocation / properties.length) * 100)}%)
    - Remaining: ${result.length} properties (${Math.round((result.length / properties.length) * 100)}% of original)
    `);

    console.log(
      `Found ${result.length} properties on page ${page} after filtering (Total database count: ${totalCount})`
    );

    return {
      properties: result,
      driveTimePolygons,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
      },
      filterStats: {
        totalPropertiesOnPage: properties.length,
        filteredByPrice: totalFilteredByPrice,
        filteredByLocation: totalFilteredByLocation,
        remainingAfterFilters: result.length,
        maxPriceFilter: maxPrice,
        maxMonthlyPaymentFilter: params.maxMonthlyPayment,
        downPaymentPercent: params.downPaymentPercent,
        enabledPolygonCount: enabledPolygonIndices
          ? enabledPolygonIndices.length
          : driveTimePolygons.length,
      },
    };
  } catch (error) {
    console.error(`Error searching properties on page ${page}:`, error);
    throw error;
  }
}
