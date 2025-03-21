import { NextResponse } from "next/server";
import { geocodeAddress, getDriveTimeIsochrone, parseDriveTime } from "@/lib/geoapify";
import { searchProperties } from "@/lib/propertyService";
import { Property, DriveTimePolygon } from "@/types/property";
import * as turf from "@turf/turf";
import { fetchDriveTimePolygons } from "@/lib/driveTimeLocations";

// Type for request body
type SearchRequest = {
  locations: {
    address: string;
    driveTime: string;
  }[];
  budget: {
    maxPerMonth: number;
    downPaymentPercent: number;
  };
};

type SearchResponse = {
  properties: Property[];
  driveTimePolygons: DriveTimePolygon[];
};

export async function POST(request: Request) {
  try {
    const data: SearchRequest = await request.json();

    // 1. Use custom locations if provided, otherwise use hardcoded ones
    let driveTimePolygons: DriveTimePolygon[] = [];
    
    if (data.locations && data.locations.length > 0) {
      // Process provided locations
      // 1. Geocode all addresses
      const geocodePromises = data.locations.map((location) => geocodeAddress(location.address));
      const geocodedLocations = await Promise.all(geocodePromises);

      // 2. Get isochrones (drive time polygons) for each location
      const isochronePromises = data.locations.map((location, index) => {
        const geocoded = geocodedLocations[index];
        const timeMinutes = parseDriveTime(location.driveTime);
        return getDriveTimeIsochrone(geocoded.lat, geocoded.lon, timeMinutes);
      });

      const isochroneResults = await Promise.all(isochronePromises);

      // Create drive time polygons from the results
      driveTimePolygons = data.locations.map((location, index) => ({
        address: location.address,
        driveTime: location.driveTime,
        geoJson: isochroneResults[index],
      }));
    }

    // 3. Search for properties within the combined area and budget
    const searchResults = await searchProperties({
      polygon: null, // Unused now, we filter by polygons inside searchProperties
      maxMonthlyPayment: data.budget.maxPerMonth,
      downPaymentPercent: data.budget.downPaymentPercent,
    });

    // 4. Return the results
    return NextResponse.json(searchResults);
  } catch (error) {
    console.error("Error in search API:", error);
    return NextResponse.json({ error: "Failed to process search request" }, { status: 500 });
  }
}

// New API endpoint for just fetching properties directly
export async function GET() {
  try {
    // Search for properties with default parameters
    const searchResults = await searchProperties({
      polygon: null, // No geographic constraints
      maxMonthlyPayment: 3000, // Default maximum monthly payment
      downPaymentPercent: 20, // Default down payment percentage
    });

    return NextResponse.json(searchResults);
  } catch (error) {
    console.error("Error in properties API:", error);
    return NextResponse.json({ error: "Failed to fetch properties" }, { status: 500 });
  }
}
