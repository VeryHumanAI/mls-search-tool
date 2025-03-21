import { NextResponse } from "next/server";
import { prefetchAllProperties } from "@/lib/propertyService";
import { clearCache } from "@/lib/cache";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clearCacheParam = searchParams.get('clearCache');
    
    // Clear the cache if requested
    if (clearCacheParam === 'true') {
      clearCache();
      console.log("Cache cleared before prefetching");
    }
    
    // Start prefetching all properties
    const prefetchResult = await prefetchAllProperties();
    
    // Check if we had any missing pages (might be due to rate limiting)
    const missingPages = [];
    if (prefetchResult.totalPages > 0) {
      for (let i = 1; i <= prefetchResult.totalPages; i++) {
        if (!prefetchResult.loadedPages.includes(i)) {
          missingPages.push(i);
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Prefetched ${prefetchResult.properties.length} properties across ${prefetchResult.loadedPages.length} pages`,
      totalPages: prefetchResult.totalPages,
      totalCount: prefetchResult.totalCount,
      loadedPages: prefetchResult.loadedPages,
      missingPages: missingPages.length > 0 ? missingPages : undefined
    });
  } catch (error) {
    console.error("Error in prefetch all API:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to prefetch all properties",
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// SSE endpoint for getting prefetch status
export async function POST(request: Request) {
  // Set up Server-Sent Events response headers
  const responseHeaders = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  };

  try {
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();

    // Function to send progress updates through SSE
    const sendProgressUpdate = async (current: number, total: number) => {
      const progressData = {
        progress: {
          current,
          total,
          percentage: Math.round((current / total) * 100)
        }
      };
      
      await writer.write(
        encoder.encode(`data: ${JSON.stringify(progressData)}\n\n`)
      );
    };

    // Start the prefetching process in the background
    const prefetchPromise = prefetchAllProperties(sendProgressUpdate)
      .then(async (result) => {
        // Send completion event
        const completionData = {
          complete: true,
          totalProperties: result.properties.length,
          totalPages: result.totalPages,
          loadedPages: result.loadedPages
        };
        
        await writer.write(
          encoder.encode(`data: ${JSON.stringify(completionData)}\n\n`)
        );
        
        // Close the stream
        await writer.close();
      })
      .catch(async (error) => {
        // Send error event
        const errorData = {
          error: true,
          message: error instanceof Error ? error.message : String(error)
        };
        
        await writer.write(
          encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`)
        );
        
        // Close the stream
        await writer.close();
      });

    // Return the SSE stream
    return new Response(stream.readable, { headers: responseHeaders });
  } catch (error) {
    console.error("Error setting up SSE stream:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to set up prefetch stream"
      },
      { status: 500 }
    );
  }
}