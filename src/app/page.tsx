"use client";

import { useState, useEffect } from "react";
import { SearchForm } from "@/components/SearchForm";
import { PropertyResults } from "@/components/PropertyResults";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { PrefetchProgress } from "@/components/PrefetchProgress";

export default function Home() {
  const [searchResults, setSearchResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [directResults, setDirectResults] = useState(null);
  const [isDirectLoading, setIsDirectLoading] = useState(false);
  const [showSearchForm, setShowSearchForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isPrefetching, setIsPrefetching] = useState(false);
  const [showAllProperties, setShowAllProperties] = useState(false);

  // State to track enabled polygon indices for filtering
  const [enabledPolygonIndices, setEnabledPolygonIndices] = useState<number[] | undefined>(undefined);

  // Fetch properties when the page loads, page changes, showAllProperties changes, or filter changes
  useEffect(() => {
    fetchDirectProperties();
  }, [currentPage, showAllProperties, enabledPolygonIndices]);

  // Handle search form submission
  async function handleSearch(formData, page = 1) {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/search?page=${page}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const data = await response.json();
      // Store the form data for pagination
      data.formData = formData;
      
      setSearchResults(data);
      setCurrentPage(page); // Update current page
    } catch (error) {
      console.error("Error submitting search:", error);
      alert("Error submitting search. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }
  
  // Handle page change
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    
    // If we have search results, we need to rerun the search with the new page
    if (searchResults) {
      // Re-run the search with the same form data but different page
      handleSearch(searchResults.formData, newPage);
    }
    // Otherwise the useEffect will handle fetching the new page for direct results
  }

  // Handler to refresh properties
  const handleRefreshProperties = async () => {
    try {
      await fetch("/api/clearCache", { method: "POST" });
      window.location.reload();
    } catch (error) {
      console.error("Error clearing cache:", error);
    }
  };
  
  // Handler to debug isochrones
  const handleDebugIsochrones = async () => {
    try {
      // First, clear the isochrones cache
      await fetch("/api/clearIsochrones", { method: "GET" });
      // Then refresh the isochrones and debug
      window.open("/api/debugIsochrones", "_blank");
    } catch (error) {
      console.error("Error debugging isochrones:", error);
    }
  };
  
  // Handler to start prefetching all properties
  const handlePrefetchAll = () => {
    setIsPrefetching(true);
  };
  
  // Handler for when prefetching completes
  const handlePrefetchComplete = () => {
    setIsPrefetching(false);
    setShowAllProperties(true);
    // Reload the page data
    fetchDirectProperties();
  };
  
  // Handler for when prefetching encounters an error
  const handlePrefetchError = (message: string) => {
    setIsPrefetching(false);
    alert(`Error prefetching properties: ${message}`);
  };
  
  // Fetch all properties that have been cached
  async function fetchDirectProperties() {
    setIsDirectLoading(true);
    try {
      // Prepare URL with parameters
      let url;
      
      if (showAllProperties) {
        // Use the new "all" mode to fetch all properties at once
        url = `/api/search?all=true`;
        if (enabledPolygonIndices && enabledPolygonIndices.length > 0) {
          url += `&enabledPolygonIndices=${JSON.stringify(enabledPolygonIndices)}`;
        }
        
        console.log("Fetching ALL properties at once with URL:", url);
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("Failed to fetch all properties");
        }
        
        const data = await response.json();
        console.log(`Received ${data.properties?.length || 0} properties from all-mode API`);
        
        // Set results directly from the API response
        setDirectResults(data);
      } else {
        // Regular paginated mode - just fetch the current page
        url = `/api/search?page=${currentPage}`;
        if (enabledPolygonIndices && enabledPolygonIndices.length > 0) {
          url += `&enabledPolygonIndices=${JSON.stringify(enabledPolygonIndices)}`;
        }
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("Failed to fetch properties");
        }
        
        const data = await response.json();
        setDirectResults({
          properties: data.properties || [],
          driveTimePolygons: data.driveTimePolygons || [],
          pagination: data.pagination || { currentPage: 1, totalPages: 1, totalCount: 0 },
          filterStats: data.filterStats
        });
      }
    } catch (error) {
      console.error("Error fetching properties:", error);
    } finally {
      setIsDirectLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Property Search</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSearchForm(!showSearchForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              {showSearchForm ? "Hide Search" : "Custom Search"}
            </button>
            <button
              onClick={handleRefreshProperties}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition"
              disabled={isDirectLoading || isPrefetching}
            >
              Refresh Data
            </button>
            <button
              onClick={handlePrefetchAll}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"
              disabled={isPrefetching}
            >
              {showAllProperties ? "Reload All Properties" : "Load All Properties"}
            </button>
            <button
              onClick={handleDebugIsochrones}
              className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition"
            >
              Debug Isochrones
            </button>
          </div>
        </div>

        {showSearchForm && (
          <div className="mb-8 p-6 bg-gray-50 rounded-lg border">
            <h3 className="text-lg font-medium mb-4">Custom Search Criteria</h3>
            <SearchForm onSubmit={handleSearch} />
          </div>
        )}

        {/* Prefetch Progress */}
        {isPrefetching && (
          <div className="my-8">
            <PrefetchProgress 
              onComplete={handlePrefetchComplete}
              onError={handlePrefetchError}
            />
          </div>
        )}

        {/* Search Results */}
        {isLoading && !isPrefetching && (
          <div className="flex justify-center my-12">
            <LoadingSpinner />
          </div>
        )}

        {searchResults && !isLoading && !isPrefetching && (
          <div className="mb-12">
            <h3 className="text-xl font-semibold mb-4">Search Results</h3>
            <PropertyResults 
              results={searchResults} 
              onPageChange={(page) => {
                if (searchResults.formData) {
                  handleSearch(searchResults.formData, page);
                }
              }}
            />
          </div>
        )}

        {/* All Properties */}
        {!isPrefetching && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">
                {showAllProperties ? "All Properties" : "Available Properties"}
                {showAllProperties && directResults?.properties?.length > 0 && 
                  ` (${directResults.properties.length.toLocaleString()})`
                }
              </h3>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Show All Properties:</span>
                <label className="inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={showAllProperties}
                    onChange={() => setShowAllProperties(!showAllProperties)}
                    className="sr-only peer"
                  />
                  <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
            {isDirectLoading ? (
              <div className="flex justify-center my-8">
                <LoadingSpinner />
              </div>
            ) : directResults?.properties?.length > 0 ? (
              <PropertyResults 
                results={directResults} 
                onPageChange={showAllProperties ? undefined : handlePageChange}
                onFilterChange={(indices) => {
                  setEnabledPolygonIndices(indices.length > 0 ? indices : undefined);
                }}
              />
            ) : (
              <div className="p-8 text-center bg-gray-50 rounded-lg">
                <p className="text-gray-600">
                  No properties available. Please try a different search.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
