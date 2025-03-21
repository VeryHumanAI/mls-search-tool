"use client";

import React, { useState, useEffect, useRef } from 'react';
import { getAddressSuggestions, AutocompleteResult } from '@/lib/addressAutocomplete';

type AddressAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  error?: string;
};

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = 'Enter address',
  className = '',
  required = false,
  error,
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<AutocompleteResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLUListElement>(null);

  // Update local state when the controlled value changes
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Fetch suggestions when the query changes
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (query.length < 3) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        const results = await getAddressSuggestions(query);
        setSuggestions(results);
        setIsOpen(results.length > 0);
      } catch (error) {
        console.error('Error fetching suggestions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [query]);

  // Handle clicks outside the component to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current &&
        suggestionsRef.current &&
        !inputRef.current.contains(event.target as Node) &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setQuery(newValue);
    onChange(newValue);
  };

  const handleSelectSuggestion = (suggestion: AutocompleteResult) => {
    setQuery(suggestion.address);
    onChange(suggestion.address);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleInputChange}
        placeholder={placeholder}
        className={`w-full p-2 border rounded-md ${
          error ? 'border-red-500' : 'border-gray-300'
        } ${className}`}
        onFocus={() => suggestions.length > 0 && setIsOpen(true)}
        required={required}
        autoComplete="off"
      />
      
      {isLoading && (
        <div className="absolute right-3 top-2">
          <svg
            className="animate-spin h-5 w-5 text-gray-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </div>
      )}
      
      {isOpen && suggestions.length > 0 && (
        <ul
          ref={suggestionsRef}
          className="absolute z-10 w-full mt-1 max-h-60 overflow-auto bg-white rounded-md shadow-lg border border-gray-200"
        >
          {suggestions.map((suggestion) => (
            <li
              key={suggestion.placeId}
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
              onClick={() => handleSelectSuggestion(suggestion)}
            >
              <div className="font-medium">{suggestion.address}</div>
              {suggestion.city && suggestion.state && (
                <div className="text-gray-500 text-xs">
                  {suggestion.city}, {suggestion.state} {suggestion.zipcode}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
}