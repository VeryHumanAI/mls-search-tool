import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const CACHE_DIR = path.join(process.cwd(), ".cache");
    const ISOCHRONES_CACHE_FILE = path.join(CACHE_DIR, "isochrones.json");

    if (fs.existsSync(ISOCHRONES_CACHE_FILE)) {
      fs.unlinkSync(ISOCHRONES_CACHE_FILE);
      return NextResponse.json({ success: true, message: "Isochrones cache cleared successfully" });
    } else {
      return NextResponse.json({ success: true, message: "No isochrones cache to clear" });
    }
  } catch (error) {
    console.error("Error clearing isochrones cache:", error);
    return NextResponse.json(
      { success: false, error: "Failed to clear isochrones cache" },
      { status: 500 }
    );
  }
}