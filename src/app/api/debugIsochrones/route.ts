import { NextResponse } from "next/server";
import { fetchDriveTimePolygons } from "@/lib/driveTimeLocations";

export async function GET() {
  try {
    // Force refresh isochrones
    console.log("Fetching isochrones for debug...");
    const polygons = await fetchDriveTimePolygons(true);
    
    // Create a simplified version for debugging
    const simplifiedPolygons = polygons.map(polygon => {
      return {
        address: polygon.address,
        driveTime: polygon.driveTime,
        geoJsonType: polygon.geoJson?.type,
        hasFeaturesArray: Boolean(polygon.geoJson?.features),
        featureCount: polygon.geoJson?.features?.length || 0,
        featureTypes: polygon.geoJson?.features?.map(f => f.type) || [],
        geometryTypes: polygon.geoJson?.features?.map(f => f.geometry?.type) || [],
        firstFeature: polygon.geoJson?.features?.[0] || null
      };
    });
    
    return NextResponse.json({ 
      count: polygons.length,
      simplified: simplifiedPolygons,
      full: polygons 
    });
  } catch (error) {
    console.error("Error getting debug isochrones:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get isochrones for debugging" },
      { status: 500 }
    );
  }
}