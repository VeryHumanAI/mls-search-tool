"use client";

import { useState, useEffect } from "react";
import { LoadingSpinner } from "./LoadingSpinner";

type PrefetchProgressProps = {
  onComplete: () => void;
  onError: (message: string) => void;
};

export function PrefetchProgress({ onComplete, onError }: PrefetchProgressProps) {
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    percentage: number;
  } | null>(null);
  const [status, setStatus] = useState<'connecting' | 'loading' | 'complete' | 'error'>('connecting');
  const [statusMessage, setStatusMessage] = useState("Connecting to server...");

  useEffect(() => {
    // Set up SSE connection to the prefetch endpoint
    const eventSource = new EventSource('/api/prefetchAll');
    
    eventSource.onopen = () => {
      setStatus('loading');
      setStatusMessage("Starting to prefetch properties...");
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle progress updates
        if (data.progress) {
          setProgress(data.progress);
          setStatusMessage(`Loading properties page ${data.progress.current} of ${data.progress.total}...`);
        }
        
        // Handle completion
        if (data.complete) {
          setStatus('complete');
          setStatusMessage(`Successfully loaded ${data.totalProperties} properties from ${data.loadedPages.length} pages!`);
          eventSource.close();
          onComplete();
        }
        
        // Handle errors
        if (data.error) {
          setStatus('error');
          setStatusMessage(`Error: ${data.message}`);
          eventSource.close();
          onError(data.message);
        }
      } catch (e) {
        console.error("Error parsing SSE message:", e);
      }
    };

    eventSource.onerror = () => {
      setStatus('error');
      setStatusMessage("Connection error. Please try again.");
      eventSource.close();
      onError("Connection error. Please try again.");
    };

    // Clean up function
    return () => {
      eventSource.close();
    };
  }, [onComplete, onError]);

  return (
    <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-lg mx-auto text-center">
      <h3 className="text-xl font-semibold mb-4">Prefetching All Properties</h3>
      
      <div className="flex items-center justify-center mb-4">
        {status !== 'complete' && <LoadingSpinner className="mr-3" />}
        <p className="text-gray-700">{statusMessage}</p>
      </div>
      
      <div className="text-xs text-gray-500 mb-3">
        Rate limited to 1 request per second with automatic retries for 429 errors
      </div>
      
      {progress && (
        <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
          <div 
            className="bg-blue-600 h-4 rounded-full"
            style={{ width: `${progress.percentage}%` }}
          />
          <p className="text-sm text-gray-600 mt-1">
            {progress.percentage}% ({progress.current} of {progress.total} pages)
          </p>
        </div>
      )}
      
      {status === 'error' && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md">
          Error loading properties. Please try again or contact support if the problem persists.
        </div>
      )}
      
      {status === 'complete' && (
        <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-md">
          All properties have been successfully loaded!
        </div>
      )}
      
      <div className="mt-4 text-sm text-gray-600">
        <p>This process loads all available properties and may take several minutes.</p>
        <p>Properties are cached so you won't need to reload them next time.</p>
      </div>
    </div>
  );
}