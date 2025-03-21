"use client";

import { useState, useEffect } from "react";
import { SearchForm } from "@/components/SearchForm";
import { PropertyResults } from "@/components/PropertyResults";
import { LoadingSpinner } from "@/components/LoadingSpinner";

export default function Home() {
  const [searchResults, setSearchResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [directResults, setDirectResults] = useState(null);
  const [isDirectLoading, setIsDirectLoading] = useState(false);
  const [showSearchForm, setShowSearchForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch properties directly when the page loads or when page changes
  useEffect(() => {
    async function fetchDirectProperties() {
      setIsDirectLoading(true);
      try {
        const response = await fetch(`/api/search?page=${currentPage}`);
        if (!response.ok) {
          throw new Error("Failed to fetch properties");
        }
        const data = await response.json();
        console.log("API response:", data);
        setDirectResults({ 
          properties: data.properties || [], 
          driveTimePolygons: data.driveTimePolygons || [],
          pagination: data.pagination || { currentPage: 1, totalPages: 1, totalCount: 0 }
        });
      } catch (error) {
        console.error("Error fetching properties:", error);
      } finally {
        setIsDirectLoading(false);
      }
    }

    fetchDirectProperties();
  }, [currentPage]);

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
              disabled={isDirectLoading}
            >
              Refresh Data
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

        {isLoading && (
          <div className="flex justify-center my-12">
            <LoadingSpinner />
          </div>
        )}

        {searchResults && !isLoading && (
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

        <div className="mt-8">
          <h3 className="text-xl font-semibold mb-4">Available Properties</h3>
          {isDirectLoading ? (
            <div className="flex justify-center my-8">
              <LoadingSpinner />
            </div>
          ) : directResults?.properties?.length > 0 ? (
            <PropertyResults 
              results={directResults} 
              onPageChange={handlePageChange}
            />
          ) : (
            <div className="p-8 text-center bg-gray-50 rounded-lg">
              <p className="text-gray-600">
                No properties available. Please try a different search.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
