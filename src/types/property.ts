export interface Property {
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
}

export interface PropertySearchParams {
  // Geographic constraints
  polygon: any; // GeoJSON polygon representing the combined drive time areas

  // Budget constraints
  maxMonthlyPayment: number;
  downPaymentPercent: number;

  // Optional filters
  minBedrooms?: number;
  minBathrooms?: number;
  minSquareFeet?: number;
  propertyType?: string;
  maxDaysOnMarket?: number;
}

export interface DriveTimePolygon {
  address: string;
  driveTime: string;
  geoJson: any;
}

export interface SearchResults {
  properties: Property[];
  driveTimePolygons: DriveTimePolygon[];
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
  };
  formData?: any; // Store form data for pagination
}
