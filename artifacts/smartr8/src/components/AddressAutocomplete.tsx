import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

export interface AddressResult {
  formatted: string;
  street: string;
  city: string;
  state: string;
  zip: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (result: AddressResult) => void;
  placeholder?: string;
  forPurchase?: boolean;
}

declare global {
  interface Window {
    google?: {
      maps?: {
        places?: {
          Autocomplete: new (
            input: HTMLInputElement,
            opts?: object
          ) => {
            getPlace: () => {
              formatted_address?: string;
              address_components?: Array<{
                long_name: string;
                short_name: string;
                types: string[];
              }>;
            };
            addListener: (event: string, cb: () => void) => void;
          };
        };
      };
    };
  }
}

const API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined;

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = "Start typing your address...",
  forPurchase = false,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [loadError, setLoadError] = useState(!API_KEY);

  useEffect(() => {
    if (!API_KEY) return;
    if (window.google?.maps?.places) {
      setScriptLoaded(true);
      return;
    }
    const existing = document.getElementById("gmap-script");
    if (existing) {
      existing.addEventListener("load", () => setScriptLoaded(true));
      return;
    }
    const script = document.createElement("script");
    script.id = "gmap-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => setLoadError(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!scriptLoaded || !inputRef.current || !window.google?.maps?.places) return;

    const types = forPurchase ? ["(cities)"] : ["address"];
    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      types,
      componentRestrictions: { country: "us" },
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.address_components) {
        onChange({
          formatted: place.formatted_address || "",
          street: "",
          city: "",
          state: "",
          zip: "",
        });
        return;
      }

      const get = (type: string) =>
        place.address_components!.find((c) => c.types.includes(type))?.long_name ?? "";
      const getShort = (type: string) =>
        place.address_components!.find((c) => c.types.includes(type))?.short_name ?? "";

      onChange({
        formatted: place.formatted_address ?? "",
        street: [get("street_number"), get("route")].filter(Boolean).join(" "),
        city: get("locality") || get("sublocality_level_1") || get("neighborhood"),
        state: getShort("administrative_area_level_1"),
        zip: get("postal_code"),
      });
    });
  }, [scriptLoaded, forPurchase, onChange]);

  return (
    <div>
      <Input
        ref={inputRef}
        type="text"
        defaultValue={value}
        placeholder={loadError ? "Enter your full address" : placeholder}
        className="text-base py-5"
        aria-label="Property address"
        autoComplete="off"
        onChange={
          loadError
            ? (e) =>
                onChange({
                  formatted: e.target.value,
                  street: "",
                  city: "",
                  state: "",
                  zip: "",
                })
            : undefined
        }
      />
      {loadError && (
        <p className="text-xs text-muted-foreground mt-1.5">
          Address autocomplete temporarily unavailable. Please type your full address.
        </p>
      )}
    </div>
  );
}
