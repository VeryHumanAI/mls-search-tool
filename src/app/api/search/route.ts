import { NextResponse } from 'next/server';
import { geocodeAddress, getDriveTimeIsochrone, parseDriveTime } from '@/lib/geoapify';
import { searchProperties } from '@/lib/propertyService';
import * as turf from '@turf/turf';

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

export async function POST(request: Request) {
  try {
    const data: SearchRequest = await request.json();
    
    // 1. Geocode all addresses
    const geocodePromises = data.locations.map(location => 
      geocodeAddress(location.address)
    );
    
    const geocodedLocations = await Promise.all(geocodePromises);
    
    // 2. Get isochrones (drive time polygons) for each location
    const isochronePromises = data.locations.map((location, index) => {
      const geocoded = geocodedLocations[index];
      const timeMinutes = parseDriveTime(location.driveTime);
      
      return getDriveTimeIsochrone(geocoded.lat, geocoded.lon, timeMinutes);
    });
    
    const isochroneResults = await Promise.all(isochronePromises);
    
    // 3. Combine all isochrones using turf.js union
    // For this mock implementation, we'll just use the first isochrone
    const combinedPolygon = isochroneResults[0];
    
    // 4. Search for properties within the combined area and budget
    const properties = await searchProperties({
      polygon: combinedPolygon,
      maxMonthlyPayment: data.budget.maxPerMonth,
      downPaymentPercent: data.budget.downPaymentPercent,
    });
    
    // 5. Return the results
    return NextResponse.json({
      properties,
      driveTimePolygons: data.locations.map((location, index) => ({
        address: location.address,
        driveTime: location.driveTime,
        geoJson: isochroneResults[index],
      })),
    });
  } catch (error) {
    console.error('Error in search API:', error);
    return NextResponse.json(
      { error: 'Failed to process search request' },
      { status: 500 }
    );
  }
}

// New API endpoint for just fetching properties directly
export async function GET() {
  try {
    // Search for properties with default parameters
    const properties = await searchProperties({
      polygon: null, // No geographic constraints
      maxMonthlyPayment: 3000, // Default maximum monthly payment
      downPaymentPercent: 20, // Default down payment percentage
    });

    return NextResponse.json({ properties });
  } catch (error) {
    console.error('Error in properties API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch properties' },
      { status: 500 }
    );
  }
}