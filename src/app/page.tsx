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

  // Fetch properties directly when the page loads
  useEffect(() => {
    async function fetchDirectProperties() {
      setIsDirectLoading(true);
      try {
        const response = await fetch("/api/search");
        if (!response.ok) {
          throw new Error("Failed to fetch properties");
        }
        const data = await response.json();
        setDirectResults({ properties: data.properties, driveTimePolygons: [] });
      } catch (error) {
        console.error("Error fetching properties:", error);
      } finally {
        setIsDirectLoading(false);
      }
    }

    fetchDirectProperties();
  }, []);

  // Handle search form submission
  async function handleSearch(formData) {
    setIsLoading(true);
    try {
      const response = await fetch("/api/search", {
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
      setSearchResults(data);
    } catch (error) {
      console.error("Error submitting search:", error);
      alert("Error submitting search. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Find Your Dream Home</h1>

      <div className="mb-8">
        <SearchForm onSubmit={handleSearch} />
      </div>

      {isLoading && (
        <div className="flex justify-center my-12">
          <LoadingSpinner />
        </div>
      )}

      {searchResults && !isLoading && <PropertyResults results={searchResults} />}

      <div className="mt-12 border-t pt-6">
        <h2 className="text-2xl font-bold mb-4">Available Properties</h2>
        {isDirectLoading ? (
          <div className="flex justify-center my-8">
            <LoadingSpinner />
          </div>
        ) : directResults ? (
          <PropertyResults results={directResults} />
        ) : (
          <p>No properties available. Please try a different search.</p>
        )}
      </div>
    </main>
  );
}
