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
  onPageChange?: (page: number) => void;
  onFilterChange?: (enabledPolygonIndices: number[]) => void;
};

export function PropertyResults({ results, onPageChange, onFilterChange }: PropertyResultsProps) {
  // For client-side only rendering with leaflet
  const [isMounted, setIsMounted] = useState(false);
  const [activeView, setActiveView] = useState<"grid" | "map">("grid");
  const mapContainerRef = useRef<HTMLDivElement>(null);
  
  // State for isochrone visibility and highlight
  const [visibleIsochrones, setVisibleIsochrones] = useState<{[key: number]: boolean}>({});
  const [hoveredIsochrones, setHoveredIsochrones] = useState<Set<number>>(new Set());
  
  // Track which isochrones are used for filtering properties
  const [filterIsochrones, setFilterIsochrones] = useState<{[key: number]: boolean}>({});
  
  // Keep references to the GeoJSON layers
  const layerRefs = useRef<{[key: number]: any}>({});

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Initialize visibility state for all isochrones to true (all visible)
  // and initialize filter state (all used for filtering)
  useEffect(() => {
    if (results.driveTimePolygons.length > 0) {
      const initialVisibility = {};
      const initialFilter = {};
      results.driveTimePolygons.forEach((_, index) => {
        initialVisibility[index] = true;
        initialFilter[index] = true; // Initially use all for filtering
      });
      setVisibleIsochrones(initialVisibility);
      setFilterIsochrones(initialFilter);
    }
  }, [results.driveTimePolygons]);

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
          {/* Isochrone Controls */}
          <div className="p-3 bg-gray-100 text-sm border-b">
            <h4 className="font-semibold mb-2">Drive Time Areas</h4>
            
            {/* Visibility Options */}
            <div className="mb-3">
              <h5 className="font-medium text-xs uppercase text-gray-500 mb-1">Visibility</h5>
              <div className="grid grid-cols-1 gap-1">
                {results.driveTimePolygons.map((p, i) => (
                  <div 
                    key={i} 
                    className={`
                      flex items-center p-1.5 text-sm rounded cursor-pointer
                      ${hoveredIsochrones.has(i) ? 'bg-blue-100' : ''}
                      ${getDriveTimeBackground(p.driveTime)}
                    `}
                    onMouseEnter={() => {
                      const newHovered = new Set(hoveredIsochrones);
                      newHovered.add(i);
                      setHoveredIsochrones(newHovered);
                      
                      // Highlight the layer
                      if (layerRefs.current[i]) {
                        const layer = layerRefs.current[i];
                        layer.setStyle({
                          weight: 5,
                          opacity: 1,
                          fillOpacity: 0.3,
                          dashArray: "",
                        });
                      }
                    }}
                    onMouseLeave={() => {
                      const newHovered = new Set(hoveredIsochrones);
                      newHovered.delete(i);
                      setHoveredIsochrones(newHovered);
                      
                      // Reset the layer style
                      if (layerRefs.current[i]) {
                        const layer = layerRefs.current[i];
                        layer.setStyle({
                          weight: 3,
                          opacity: 0.8,
                          fillOpacity: 0.15,
                          dashArray: "5, 5",
                        });
                      }
                    }}
                  >
                    <input
                      type="checkbox"
                      id={`isochrone-${i}`}
                      checked={visibleIsochrones[i] || false}
                      onChange={() => {
                        setVisibleIsochrones(prev => ({
                          ...prev,
                          [i]: !prev[i]
                        }));
                      }}
                      className="mr-2"
                    />
                    <label 
                      htmlFor={`isochrone-${i}`}
                      className="flex-1 cursor-pointer"
                      style={{ color: getColorForIndex(i) }}
                    >
                      <span className="font-medium">{p.address}</span>
                      <span className="ml-1 text-xs">({p.driveTime})</span>
                    </label>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <button 
                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded"
                  onClick={() => {
                    const allVisible = {};
                    results.driveTimePolygons.forEach((_, index) => {
                      allVisible[index] = true;
                    });
                    setVisibleIsochrones(allVisible);
                  }}
                >
                  Show All
                </button>
                <button 
                  className="px-2 py-1 text-xs bg-gray-600 text-white rounded"
                  onClick={() => {
                    const allHidden = {};
                    results.driveTimePolygons.forEach((_, index) => {
                      allHidden[index] = false;
                    });
                    setVisibleIsochrones(allHidden);
                  }}
                >
                  Hide All
                </button>
              </div>
            </div>
            
            {/* Filtering Options */}
            <div className="border-t pt-3 mt-3">
              <h5 className="font-medium text-xs uppercase text-gray-500 mb-1">Filter Properties By</h5>
              <p className="text-xs mb-2 text-gray-600">Properties must be within ALL selected areas:</p>
              <div className="grid grid-cols-1 gap-1">
                {results.driveTimePolygons.map((p, i) => (
                  <div 
                    key={`filter-${i}`} 
                    className={`
                      flex items-center p-1.5 text-sm rounded cursor-pointer 
                      ${getDriveTimeBackground(p.driveTime)}
                    `}
                  >
                    <input
                      type="checkbox"
                      id={`filter-isochrone-${i}`}
                      checked={filterIsochrones[i] || false}
                      onChange={() => {
                        setFilterIsochrones(prev => ({
                          ...prev,
                          [i]: !prev[i]
                        }));
                      }}
                      className="mr-2"
                    />
                    <label 
                      htmlFor={`filter-isochrone-${i}`}
                      className="flex-1 cursor-pointer"
                      style={{ color: getColorForIndex(i) }}
                    >
                      <span className="font-medium">{p.address}</span>
                      <span className="ml-1 text-xs">({p.driveTime})</span>
                    </label>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button 
                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded"
                  onClick={() => {
                    // Convert the filterIsochrones object to an array of indices
                    const enabledIndices = Object.entries(filterIsochrones)
                      .filter(([_, enabled]) => enabled)
                      .map(([index]) => parseInt(index));
                    
                    // Call the onFilterChange prop to update the parent component
                    if (onFilterChange) {
                      onFilterChange(enabledIndices);
                    }
                  }}
                >
                  Apply Filters
                </button>
                <button 
                  className="px-2 py-1 text-xs bg-gray-600 text-white rounded"
                  onClick={() => {
                    const allSelected = {};
                    results.driveTimePolygons.forEach((_, index) => {
                      allSelected[index] = true;
                    });
                    setFilterIsochrones(allSelected);
                  }}
                >
                  Select All Areas
                </button>
                <button 
                  className="px-2 py-1 text-xs bg-gray-400 text-white rounded"
                  onClick={() => {
                    const noneSelected = {};
                    results.driveTimePolygons.forEach((_, index) => {
                      noneSelected[index] = false;
                    });
                    setFilterIsochrones(noneSelected);
                  }}
                >
                  Clear Areas
                </button>
              </div>
            </div>
          </div>
          
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
              {results.driveTimePolygons.length > 0 && (
                <div>
                  {results.driveTimePolygons.map((polygon, index) => {
                    // Skip rendering if this isochrone is toggled off
                    if (visibleIsochrones[index] === false) return null;
                    
                    // Determine if this polygon should be highlighted
                    const isHighlighted = hoveredIsochrones.has(index);
                    
                    return (
                      <GeoJSON
                        key={`polygon-${index}`}
                        data={polygon.geoJson}
                        style={() => ({
                          color: getColorForIndex(index),
                          weight: isHighlighted ? 5 : 3,
                          opacity: isHighlighted ? 1 : 0.8,
                          fillOpacity: isHighlighted ? 0.3 : 0.15,
                          dashArray: isHighlighted ? "" : "5, 5",
                        })}
                        onEachFeature={(feature, layer) => {
                          // Store a reference to this layer
                          if (!layerRefs.current[index]) {
                            layerRefs.current[index] = layer;
                          }
                          
                          // Add tooltip
                          const driveTime = feature.properties?.driveTime || polygon.driveTime;
                          const address = feature.properties?.address || polygon.address;
                          layer.bindTooltip(`${address} (${driveTime})`);
                          
                          // Use Leaflet's built-in event handlers
                          layer.on({
                            // When mouse enters this polygon
                            mouseover: (e) => {
                              // Add this polygon to the highlighted set
                              setHoveredIsochrones(prev => {
                                const newSet = new Set(prev);
                                newSet.add(index);
                                return newSet;
                              });
                              
                              // Apply highlight style
                              layer.setStyle({
                                weight: 5,
                                opacity: 1,
                                fillOpacity: 0.3,
                                dashArray: "",
                              });
                              
                              // Bring to front to ensure it's visible
                              if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                                layer.bringToFront();
                              }
                            },
                            
                            // When mouse leaves this polygon
                            mouseout: (e) => {
                              // Remove this polygon from highlighted set
                              setHoveredIsochrones(prev => {
                                const newSet = new Set(prev);
                                newSet.delete(index);
                                return newSet;
                              });
                              
                              // Reset style
                              layer.setStyle({
                                weight: 3,
                                opacity: 0.8,
                                fillOpacity: 0.15,
                                dashArray: "5, 5",
                              });
                            }
                          });
                        }}
                      />
                    );
                  })}
                </div>
              )}

              {/* Property Markers */}
              {properties.map((property) => (
                <Marker 
                  key={property.id} 
                  position={[property.lat, property.lng]}
                  eventHandlers={{
                    mouseover: () => {
                      // Find which isochrones this property is inside of
                      results.driveTimePolygons.forEach((polygon, index) => {
                        if (!visibleIsochrones[index]) return; // Skip if hidden
                        
                        const propertyPoint = { lat: property.lat, lng: property.lng };
                        const layer = layerRefs.current[index];
                        
                        if (layer && layer.getBounds().contains(propertyPoint)) {
                          // Try to determine if the point is in this polygon
                          try {
                            // If this point is in this polygon, highlight it
                            setHoveredIsochrones(prev => {
                              const newSet = new Set(prev);
                              newSet.add(index);
                              return newSet;
                            });
                            
                            // Style the layer
                            layer.setStyle({
                              weight: 5,
                              opacity: 1,
                              fillOpacity: 0.3,
                              dashArray: "",
                            });
                            
                            // Bring to front
                            if (layer.bringToFront) {
                              layer.bringToFront();
                            }
                          } catch (e) {
                            console.warn(`Error checking if property is in polygon ${index}:`, e);
                          }
                        }
                      });
                    },
                    mouseout: () => {
                      // Reset all highlights
                      setHoveredIsochrones(new Set());
                      
                      // Reset all layer styles
                      Object.values(layerRefs.current).forEach(layer => {
                        if (layer && layer.setStyle) {
                          layer.setStyle({
                            weight: 3,
                            opacity: 0.8,
                            fillOpacity: 0.15,
                            dashArray: "5, 5",
                          });
                        }
                      });
                    }
                  }}
                >
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
      {properties.length > 0 && results.pagination && results.pagination.totalPages > 1 && (
        <div className="flex justify-center mt-8">
          <nav className="inline-flex rounded-md shadow">
            {/* Previous Button */}
            <button
              onClick={() => onPageChange && onPageChange(Math.max(1, results.pagination.currentPage - 1))}
              disabled={results.pagination.currentPage <= 1}
              className={`py-2 px-4 border border-gray-300 rounded-l-md ${
                results.pagination.currentPage <= 1 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : 'bg-white hover:bg-gray-50 cursor-pointer'
              }`}
            >
              Previous
            </button>
            
            {/* Page Numbers */}
            {Array.from({ length: Math.min(5, results.pagination.totalPages) }).map((_, i) => {
              // Logic to show pages around current page
              const totalPages = results.pagination.totalPages;
              const currentPage = results.pagination.currentPage;
              
              let pageNum;
              if (totalPages <= 5) {
                // If 5 or fewer pages, show all pages
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                // If near the start, show first 5 pages
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                // If near the end, show last 5 pages
                pageNum = totalPages - 4 + i;
              } else {
                // Otherwise show 2 before and 2 after current page
                pageNum = currentPage - 2 + i;
              }
              
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange && onPageChange(pageNum)}
                  className={`py-2 px-4 border-t border-b border-gray-300 ${
                    pageNum === results.pagination.currentPage
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            
            {/* Next Button */}
            <button
              onClick={() => onPageChange && onPageChange(Math.min(results.pagination.totalPages, results.pagination.currentPage + 1))}
              disabled={results.pagination.currentPage >= results.pagination.totalPages}
              className={`py-2 px-4 border border-gray-300 rounded-r-md ${
                results.pagination.currentPage >= results.pagination.totalPages
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-white hover:bg-gray-50 cursor-pointer'
              }`}
            >
              Next
            </button>
          </nav>
          <div className="ml-4 text-sm text-gray-600 self-center">
            {results.pagination.totalCount.toLocaleString()} properties found
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to get different colors for drive time polygons
// Check if a point is inside a polygon layer
function isPointInPolygon(point, layer) {
  if (!layer || !point) return false;
  
  try {
    // Get the bounds of the layer
    const bounds = layer.getBounds();
    if (!bounds.contains(point)) return false;
    
    // Try to use Leaflet's built-in contains method if available
    if (typeof layer.contains === 'function') {
      return layer.contains(point);
    }
    
    // For GeoJSON layers, we need to do a bit more work
    // Convert the point to a GeoJSON feature
    const pointFeature = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Point',
        coordinates: [point.lng, point.lat]
      }
    };
    
    // Get the layer's GeoJSON
    const layerGeoJSON = layer.toGeoJSON();
    
    // Use a simple ray-casting algorithm
    // This is a simplified version and might not be perfect for all polygons
    let inside = false;
    
    if (layerGeoJSON.type === 'FeatureCollection') {
      for (const feature of layerGeoJSON.features) {
        if (feature.geometry && feature.geometry.type === 'Polygon') {
          inside = inside || pointInPolygon(pointFeature, feature);
        }
      }
    } else if (layerGeoJSON.geometry && layerGeoJSON.geometry.type === 'Polygon') {
      inside = pointInPolygon(pointFeature, layerGeoJSON);
    }
    
    return inside;
  } catch (e) {
    console.warn('Error in isPointInPolygon:', e);
    return false;
  }
}

// Simple point-in-polygon check (ray casting algorithm)
function pointInPolygon(point, polygon) {
  try {
    if (!point || !polygon || !polygon.geometry || !polygon.geometry.coordinates) {
      return false;
    }
    
    const x = point.geometry.coordinates[0];
    const y = point.geometry.coordinates[1];
    
    // For each ring in the polygon
    for (const ring of polygon.geometry.coordinates) {
      let inside = false;
      
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1];
        const xj = ring[j][0], yj = ring[j][1];
        
        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
      
      if (inside) return true;
    }
    
    return false;
  } catch (e) {
    console.warn('Error in pointInPolygon:', e);
    return false;
  }
}

// Get a background color class based on drive time
function getDriveTimeBackground(driveTime: string): string {
  if (driveTime.includes("10")) {
    return "bg-green-50";
  } else if (driveTime.includes("15")) {
    return "bg-blue-50";
  } else if (driveTime.includes("20")) {
    return "bg-orange-50";
  }
  return "bg-gray-50";
}

function getColorForIndex(index: number): string {
  // Group colors by drive time
  const timeColors = {
    // 10 minutes - greens
    0: "#33a02c", // Dark Green
    1: "#b2df8a", // Light Green
    
    // 15 minutes - blues
    2: "#3388ff", // Blue
    3: "#6a3d9a", // Purple
    4: "#a6cee3", // Light Blue
    5: "#9090ff", // Soft Blue
    
    // 20 minutes - oranges/reds
    6: "#ff7f00", // Orange
    7: "#e31a1c", // Red
  };
  
  // If we have a specific color for this index, use it
  if (index in timeColors) {
    return timeColors[index];
  }
  
  // Otherwise use a fallback array
  const fallbackColors = [
    "#33a02c", // Green
    "#3388ff", // Blue
    "#ff7f00", // Orange
    "#e31a1c", // Red
    "#6a3d9a", // Purple
    "#b15928", // Brown
    "#a6cee3", // Light Blue
    "#b2df8a", // Light Green
    "#fdbf6f", // Light Orange
    "#fb9a99", // Light Red
  ];

  return fallbackColors[index % fallbackColors.length];
}
