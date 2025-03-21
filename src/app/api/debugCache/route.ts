import { NextResponse } from "next/server";
import { clearCache, debugCacheFiles } from "@/lib/cache";

// Debug API endpoint to examine cache consistency and clear cache if needed
export async function GET(request: Request) {
  try {
    // Get query params
    const { searchParams } = new URL(request.url);
    const clearOption = searchParams.get("clear") === "true";
    
    // Run debug function first
    console.log("Running cache debug analysis:");
    debugCacheFiles();
    
    // Clear cache if requested
    if (clearOption) {
      console.log("Clearing cache as requested");
      clearCache();
    }

    return NextResponse.json({ 
      success: true, 
      message: "Cache debug completed. Check server logs for details.",
      cleared: clearOption
    });
  } catch (error) {
    console.error("Error debugging cache:", error);
    return NextResponse.json({ error: "Failed to debug cache" }, { status: 500 });
  }
}