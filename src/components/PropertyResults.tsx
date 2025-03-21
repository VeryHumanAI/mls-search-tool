"use client";

import React, { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Property, DriveTimePolygon, SearchResults } from "@/types/property";

// Dynamically import Map component with no SSR
const MapContainer = dynamic(() => import("react-leaflet").then((mod) => mod.MapContainer), {
  ssr: false,
});

const TileLayer = dynamic(() => import("react-leaflet").then((mod) => mod.TileLayer), {
  ssr: false,
});

const Marker = dynamic(() => import("react-leaflet").then((mod) => mod.Marker), { ssr: false });

const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), { ssr: false });

const GeoJSON = dynamic(() => import("react-leaflet").then((mod) => mod.GeoJSON), {
  ssr: false,
});

const ZoomControl = dynamic(() => import("react-leaflet").then((mod) => mod.ZoomControl), {
  ssr: false,
});

type PropertyResultsProps = {
  results: SearchResults;
};

export function PropertyResults({ results }: PropertyResultsProps) {
  // For client-side only rendering with leaflet
  const [isMounted, setIsMounted] = useState(false);
  const [activeView, setActiveView] = useState<"grid" | "map">("grid");
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // Configure Leaflet icon here since it requires window
    if (isMounted && typeof window !== "undefined") {
      const L = require("leaflet");
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "/marker-icon-2x.png",
        iconUrl: "/marker-icon.png",
        shadowUrl: "/marker-shadow.png",
      });
    }
  }, [isMounted]);

  // When view changes to map, trigger a resize event to force the map to render properly
  useEffect(() => {
    if (activeView === "map" && typeof window !== "undefined") {
      setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
      }, 100);
    }
  }, [activeView]);

  // Mock properties data if no results are provided
  const mockProperties: Property[] = [
    {
      id: "1",
      address: "123 Main St, Anytown, USA",
      price: 450000,
      bedrooms: 3,
      bathrooms: 2,
      squareFeet: 1800,
      lat: 37.7749,
      lng: -122.4194,
      imageUrl: "https://via.placeholder.com/300x200",
      listingUrl: "#",
      monthlyPayment: 2200,
    },
    {
      id: "2",
      address: "456 Oak Ave, Somewhere, USA",
      price: 525000,
      bedrooms: 4,
      bathrooms: 2.5,
      squareFeet: 2100,
      lat: 37.7848,
      lng: -122.4294,
      imageUrl: "https://via.placeholder.com/300x200",
      listingUrl: "#",
      monthlyPayment: 2650,
    },
  ];

  const properties = results.properties.length > 0 ? results.properties : mockProperties;

  // Calculate center of the map based on properties
  const center =
    properties.length > 0
      ? { lat: properties[0].lat, lng: properties[0].lng }
      : { lat: 35.0456, lng: -85.3097 }; // Default to Chattanooga if no properties

  // Function to get a better quality image URL
  const getBetterImageUrl = (property: Property): string => {
    // If it's a placeholder image, return it as is
    if (property.imageUrl.includes("placeholder")) {
      return property.imageUrl;
    }

    // For RapidAPI realtor images, use a larger format by modifying the URL
    // Original thumbnail URLs end with "s.jpg", replace with "l.jpg" for larger images
    return property.imageUrl.replace(/s\.jpg$/, "l.jpg");
  };

  if (!isMounted) {
    return <div className="mt-4 p-4 bg-gray-100 rounded-md">Loading results...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Toggle View Buttons */}
      <div className="flex justify-end space-x-2 mb-4">
        <button
          onClick={() => setActiveView("grid")}
          className={`px-4 py-2 rounded ${
            activeView === "grid"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          Grid View
        </button>
        <button
          onClick={() => setActiveView("map")}
          className={`px-4 py-2 rounded ${
            activeView === "map"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          Map View
        </button>
      </div>

      {/* Map View */}
      {activeView === "map" && (
        <div className="bg-white rounded-lg overflow-hidden shadow border">
          <div
            ref={mapContainerRef}
            id="map-container"
            className="h-[600px] w-full"
            style={{ height: "600px", width: "100%" }}
          >
            <MapContainer
              center={[center.lat, center.lng]}
              zoom={12}
              style={{ height: "100%", width: "100%" }}
              scrollWheelZoom={true}
              preferCanvas={true}
              attributionControl={true}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                maxZoom={19}
                detectRetina={true}
              />

              <ZoomControl position="bottomright" />

              {/* Drive Time Polygons */}
              {results.driveTimePolygons.map((polygon, index) => (
                <GeoJSON
                  key={`polygon-${index}`}
                  data={polygon.geoJson}
                  style={() => ({
                    color: getColorForIndex(index),
                    weight: 2,
                    opacity: 0.6,
                    fillOpacity: 0.2,
                  })}
                />
              ))}

              {/* Property Markers */}
              {properties.map((property) => (
                <Marker key={property.id} position={[property.lat, property.lng]}>
                  <Popup>
                    <div className="w-64">
                      <div className="w-full h-32 relative">
                        <Image
                          src={getBetterImageUrl(property)}
                          alt={property.address}
                          fill
                          style={{ objectFit: "cover" }}
                          className="rounded-t-md"
                          unoptimized={property.imageUrl.includes("placeholder")}
                        />
                      </div>
                      <div className="p-2">
                        <h3 className="font-bold">${property.price.toLocaleString()}</h3>
                        <p className="text-sm">{property.address}</p>
                        <p className="text-sm">
                          {property.bedrooms} bd | {property.bathrooms} ba |{" "}
                          {property.squareFeet.toLocaleString()} sqft
                        </p>
                        <p className="text-sm font-semibold mt-1">
                          Est. ${Math.round(property.monthlyPayment).toLocaleString()}/mo
                        </p>
                        <a
                          href={property.listingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-center mt-2 bg-blue-600 hover:bg-blue-700 text-white py-1 px-2 rounded text-sm"
                        >
                          View Listing
                        </a>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>
      )}

      {/* Property Grid */}
      {activeView === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((property) => (
            <div
              key={property.id}
              className="flex flex-col h-full bg-white border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-full h-48 relative">
                <Image
                  src={getBetterImageUrl(property)}
                  alt={property.address}
                  fill
                  style={{ objectFit: "cover" }}
                  unoptimized={property.imageUrl.includes("placeholder")}
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  quality={85}
                />
              </div>
              <div className="p-4 flex flex-col flex-grow">
                <div className="flex-grow">
                  <div className="flex justify-between items-start">
                    <h3 className="text-xl font-bold text-gray-900">
                      ${property.price.toLocaleString()}
                    </h3>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                      New
                    </span>
                  </div>
                  <p className="text-gray-700 mb-2 mt-1">{property.address}</p>
                  <div className="flex justify-between text-sm mb-2 text-gray-600">
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path>
                      </svg>
                      <span>{property.bedrooms} bd</span>
                    </div>
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M5.5 17a2.5 2.5 0 01-2.5-2.5v-7A2.5 2.5 0 015.5 5H8V3.5A1.5 1.5 0 019.5 2h1A1.5 1.5 0 0112 3.5V5h2.5A2.5 2.5 0 0117 7.5v7a2.5 2.5 0 01-2.5 2.5h-9zM8 7.5v1a1 1 0 001 1h2a1 1 0 001-1v-1H8zM5.5 6A1.5 1.5 0 004 7.5v7A1.5 1.5 0 005.5 16h9a1.5 1.5 0 001.5-1.5v-7A1.5 1.5 0 0014.5 6h-9z"
                          clipRule="evenodd"
                        ></path>
                      </svg>
                      <span>{property.bathrooms} ba</span>
                    </div>
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 110-12 6 6 0 010 12z"
                          clipRule="evenodd"
                        ></path>
                      </svg>
                      <span>{property.squareFeet.toLocaleString()} sqft</span>
                    </div>
                  </div>
                  <p className="font-semibold text-gray-800 mb-3">
                    Est. ${Math.round(property.monthlyPayment).toLocaleString()}/mo
                  </p>
                </div>
                <a
                  href={property.listingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded transition mt-2"
                >
                  View Listing
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {properties.length > 0 && (
        <div className="flex justify-center mt-8">
          <nav className="inline-flex rounded-md shadow">
            <a
              href="#"
              className="py-2 px-4 border border-gray-300 bg-white rounded-l-md hover:bg-gray-50"
            >
              Previous
            </a>
            <a
              href="#"
              className="py-2 px-4 border-t border-b border-gray-300 bg-white hover:bg-gray-50"
            >
              1
            </a>
            <a
              href="#"
              className="py-2 px-4 border-t border-b border-gray-300 bg-blue-50 text-blue-600 font-medium"
            >
              2
            </a>
            <a
              href="#"
              className="py-2 px-4 border-t border-b border-gray-300 bg-white hover:bg-gray-50"
            >
              3
            </a>
            <a
              href="#"
              className="py-2 px-4 border border-gray-300 bg-white rounded-r-md hover:bg-gray-50"
            >
              Next
            </a>
          </nav>
        </div>
      )}
    </div>
  );
}

// Helper function to get different colors for drive time polygons
function getColorForIndex(index: number): string {
  const colors = [
    "#3388ff", // Blue
    "#33a02c", // Green
    "#ff7f00", // Orange
    "#e31a1c", // Red
    "#6a3d9a", // Purple
    "#b15928", // Brown
    "#a6cee3", // Light Blue
    "#b2df8a", // Light Green
    "#fdbf6f", // Light Orange
    "#fb9a99", // Light Red
  ];

  return colors[index % colors.length];
}
