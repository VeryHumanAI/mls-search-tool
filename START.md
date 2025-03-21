# Getting Started with the MLS Search Tool

To start the application, follow these steps:

1. First, make sure you have Node.js installed on your system.

2. Open a terminal and navigate to the mls-search-tool directory:

   ```
   cd /Users/conroywhitney/code/claude/mls-search-tool/mls-search-tool
   ```

3. Install dependencies (if you haven't already):

   ```
   npm install
   ```

4. Create a `.env.local` file and add your Geoapify API key:

   ```
   NEXT_PUBLIC_GEOAPIFY_API_KEY=your_geoapify_api_key
   ```

   You can get a free API key by signing up at [Geoapify](https://www.geoapify.com/).

5. Start the development server:

   ```
   npm run dev
   ```

6. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Notes for Development

- The application currently uses mock data for property listings
- To integrate with a real MLS API, update the code in `src/lib/propertyService.ts`
- The drive time polygons are generated using Geoapify's isochrone API

Enjoy using the MLS Search Tool with drive time maps!
