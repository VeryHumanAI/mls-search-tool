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
  status?: string;
  flags: {
    is_coming_soon?: boolean;
    is_contingent?: boolean;
    is_foreclosure?: boolean;
    is_new_construction?: boolean;
    is_new_listing?: boolean;
    is_pending?: boolean;
    is_price_reduced?: boolean;
  };
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

export interface FilterStats {
  totalPropertiesOnPage: number;
  filteredByPrice: number;
  filteredByLocation: number;
  remainingAfterFilters: number;
  maxPriceFilter: number;
  maxMonthlyPaymentFilter: number;
  downPaymentPercent: number;
  enabledPolygonCount: number;
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
  filterStats?: FilterStats; // Statistics about filtering results
}
