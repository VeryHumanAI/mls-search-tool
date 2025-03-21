import axios from 'axios';

const GEOAPIFY_API_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY || 'YOUR_API_KEY_HERE';

export type AutocompleteResult = {
  address: string;
  placeId: string;
  city: string;
  state: string;
  zipcode: string;
  lat: number;
  lon: number;
};

export async function getAddressSuggestions(
  query: string,
  limit: number = 5
): Promise<AutocompleteResult[]> {
  if (!query || query.length < 3) return [];

  try {
    const response = await axios.get('https://api.geoapify.com/v1/geocode/autocomplete', {
      params: {
        text: query,
        format: 'json',
        limit,
        filter: 'countrycode:us', // Limit to US addresses
        apiKey: GEOAPIFY_API_KEY,
      },
    });

    if (!response.data.results) return [];

    return response.data.results.map((result: any) => {
      const {
        formatted,
        place_id,
        city,
        state,
        postcode,
        lat,
        lon
      } = result;

      return {
        address: formatted,
        placeId: place_id,
        city: city || '',
        state: state || '',
        zipcode: postcode || '',
        lat,
        lon,
      };
    });
  } catch (error) {
    console.error('Error fetching address suggestions:', error);
    return [];
  }
}