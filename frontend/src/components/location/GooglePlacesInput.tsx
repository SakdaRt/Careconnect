import { useEffect, useRef } from 'react';

type AddressResult = {
  address_line1: string;
  district?: string | null;
  province?: string | null;
  postal_code?: string | null;
  lat?: number | null;
  lng?: number | null;
};

type GoogleMapsLike = {
  maps?: {
    places?: {
      Autocomplete: new (
        input: HTMLInputElement,
        options: { fields: string[]; componentRestrictions?: { country: string[] } }
      ) => {
        addListener: (event: string, handler: () => void) => void;
        getPlace: () => {
          formatted_address?: string;
          address_components?: Array<{ long_name: string; short_name: string; types: string[] }>;
          geometry?: { location?: { lat?: () => number; lng?: () => number } };
        };
      };
    };
    Map?: new (
      el: HTMLElement,
      options: {
        center: { lat: number; lng: number };
        zoom: number;
        disableDefaultUI?: boolean;
        zoomControl?: boolean;
      }
    ) => {
      setCenter: (latLng: { lat: number; lng: number }) => void;
      setZoom: (zoom: number) => void;
      addListener: (event: string, handler: (event: any) => void) => void;
    };
    Marker?: new (options: { map: any; position?: { lat: number; lng: number } }) => {
      setPosition: (latLng: { lat: number; lng: number }) => void;
      setMap: (map: any) => void;
    };
    Geocoder?: new () => {
      geocode: (
        request: { location: { lat: number; lng: number } },
        callback: (results: Array<{ formatted_address?: string; address_components?: Array<{ long_name: string; short_name: string; types: string[] }> }> | null, status: string) => void
      ) => void;
    };
  };
};

const getGoogle = () => (window as unknown as { google?: GoogleMapsLike }).google || null;

