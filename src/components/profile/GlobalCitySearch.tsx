'use client';

import { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Search, Check, Loader2 } from 'lucide-react';
import type { LocationData } from '@/models/types';

interface GlobalCitySearchProps {
  value?: LocationData;
  onChange: (location: LocationData) => void;
  error?: boolean;
}

export default function GlobalCitySearch({ value, onChange, error }: GlobalCitySearchProps) {
  const [query, setQuery] = useState(value ? `${value.cityName}, ${value.country}` : '');
  const [results, setResults] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 3 || (value && query === `${value.cityName}, ${value.country}`)) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            query
          )}&featuretype=city&limit=5`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
        setResults(data);
        setIsOpen(true);
      } catch (err) {
        console.error('Error fetching locations:', err);
      } finally {
        setIsLoading(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [query, value]);

  const handleSelect = (item: any) => {
    const parts = item.display_name.split(', ');
    const cityName = parts[0];
    const country = parts[parts.length - 1];
    
    const loc: LocationData = {
      cityName,
      country,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    };
    
    setQuery(`${cityName}, ${country}`);
    setIsOpen(false);
    onChange(loc);
  };

  const handleGpsDetect = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setIsGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`,
            { headers: { 'Accept-Language': 'en' } }
          );
          const data = await res.json();
          if (data && data.address) {
            const cityName = data.address.city || data.address.town || data.address.village || 'Unknown City';
            const country = data.address.country || 'Unknown Country';
            
            const loc: LocationData = {
              cityName,
              country,
              lat: latitude,
              lng: longitude,
            };
            setQuery(`${cityName}, ${country}`);
            onChange(loc);
          }
        } catch (err) {
          console.error('Error with reverse geocoding:', err);
        } finally {
          setIsGpsLoading(false);
        }
      },
      (err) => {
        console.error(err);
        alert('Could not detect location. Please check your permissions.');
        setIsGpsLoading(false);
      }
    );
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {isLoading ? (
              <Loader2 size={16} className="text-slate-400 animate-spin" />
            ) : (
              <Search size={16} className="text-slate-400" />
            )}
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            placeholder="Search for a city..."
            className={`w-full bg-slate-800/60 border rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all ${
              error ? 'border-red-500/50' : 'border-slate-700/50 focus:border-blue-500/40'
            }`}
          />
        </div>
        <button
          type="button"
          onClick={handleGpsDetect}
          disabled={isGpsLoading}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700/50 rounded-xl text-sm font-medium text-blue-400 transition-colors disabled:opacity-50"
          title="Use Current Location"
        >
          {isGpsLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Navigation size={16} />
          )}
        </button>
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden">
          <ul className="max-h-60 overflow-y-auto">
            {results.map((item) => (
              <li
                key={item.place_id}
                onClick={() => handleSelect(item)}
                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-700 cursor-pointer border-b border-slate-700/50 last:border-0"
              >
                <MapPin size={16} className="text-slate-400 shrink-0" />
                <span className="text-sm text-slate-200 truncate">{item.display_name}</span>
                {value?.lat === parseFloat(item.lat) && value?.lng === parseFloat(item.lon) && (
                  <Check size={16} className="text-blue-400 ml-auto shrink-0" />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
