import axios from "axios";
import getConfig from "next/config";
import { Property, PropertySearchParams } from "@/types/property";

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

// Fetch properties from RapidAPI
export async function fetchPropertiesFromRapidApi(): Promise<Property[]> {
  const RAPIDAPI_KEY = serverRuntimeConfig.NEXT_RAPIDAPI_KEY;
  const RAPIDAPI_HOST = serverRuntimeConfig.NEXT_RAPIDAPI_HOST;

  if (!RAPIDAPI_KEY || !RAPIDAPI_HOST) {
    console.error("RapidAPI credentials are missing");
    return [];
  }

  const options = {
    method: "GET",
    url: "https://realtor16.p.rapidapi.com/search/forsale",
    params: {
      location: "hamilton county, tn",
      type: "single_family,duplex_triplex,multi_family",
      limit: "200",
      search_radius: "25",
      foreclosure: "false",
      "list_price-max": "500000",
    },
    headers: {
      "x-rapidapi-key": RAPIDAPI_KEY,
      "x-rapidapi-host": RAPIDAPI_HOST,
    },
  };

  try {
    console.log("Fetching properties from RapidAPI...");
    const response = await axios.request(options);
    const data = response.data; // response is already JSON so we don't need to parse it

    if (!data.properties || !Array.isArray(data.properties)) {
      console.error("Invalid response format from RapidAPI:", data);
      return [];
    }

    // Transform the API response into our Property type
    return data.properties.map((property: any) => {
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
  } catch (error) {
    console.error("Error fetching properties from RapidAPI:", error);
    return [];
  }
}

// Search for properties
export async function searchProperties(params: PropertySearchParams): Promise<Property[]> {
  try {
    // Calculate maximum home price based on monthly payment and down payment
    const maxPrice = calculateMaxHomePrice(params.maxMonthlyPayment, params.downPaymentPercent);

    console.log("Searching properties with max price:", maxPrice);

    // Fetch properties from RapidAPI
    const properties = await fetchPropertiesFromRapidApi();

    // Filter properties based on price and calculate monthly payment
    const filteredProperties = properties
      .filter((property) => property.price <= maxPrice)
      .map((property) => ({
        ...property,
        monthlyPayment: calculateMonthlyPayment(property.price, params.downPaymentPercent),
      }));

    return filteredProperties;
  } catch (error) {
    console.error("Error searching properties:", error);
    throw error;
  }
}
