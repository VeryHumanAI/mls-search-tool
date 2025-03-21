import { NextResponse } from "next/server";
import { fetchDriveTimePolygons } from "@/lib/driveTimeLocations";

export async function GET() {
  try {
    // Force refresh isochrones
    console.log("Forcing refresh of isochrones...");
    const polygons = await fetchDriveTimePolygons(true);
    
    return NextResponse.json({ 
      success: true, 
      message: `Refreshed ${polygons.length} isochrones successfully` 
    });
  } catch (error) {
    console.error("Error refreshing isochrones:", error);
    return NextResponse.json(
      { success: false, error: "Failed to refresh isochrones" },
      { status: 500 }
    );
  }
}