import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Icon } from 'leaflet';

// Fix for default marker icon in Leaflet with Next.js
const defaultIcon = new Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Types
type Property = {
  id: string;
  address: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  squareFeet: number;
  lat: number;
  lng: number;
  imageUrl: string;
  listingUrl: string;
  monthlyPayment: number;
};

type DriveTimePolygon = {
  address: string;
  driveTime: string;
  geoJson: any;
};

type PropertyResultsProps = {
  results: {
    properties: Property[];
    driveTimePolygons: DriveTimePolygon[];
  };
};

export function PropertyResults({ results }: PropertyResultsProps) {
  // For client-side only rendering with leaflet
  const [isMounted, setIsMounted] = React.useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Mock properties data if no results are provided
  const mockProperties: Property[] = [
    {
      id: '1',
      address: '123 Main St, Anytown, USA',
      price: 450000,
      bedrooms: 3,
      bathrooms: 2,
      squareFeet: 1800,
      lat: 37.7749,
      lng: -122.4194,
      imageUrl: 'https://via.placeholder.com/300x200',
      listingUrl: '#',
      monthlyPayment: 2200,
    },
    {
      id: '2',
      address: '456 Oak Ave, Somewhere, USA',
      price: 525000,
      bedrooms: 4,
      bathrooms: 2.5,
      squareFeet: 2100,
      lat: 37.7848,
      lng: -122.4294,
      imageUrl: 'https://via.placeholder.com/300x200',
      listingUrl: '#',
      monthlyPayment: 2650,
    },
  ];

  const properties = results.properties.length > 0 ? results.properties : mockProperties;
  
  // Calculate center of the map based on properties
  const center = properties.length > 0
    ? { lat: properties[0].lat, lng: properties[0].lng }
    : { lat: 37.7749, lng: -122.4194 }; // Default to San Francisco if no properties

  if (!isMounted) {
    return <div className="mt-8 p-4 bg-gray-100 rounded-md">Loading map...</div>;
  }

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-bold mb-4">Search Results</h2>
      
      {/* Map View */}
      <div className="h-[500px] w-full mb-8 rounded-lg overflow-hidden">
        <MapContainer 
          center={[center.lat, center.lng]} 
          zoom={12} 
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          
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
            <Marker 
              key={property.id} 
              position={[property.lat, property.lng]}
              icon={defaultIcon}
            >
              <Popup>
                <div className="w-64">
                  <img 
                    src={property.imageUrl} 
                    alt={property.address} 
                    className="w-full h-32 object-cover rounded-t-md"
                  />
                  <div className="p-2">
                    <h3 className="font-bold">${property.price.toLocaleString()}</h3>
                    <p className="text-sm">{property.address}</p>
                    <p className="text-sm">
                      {property.bedrooms} bd | {property.bathrooms} ba | {property.squareFeet.toLocaleString()} sqft
                    </p>
                    <p className="text-sm font-semibold mt-1">
                      Est. ${property.monthlyPayment}/mo
                    </p>
                    <a 
                      href={property.listingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-center mt-2 bg-blue-500 hover:bg-blue-600 text-white py-1 px-2 rounded text-sm"
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
      
      {/* Property List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {properties.map((property) => (
          <div key={property.id} className="border rounded-lg overflow-hidden shadow-md">
            <img 
              src={property.imageUrl} 
              alt={property.address}
              className="w-full h-48 object-cover"
            />
            <div className="p-4">
              <h3 className="text-xl font-bold">${property.price.toLocaleString()}</h3>
              <p className="text-gray-700 mb-2">{property.address}</p>
              <div className="flex justify-between text-sm mb-2">
                <span>{property.bedrooms} bd</span>
                <span>{property.bathrooms} ba</span>
                <span>{property.squareFeet.toLocaleString()} sqft</span>
              </div>
              <p className="font-semibold text-gray-800 mb-3">
                Est. ${property.monthlyPayment}/mo
              </p>
              <a 
                href={property.listingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
              >
                View Listing
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Helper function to get different colors for drive time polygons
function getColorForIndex(index: number): string {
  const colors = [
    '#3388ff', // Blue
    '#33a02c', // Green
    '#ff7f00', // Orange
    '#e31a1c', // Red
    '#6a3d9a', // Purple
    '#b15928', // Brown
    '#a6cee3', // Light Blue
    '#b2df8a', // Light Green
    '#fdbf6f', // Light Orange
    '#fb9a99', // Light Red
  ];
  
  return colors[index % colors.length];
}