export function GooglePlacesInput({
  label,
  placeholder,
  value,
  onChange,
  disabled,
  error,
  lat,
  lng,
  showMap,
}: {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (next: AddressResult) => void;
  disabled?: boolean;
  error?: string;
  lat?: number | null;
  lng?: number | null;
  showMap?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const latestLatLngRef = useRef<{ lat: number; lng: number } | null>(null);
  const rawApiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const apiKey = rawApiKey?.trim();
  const isKeyConfigured = !!apiKey && apiKey !== 'your_actual_api_key_here';

  useEffect(() => {
    if (!isKeyConfigured || !apiKey) return;
    const scriptId = 'google-maps-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      document.head.appendChild(script);
    }
    const parseComponents = (comps: Array<{ long_name: string; short_name: string; types: string[] }>) => {
      const find = (type: string) => comps.find((c) => c.types.includes(type))?.long_name || null;
      const district =
        find('administrative_area_level_2') || find('locality') || find('sublocality') || find('political');
      const province =
        find('administrative_area_level_1') || find('region') || find('political') || find('country');
      const postal_code = find('postal_code');
      return { district, province, postal_code };
    };

    const applyLatLng = (nextLat: number, nextLng: number, zoom?: number) => {
      latestLatLngRef.current = { lat: nextLat, lng: nextLng };
      if (!mapInstanceRef.current || !markerRef.current) return;
      markerRef.current.setPosition({ lat: nextLat, lng: nextLng });
      mapInstanceRef.current.setCenter({ lat: nextLat, lng: nextLng });
      if (zoom) mapInstanceRef.current.setZoom(zoom);
    };

    const init = () => {
      const g = getGoogle();
      const maps = g?.maps as any;
      if (!maps?.places || !inputRef.current) return;
      const autocomplete = new maps.places.Autocomplete(inputRef.current, {
        fields: ['formatted_address', 'address_components', 'geometry'],
        componentRestrictions: { country: ['th'] },
      });
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        const comps = (place.address_components || []) as Array<{
          long_name: string;
          short_name: string;
          types: string[];
        }>;
        const { district, province, postal_code } = parseComponents(comps);
        const lat = place.geometry?.location?.lat?.() ?? null;
        const lng = place.geometry?.location?.lng?.() ?? null;
        if (typeof lat === 'number' && typeof lng === 'number') {
          applyLatLng(lat, lng, 16);
        }
        onChange({
          address_line1: place.formatted_address || inputRef.current?.value || '',
          district,
          province,
          postal_code,
          lat,
          lng,
        });
      });
      if (showMap && mapRef.current && maps.Map && !mapInstanceRef.current) {
        const fallback = { lat: 13.7563, lng: 100.5018 };
        const initial =
          typeof lat === 'number' && typeof lng === 'number'
            ? { lat, lng }
            : latestLatLngRef.current || fallback;
        mapInstanceRef.current = new maps.Map(mapRef.current, {
          center: initial,
          zoom: typeof lat === 'number' && typeof lng === 'number' ? 16 : 12,
          disableDefaultUI: true,
          zoomControl: true,
        });
        if (maps.Marker) {
          markerRef.current = new maps.Marker({
            map: mapInstanceRef.current,
            position: typeof lat === 'number' && typeof lng === 'number' ? initial : undefined,
          });
        }
        mapInstanceRef.current.addListener('click', (event: any) => {
          const clickedLat = event?.latLng?.lat?.();
          const clickedLng = event?.latLng?.lng?.();
          if (typeof clickedLat !== 'number' || typeof clickedLng !== 'number') return;
          applyLatLng(clickedLat, clickedLng, 16);
          if (!maps.Geocoder) {
            onChange({
              address_line1: inputRef.current?.value || '',
              lat: clickedLat,
              lng: clickedLng,
            });
            return;
          }
          if (!geocoderRef.current) geocoderRef.current = new maps.Geocoder();
          geocoderRef.current.geocode(
            { location: { lat: clickedLat, lng: clickedLng } },
            (
              results: Array<{
                formatted_address?: string;
                address_components?: Array<{ long_name: string; short_name: string; types: string[] }>;
              }> | null,
              status: string
            ) => {
              if (status === 'OK' && results && results[0]) {
                const comps = (results[0].address_components || []) as Array<{
                  long_name: string;
                  short_name: string;
                  types: string[];
                }>;
                const { district, province, postal_code } = parseComponents(comps);
                onChange({
                  address_line1: results[0].formatted_address || inputRef.current?.value || '',
                  district,
                  province,
                  postal_code,
                  lat: clickedLat,
                  lng: clickedLng,
                });
                return;
              }
              onChange({
                address_line1: inputRef.current?.value || '',
                lat: clickedLat,
                lng: clickedLng,
              });
            }
          );
        });
      }
    };
    const id = setInterval(() => {
      const loaded = !!getGoogle()?.maps?.places;
      if (loaded) {
        clearInterval(id);
        init();
      }
    }, 200);
    return () => {
      clearInterval(id);
    };
  }, [apiKey, isKeyConfigured, onChange, showMap, lat, lng]);

  useEffect(() => {
    if (!showMap) return;
    if (typeof lat !== 'number' || typeof lng !== 'number') return;
    latestLatLngRef.current = { lat, lng };
    if (!mapInstanceRef.current || !markerRef.current) return;
    markerRef.current.setPosition({ lat, lng });
    mapInstanceRef.current.setCenter({ lat, lng });
    mapInstanceRef.current.setZoom(16);
  }, [lat, lng, showMap]);

  return (
    <div className="flex flex-col gap-1">
      {label ? <label className="text-sm font-semibold text-gray-700">{label}</label> : null}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange({ address_line1: e.target.value })}
        placeholder={placeholder || 'ค้นหาที่อยู่ด้วย Google Maps'}
        disabled={disabled}
        className={`w-full px-4 py-2 border rounded-lg bg-white ${error ? 'border-red-500' : 'border-gray-300'}`}
      />
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      {!isKeyConfigured ? (
        <div className="text-xs text-gray-500">ตั้งค่า VITE_GOOGLE_MAPS_API_KEY ในไฟล์ .env.local เพื่อเปิดใช้ Google Places</div>
      ) : null}
      {isKeyConfigured && showMap ? (
        <div className="w-full h-64 rounded-lg border border-gray-200" ref={mapRef} />
      ) : null}
    </div>
  );
}
