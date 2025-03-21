# MLS Search Tool with Drive Time Maps

A Next.js application that allows users to search for properties within specific drive time ranges from multiple locations, filtered by budget constraints.

## Features

- Enter up to 10 addresses and select maximum drive times for each
- Specify maximum monthly payment and down payment percentage
- Search for properties within the drive time areas that match budget constraints
- View results on an interactive map with drive time polygons
- View property listings with details and estimated monthly payments

## Tech Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Maps**: Leaflet, React-Leaflet
- **Form Handling**: React Hook Form, Yup validation
- **API Integration**: Geoapify (for drive time maps and geocoding)
- **Polygon Operations**: Turf.js

## Prerequisites

- Node.js 18+ and npm
- Geoapify API key (sign up at [geoapify.com](https://www.geoapify.com/))
- MLS API service for real property data (optional, currently using mock data)

## Setup

1. Clone the repository

   ```
   git clone <repository-url>
   cd mls-search-tool
   ```

2. Install dependencies

   ```
   npm install
   ```

3. Create a `.env.local` file in the root directory with your API keys:

   ```
   NEXT_PUBLIC_GEOAPIFY_API_KEY=your_geoapify_api_key
   NEXT_PUBLIC_MLS_API_KEY=your_mls_api_key
   ```

4. Run the development server

   ```
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## API Integration

### Geoapify

This application uses Geoapify for:

- Address geocoding (converting addresses to coordinates)
- Isochrone API (calculating drive time polygons)
- Address autocomplete

### MLS Integration

The application is set up to work with any MLS API or real estate data provider. Currently, it uses mock data for demonstration purposes.

To integrate with a real MLS API:

1. Modify `src/lib/propertyService.ts` to call your MLS API
2. Update the property data structure if necessary
3. Adjust the search parameters to match your API requirements

## Deployment

This project can be deployed on Vercel, Netlify, or any other platform that supports Next.js applications.

```bash
# Build for production
npm run build

# Start production server
npm start
```

## License

[MIT](LICENSE)
