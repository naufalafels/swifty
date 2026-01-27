import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaCar,
  FaGasPump,
  FaArrowRight,
  FaTachometerAlt,
  FaUserFriends,
  FaShieldAlt,
  FaMapMarkerAlt,
  FaSyncAlt,
  FaBuilding,
} from "react-icons/fa";
import axios from "axios";
import { carPageStyles } from "../assets/dummyStyles.js";
import { GoogleMap, LoadScript, InfoWindow } from "@react-google-maps/api";

// Move libraries outside component to prevent re-renders
const GOOGLE_MAPS_LIBRARIES = ['marker'];

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
// ceil so partial days count as next day
const daysBetween = (from, to) =>
  Math.ceil((startOfDay(to) - startOfDay(from)) / MS_PER_DAY);

const DEFAULT_TYPES = ["Hatchback", "Sedan", "SUV", "MPV", "Luxury"];

const Cars = () => {
  const navigate = useNavigate();

  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // --- filters ---
  const [selectedTypes, setSelectedTypes] = useState(() =>
    DEFAULT_TYPES.reduce((acc, t) => ({ ...acc, [t]: false }), {})
  );
  const [pickupDate, setPickupDate] = useState("");
  const [returnDate, setReturnDate] = useState("");

  // Malaysia-first: state & city selectors, plus area text
  const [malaysiaStates, setMalaysiaStates] = useState([]);
  const [stateSelected, setStateSelected] = useState("");
  const [citiesForState, setCitiesForState] = useState([]);
  const [citySelected, setCitySelected] = useState("");
  const [areaQuery, setAreaQuery] = useState("");

  // geolocation
  const [useMyLocation, setUseMyLocation] = useState(false);
  const [userCoords, setUserCoords] = useState(null);
  const [geoError, setGeoError] = useState("");

  const abortControllerRef = useRef(null);
  const base = import.meta.env.VITE_API_URL || "http://localhost:7889";
  const limit = 12;
  const fallbackImage = `${base}/uploads/default-car.png`;

  // Map state
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [mapError, setMapError] = useState(""); // New: For map load errors
  const mapCenter = { lat: 3.1390, lng: 101.6869 }; // KL default
  const [map, setMap] = useState(null); // New: Reference to the map instance
  const markersRef = useRef([]); // New: To manage markers

  useEffect(() => {
    fetchCars();
    fetchMalaysiaStates();
    return () => {
      if (abortControllerRef.current) {
        try {
          abortControllerRef.current.abort();
        } catch (e) {}
      }
    };
  }, []);

  const fetchCars = async () => {
    setLoading(true);
    setError("");
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch (e) {}
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await axios.get(`${base}/api/cars`, {
        params: { limit },
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });

      const json = res.data;
      setCars(Array.isArray(json.data) ? json.data : json.data ?? json);
    } catch (err) {
      const isCanceled =
        err?.code === "ERR_CANCELED" ||
        (axios.isCancel && axios.isCancel(err)) ||
        err?.name === "CanceledError";
      if (isCanceled) return;

      console.error("Failed to fetch cars:", err);
      setError(
        err?.response?.data?.message || err.message || "Failed to load cars"
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchMalaysiaStates = async () => {
    try {
      const resp = await axios.post(
        "https://countriesnow.space/api/v0.1/countries/states",
        { country: "Malaysia" },
        { timeout: 10000 }
      );
      const st =
        resp?.data?.data?.states?.map((s) =>
          typeof s === "string" ? { name: s } : { name: s.name || s }
        ) || [];
      setMalaysiaStates(st);
    } catch (err) {
      console.warn("Failed to load Malaysia states", err);
      setMalaysiaStates([]);
    }
  };

  const fetchCitiesForState = async (stateName) => {
    if (!stateName) {
      setCitiesForState([]);
      return;
    }
    try {
      const resp = await axios.post(
        "https://countriesnow.space/api/v0.1/countries/state/cities",
        { country: "Malaysia", state: stateName },
        { timeout: 10000 }
      );
      const ct =
        resp?.data?.data?.map((c) => ({ name: c })) || [];
      setCitiesForState(ct);
    } catch (err) {
      console.warn("Failed to load cities for state", err);
      setCitiesForState([]);
    }
  };

  useEffect(() => {
    if (stateSelected) {
      fetchCitiesForState(stateSelected);
      setCitySelected("");
    } else {
      setCitiesForState([]);
      setCitySelected("");
    }
  }, [stateSelected]);

  const buildImageSrc = (image) => {
    if (!image) return "";
    if (Array.isArray(image)) image = image[0];
    if (typeof image !== "string") return "";

    const trimmed = image.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }
    if (trimmed.startsWith("/")) {
      return `${base}${trimmed}`;
    }
    return `${base}/uploads/${trimmed}`;
  };

  const handleImageError = (e) => {
    const img = e?.target;
    if (!img) return;
    img.onerror = null;
    img.src = fallbackImage;
    img.alt = img.alt || "Image not available";
    img.style.objectFit = img.style.objectFit || "cover";
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const opts =
        d.getFullYear() === now.getFullYear()
          ? { day: "numeric", month: "short" }
          : { day: "numeric", month: "short", year: "numeric" };
      return new Intl.DateTimeFormat("en-IN", opts).format(d);
    } catch {
      return dateStr;
    }
  };

  const plural = (n, singular, pluralForm) => {
    if (n === 1) return `1 ${singular}`;
    return `${n} ${pluralForm ?? singular + "s"}`;
  };

  // availability helpers (same as before)
  const computeEffectiveAvailability = (car) => {
    const today = new Date();

    if (Array.isArray(car.bookings) && car.bookings.length) {
      const overlapping = car.bookings
        .map((b) => {
          const pickup = b.pickupDate ?? b.startDate ?? b.start ?? b.from;
          const ret = b.returnDate ?? b.endDate ?? b.end ?? b.to;
          if (!pickup || !ret) return null;
          return { pickup: new Date(pickup), return: new Date(ret), raw: b };
        })
        .filter(Boolean)
        .filter(
          (b) =>
            startOfDay(b.pickup) <= startOfDay(today) &&
            startOfDay(today) <= startOfDay(b.return)
        );

      if (overlapping.length > 0) {
        overlapping.sort((a, b) => b.return - a.return);
        return {
          state: "booked",
          until: overlapping[0].return.toISOString(),
          source: "bookings",
        };
      }
    }

    if (car.availability) {
      if (car.availability.state === "booked" && car.availability.until) {
        return {
          state: "booked",
          until: car.availability.until,
          source: "availability",
        };
      }

      if (
        car.availability.state === "available_until_reservation" &&
        Number(car.availability.daysAvailable ?? -1) === 0
      ) {
        return {
          state: "booked",
          until: car.availability.until ?? null,
          source: "availability-res-starts-today",
          nextBookingStarts: car.availability.nextBookingStarts,
        };
      }

      return { ...car.availability, source: "availability" };
    }

    return { state: "fully_available", source: "none" };
  };

  // overlap utilities for date filter
  const doesBookingOverlapRange = (booking, reqPickup, reqReturn) => {
    const pickup = booking.pickupDate ?? booking.startDate ?? booking.start ?? booking.from;
    const ret = booking.returnDate ?? booking.endDate ?? booking.end ?? booking.to;
    if (!pickup || !ret) return false;
    const bStart = startOfDay(new Date(pickup));
    const bEnd = startOfDay(new Date(ret));
    return bStart <= reqReturn && bEnd >= reqPickup;
  };

  const isAvailableForRange = (car, reqPickupIso, reqReturnIso) => {
    if (!reqPickupIso || !reqReturnIso) return true;
    try {
      const reqPickup = startOfDay(new Date(reqPickupIso));
      const reqReturn = startOfDay(new Date(reqReturnIso));
      if (reqReturn < reqPickup) return false;

      if (Array.isArray(car.bookings) && car.bookings.length) {
        for (const b of car.bookings) {
          if (doesBookingOverlapRange(b, reqPickup, reqReturn)) return false;
        }
      }

      if (car.availability) {
        if (car.availability.state === "booked" && car.availability.until) {
          const until = startOfDay(new Date(car.availability.until));
          if (until >= reqPickup) return false;
        }
        if (car.availability.nextBookingStarts) {
          const nextStart = startOfDay(new Date(car.availability.nextBookingStarts));
          if (nextStart <= reqReturn && nextStart >= reqPickup) return false;
        }
      }

      return true;
    } catch {
      return true;
    }
  };

  // location helpers: prefer company.location
  const getCarCoordinates = (car) => {
    const loc = car.company?.location ?? car.location ?? null;
    if (loc && Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
      return [Number(loc.coordinates[1]), Number(loc.coordinates[0])];
    }
    if (car.lat !== undefined && car.lng !== undefined) {
      return [Number(car.lat), Number(car.lng)];
    }
    if (car.latitude !== undefined && car.longitude !== undefined) {
      return [Number(car.latitude), Number(car.longitude)];
    }
    return null;
  };

  const haversineKm = (lat1, lon1, lat2, lon2) => {
    const toRad = (x) => (x * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // city / area matching
  const matchesState = (car, state) => {
    if (!state) return true;
    const q = state.trim().toLowerCase();
    const candidates = [
      car.company?.address?.state,
      car.company?.address?.region,
      car.company?.address?.stateName,
      car.state,
      car.company?.state,
    ]
      .filter(Boolean)
      .map((s) => (typeof s === "string" ? s.toLowerCase() : JSON.stringify(s).toLowerCase()));
    return candidates.some((t) => t.includes(q));
  };

  const matchesCity = (car, city) => {
    if (!city) return true;
    const c = city.trim().toLowerCase();
    const candidates = [
      car.company?.address?.city,
      car.company?.address?.cityName,
      car.company?.city,
      car.city,
      car.pickupLocation,
      car.locationName,
    ]
      .filter(Boolean)
      .map((s) => (typeof s === "string" ? s.toLowerCase() : JSON.stringify(s).toLowerCase()));
    return candidates.some((t) => t.includes(c));
  };

  const matchesArea = (car, area) => {
    if (!area) return true;
    const q = area.trim().toLowerCase();
    const candidates = [
      car.company?.address?.street,
      car.company?.address?.city,
      car.address,
      car.pickupLocation,
      car.description,
      `${car.make} ${car.model}`,
    ]
      .filter(Boolean)
      .map((s) => (typeof s === "string" ? s.toLowerCase() : JSON.stringify(s).toLowerCase()));
    return candidates.some((t) => t.includes(q));
  };

  // detect user location
  const obtainUserLocation = useCallback(() => {
    setGeoError("");
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords([pos.coords.latitude, pos.coords.longitude]);
        setUseMyLocation(true);
      },
      (err) => {
        setGeoError(err?.message || "Failed to obtain location");
      },
      { timeout: 10000 }
    );
  }, []);

  // toggle locate off if unchecked
  useEffect(() => {
    if (!useMyLocation) {
      setUserCoords(null);
      setGeoError("");
    }
  }, [useMyLocation]);

  const activeTypes = useMemo(
    () => Object.keys(selectedTypes).filter((t) => selectedTypes[t]),
    [selectedTypes]
  );

  // final filtered list
  const filteredCars = useMemo(() => {
    const reqPickup = pickupDate ? startOfDay(new Date(pickupDate)) : null;
    const reqReturn = returnDate ? startOfDay(new Date(returnDate)) : null;

    let list = Array.isArray(cars) ? cars.slice() : [];

    // type filter
    if (activeTypes.length > 0) {
      list = list.filter((car) => {
        const cat = (car.category ?? car.type ?? "").toString();
        return activeTypes.some((t) => cat.toLowerCase() === t.toLowerCase() || cat.toLowerCase().includes(t.toLowerCase()));
      });
    }

    // state filter (Malaysia-focused)
    if (stateSelected) {
      list = list.filter((car) => matchesState(car, stateSelected));
    }

    // city filter (narrow within state)
    if (citySelected) {
      list = list.filter((car) => matchesCity(car, citySelected));
    }

    // area filter optional
    if (areaQuery && areaQuery.trim()) {
      list = list.filter((car) => matchesArea(car, areaQuery));
    }

    // dates filter
    if (reqPickup && reqReturn) {
      list = list.filter((car) => isAvailableForRange(car, reqPickup.toISOString(), reqReturn.toISOString()));
    }

    // if user coords available, compute distance and sort by it
    if (userCoords) {
      const [uLat, uLng] = userCoords;
      const withDist = list.map((car) => {
        const coords = getCarCoordinates(car);
        if (coords) {
          const [cLat, cLng] = coords;
          const km = haversineKm(uLat, uLng, cLat, cLng);
          return { car, _distKm: km };
        }
        return { car, _distKm: Infinity };
      });
      withDist.sort((a, b) => {
        if (a._distKm === b._distKm) return 0;
        return a._distKm - b._distKm;
      });
      return withDist.map((x) => ({ ...(x.car || {}), _distanceKm: Number.isFinite(x._distKm) && x._distKm !== Infinity ? Number(x._distKm.toFixed(2)) : null }));
    }

    return list;
  }, [cars, activeTypes, stateSelected, citySelected, areaQuery, pickupDate, returnDate, userCoords]);

  // New: Group cars by company
  const companyMarkers = useMemo(() => {
    const companies = {};
    filteredCars.forEach((car) => {
      const companyKey = car.company?.name || car.company?.id || 'Unknown';
      if (!companies[companyKey]) {
        companies[companyKey] = {
          company: car.company,
          location: getCarCoordinates(car), // Use first car's location
          cars: [],
        };
      }
      companies[companyKey].cars.push(car);
    });
    return Object.values(companies).filter((comp) => comp.location); // Only with valid locations
  }, [filteredCars]);

  // availability badge rendering (re-used)
  const computeAvailableMeta = (untilIso) => {
    if (!untilIso) return null;
    try {
      const until = new Date(untilIso);
      const available = new Date(until);
      available.setDate(available.getDate() + 1);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const daysUntilAvailable = daysBetween(today, available);
      return { availableIso: available.toISOString(), daysUntilAvailable };
    } catch {
      return null;
    }
  };

  const renderAvailabilityBadge = (rawAvailability, car) => {
    const effective = computeEffectiveAvailability(car);

    if (!effective) {
      return (
        <span className="px-2 py-1 text-xs rounded-md bg-green-50 text-green-700">
          Available
        </span>
      );
    }

    if (effective.state === "booked") {
      if (effective.until) {
        const meta = computeAvailableMeta(effective.until);
        if (meta && meta.availableIso) {
          return (
            <div className="flex flex-col items-end">
              <span className="px-2 py-1 text-xs rounded-md bg-red-50 text-red-700 font-semibold">
                Booked — available on {formatDate(meta.availableIso)}
              </span>
              <small className="text-xs text-gray-400 mt-1">
                until {formatDate(effective.until)}
              </small>
            </div>
          );
        }
        return (
          <div className="flex flex-col items-end">
            <span className="px-2 py-1 text-xs rounded-md bg-red-50 text-red-700 font-semibold">
              Booked
            </span>
            <small className="text-xs text-gray-400 mt-1">
              until {formatDate(effective.until)}
            </small>
          </div>
        );
      }
      return (
        <div className="flex flex-col items-end">
          <span className="px-2 py-1 text-xs rounded-md bg-red-50 text-red-700 font-semibold">
            Booked
          </span>
        </div>
      );
    }

    if (effective.state === "available_until_reservation") {
      const days = Number(effective.daysAvailable ?? -1);
      if (!Number.isFinite(days) || days < 0) {
        return (
          <div className="flex flex-col items-end">
            <span className="px-2 py-1 text-xs rounded-md bg-amber-50 text-amber-800 font-semibold">
              Available
            </span>
            {effective.nextBookingStarts && (
              <small className="text-xs text-gray-400 mt-1">
                from {formatDate(effective.nextBookingStarts)}
              </small>
            )}
          </div>
        );
      }
      if (days === 0) {
        return (
          <div className="flex flex-col items-end">
            <span className="px-2 py-1 text-xs rounded-md bg-red-50 text-red-700 font-semibold">
              Booked — starts today
            </span>
            {effective.nextBookingStarts && (
              <small className="text-xs text-gray-400 mt-1">
                from {formatDate(effective.nextBookingStarts)}
              </small>
            )}
          </div>
        );
      }
      return (
        <div className="flex flex-col items-end">
          <span className="px-2 py-1 text-xs rounded-md bg-amber-50 text-amber-800 font-semibold">
            Available — reserved in {plural(days, "day")}
          </span>
          {effective.nextBookingStarts && (
            <small className="text-xs text-gray-400 mt-1">
              from {formatDate(effective.nextBookingStarts)}
            </small>
          )}
        </div>
      );
    }

    return (
      <span className="px-2 py-1 text-xs rounded-md bg-green-50 text-green-700">
        Available
      </span>
    );
  };

  const isBookDisabled = (car) => {
    const effective = computeEffectiveAvailability(car);
    if (car?.status && car.status !== "available") return true;
    if (!effective) return false;
    return effective.state === "booked";
  };

  // When booking from the cards, pass selected dates so CarDetail pre-fills the booking form
  const handleBook = (car, id) => {
    const disabled = isBookDisabled(car);
    if (disabled) return;
    navigate(`/cars/${id}`, { state: { car, pickupDate: pickupDate || null, returnDate: returnDate || null } });
  };

  const toggleType = (type) => {
    setSelectedTypes((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const resetFilters = () => {
    setSelectedTypes(DEFAULT_TYPES.reduce((acc, t) => ({ ...acc, [t]: false }), {}));
    setPickupDate("");
    setReturnDate("");
    setStateSelected("");
    setCitySelected("");
    setAreaQuery("");
    setUseMyLocation(false);
    setUserCoords(null);
    setGeoError("");
  };

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  console.log("API Key loaded:", apiKey ? "Present" : "Missing"); // Debug: Check if key is loaded

  // New: Create AdvancedMarkerElement markers when map loads
  const createMarkers = useCallback(async () => {
    if (!map || !window.google) return;
    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    try {
      const { AdvancedMarkerElement } = await window.google.maps.importLibrary("marker");
      companyMarkers.forEach((companyData) => {
        const marker = new AdvancedMarkerElement({
          map,
          position: { lat: companyData.location[0], lng: companyData.location[1] },
          title: companyData.company?.name || 'Company',
        });
        marker.addListener('click', () => setSelectedMarker(companyData));
        markersRef.current.push(marker);
      });
    } catch (err) {
      console.error("Error creating AdvancedMarkerElement:", err);
      setMapError("Failed to create map markers.");
    }
  }, [map, companyMarkers]);

  useEffect(() => {
    createMarkers();
  }, [createMarkers]);

  return (
    <div className={carPageStyles.pageContainer}>
      <div className={carPageStyles.contentContainer}>
        <div className={carPageStyles.headerContainer}>
          <div className={carPageStyles.headerDecoration}></div>
          <h1 className={carPageStyles.title}>Premium Car Collection</h1>
          <p className={carPageStyles.subtitle}>
            Find cars by state & city in Malaysia — or use Locate to find the closest vehicles to you. Map-first discovery for nearest cars.
          </p>
        </div>

        {/* Filters */}
        <div className="w-full max-w-7xl mx-auto mb-6">
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 flex flex-col lg:flex-row gap-4 items-start">
            <div className="flex-1 min-w-[220px]">
              <label className="text-sm text-gray-300 block mb-2">State</label>
              {malaysiaStates && malaysiaStates.length > 0 ? (
                <select
                  value={stateSelected}
                  onChange={(e) => setStateSelected(e.target.value)}
                  className="w-full p-2 rounded bg-gray-800 text-white"
                >
                  <option value="">Choose a state</option>
                  {malaysiaStates.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={stateSelected}
                  onChange={(e) => setStateSelected(e.target.value)}
                  placeholder="State / Region"
                  className="w-full p-2 rounded bg-gray-700 text-white"
                />
              )}
            </div>

            <div className="flex-1 min-w-[220px]">
              <label className="text-sm text-gray-300 block mb-2">City</label>
              {citiesForState && citiesForState.length > 0 ? (
                <select
                  value={citySelected}
                  onChange={(e) => setCitySelected(e.target.value)}
                  className="w-full p-2 rounded bg-gray-800 text-white"
                >
                  <option value="">Choose a city</option>
                  {citiesForState.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={citySelected}
                  onChange={(e) => setCitySelected(e.target.value)}
                  placeholder="City"
                  className="w-full p-2 rounded bg-gray-700 text-white"
                />
              )}
            </div>

            <div className="flex-1 min-w-[220px]">
              <label className="text-sm text-gray-300 block mb-2">Area (optional)</label>
              <input
                value={areaQuery}
                onChange={(e) => setAreaQuery(e.target.value)}
                placeholder="Neighborhood / area name"
                className="w-full p-2 rounded bg-gray-700 text-white"
              />
            </div>

            <div className="min-w-[240px] flex flex-col items-end gap-2">
              <div className="flex gap-2 w-full">
                <button
                  onClick={() => { setUseMyLocation((v) => !v); if (!useMyLocation) obtainUserLocation(); else { setUserCoords(null); setGeoError(''); } }}
                  className={`px-3 py-2 rounded flex items-center gap-2 text-white ${useMyLocation ? 'bg-amber-600' : 'bg-orange-600'}`}
                  title="Locate and sort by nearest cars"
                >
                  <FaMapMarkerAlt /> {useMyLocation ? 'Using my location' : 'Locate'}
                </button>
                <button onClick={resetFilters} className="px-3 py-2 rounded bg-gray-700 text-white flex items-center gap-2">
                  <FaSyncAlt /> Reset
                </button>
              </div>
              <small className="text-xs text-gray-400 self-end">
                {useMyLocation && userCoords ? `Sorting by distance — ${userCoords[0].toFixed(4)},${userCoords[1].toFixed(4)}` : geoError ? geoError : 'Filtering by Malaysian state & city (manual or select state→city).'}
              </small>
            </div>
          </div>

          {/* Car types + dates */}
          <div className="mt-3 bg-gray-900/50 border border-gray-800 rounded-xl p-3 flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-3 flex-wrap">
              {DEFAULT_TYPES.map((t) => (
                <label key={t} className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!selectedTypes[t]} onChange={() => toggleType(t)} className="w-4 h-4" />
                  <span className="text-gray-200">{t}</span>
                </label>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} min={new Date().toISOString().split("T")[0]} className="p-2 rounded bg-gray-800 text-white" />
              <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} min={pickupDate || new Date().toISOString().split("T")[0]} className="p-2 rounded bg-gray-800 text-white" />
            </div>
          </div>
        </div>

        {/* Map View (above list) with Error Handling */}
        <div className="w-full mb-6">
          {apiKey ? (
            <LoadScript
              googleMapsApiKey={apiKey}
              libraries={GOOGLE_MAPS_LIBRARIES} // Use static constant
              onError={() => setMapError("Failed to load Google Maps. Check your API key and billing.")}
            >
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: '400px' }}
                center={userCoords ? { lat: userCoords[0], lng: userCoords[1] } : mapCenter}
                zoom={12}
                mapId={import.meta.env.VITE_GOOGLE_MAP_ID}
                onLoad={(mapInstance) => { setMap(mapInstance); setMapError(""); }}
                onError={() => setMapError("Map failed to load.")}
              >
                {/* Markers created in createMarkers */}
                {selectedMarker && (
                  <InfoWindow position={{ lat: selectedMarker.location[0], lng: selectedMarker.location[1] }} onCloseClick={() => setSelectedMarker(null)}>
                    <div>
                      <h3>{selectedMarker.company?.name || 'Company'}</h3>
                      <p>{selectedMarker.company?.address?.city || ''}</p>
                      <h4>Cars Available:</h4>
                      <ul>
                        {selectedMarker.cars.map((car) => (
                          <li key={car._id}>
                            {car.make} {car.model} - MYR {car.dailyRate}/day
                            <button onClick={() => handleBook(car, car._id)} className="ml-2 bg-blue-600 text-white px-2 py-1 rounded">Book</button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </InfoWindow>
                )}
              </GoogleMap>
            </LoadScript>
          ) : (
            <div className="text-center text-red-400 p-4 bg-gray-800 rounded">
              Google Maps API key is missing. Please set VITE_GOOGLE_MAPS_API_KEY in your .env file and ensure it's enabled in Google Cloud Console.
            </div>
          )}
          {mapError && (
            <div className="text-center text-red-400 p-4 bg-gray-800 rounded mt-2">
              {mapError} Refer to Google Maps documentation for setup.
            </div>
          )}
        </div>

        {/* List View (below map) */}
        <div className={carPageStyles.gridContainer}>
          {loading &&
            Array.from({ length: limit }).map((_, i) => (
              <div key={`skeleton-${i}`} className={carPageStyles.carCard}>
                <div className={carPageStyles.glowEffect}></div>
                <div className={carPageStyles.imageContainer}>
                  <div className="w-full h-full bg-gray-200 animate-pulse" />
                </div>
                <div className={carPageStyles.cardContent}>
                  <div className="h-6 bg-gray-200 rounded w-3/4 mb-2 animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-4 animate-pulse" />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-6 bg-gray-200 rounded animate-pulse" />
                    <div className="h-6 bg-gray-200 rounded animate-pulse" />
                  </div>
                  <div className="h-10 bg-gray-200 rounded mt-4 animate-pulse" />
                </div>
              </div>
            ))}

          {!loading && error && (
            <div className="col-span-full text-center text-red-600">
              {error}
            </div>
          )}

          {!loading && !error && filteredCars.length === 0 && (
            <div className="col-span-full text-center">No cars found with current filters.</div>
          )}

          {!loading &&
            filteredCars.map((car, idx) => {
              const id = car._id ?? car.id ?? idx;
              const carName =
                `${car.make || car.name || ""} ${car.model || ""}`.trim() ||
                car.name ||
                "Unnamed";
              const imageSrc = buildImageSrc(car.image) || fallbackImage;
              const disabled = isBookDisabled(car);

              const companyName = car.company?.name || car.companyName || car.ownerName || "";
              const companyCity = car.company?.address?.city || car.company?.address?.cityName || "";
              const companyState = car.company?.address?.state || "";

              return (
                <div key={id} className={carPageStyles.carCard}>
                  <div className={carPageStyles.glowEffect}></div>

                  <div className={carPageStyles.imageContainer}>
                    <div className="absolute inset-0 z-10" />
                    <img
                      src={imageSrc}
                      alt={carName}
                      onError={handleImageError}
                      className={carPageStyles.carImage}
                    />

                    <div className="absolute right-4 top-4 z-20">
                      {renderAvailabilityBadge(car.availability, car)}
                    </div>

                    <div className={carPageStyles.priceBadge}>
                      MYR&nbsp;{car.dailyRate ?? car.price ?? car.pricePerDay ?? "—"}
                      /day
                    </div>
                  </div>

                  <div className={carPageStyles.cardContent}>
                    <div className={carPageStyles.headerRow}>
                      <div>
                        <h3 className={carPageStyles.carName}>{carName}</h3>
                        <p className={carPageStyles.carType}>
                          {car.category ?? car.type ?? "Sedan"}
                        </p>

                        {companyName ? (
                          <div className="mt-1 flex items-center gap-2 text-xs text-gray-300">
                            <FaBuilding className="text-gray-400" />
                            <span className="truncate">{companyName}{companyCity ? ` — ${companyCity}` : companyState ? ` — ${companyState}` : ''}</span>
                          </div>
                        ) : null}
                      </div>
                      <div className="text-right text-sm text-gray-300">
                        {car._distanceKm ? (
                          <div className="text-xs text-gray-400">{car._distanceKm} km</div>
                        ) : null}
                      </div>
                    </div>

                    <div className={carPageStyles.specsGrid}>
                      <div className={carPageStyles.specItem}>
                        <div className={carPageStyles.specIconContainer}>
                          <FaUserFriends className="text-sky-400" />
                        </div>
                        <span>{car.seats ?? "4"} Seats</span>
                      </div>

                      <div className={carPageStyles.specItem}>
                        <div className={carPageStyles.specIconContainer}>
                          <FaGasPump className="text-amber-400" />
                        </div>
                        <span>{car.fuelType ?? car.fuel ?? "Gasoline"}</span>
                      </div>

                      <div className={carPageStyles.specItem}>
                        <div className={carPageStyles.specIconContainer}>
                          <FaTachometerAlt className="text-emerald-400" />
                        </div>
                        <span>{car.mileage ? `${car.mileage} kmpl` : "—"}</span>
                      </div>

                      <div className={carPageStyles.specItem}>
                        <div className={carPageStyles.specIconContainer}>
                          <FaShieldAlt className="text-purple-400" />
                        </div>
                        <span>Premium</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleBook(car, id)}
                      className={`${carPageStyles.bookButton} ${
                        disabled ? "opacity-60 cursor-not-allowed" : ""
                      }`}
                      aria-label={`Book ${carName}`}
                      title={
                        disabled
                          ? "This car is currently booked or unavailable"
                          : `Book ${carName}`
                      }
                      disabled={disabled}
                    >
                      <span className={carPageStyles.buttonText}>
                        {disabled ? "Unavailable" : "Book Now"}
                      </span>
                      <FaArrowRight className={carPageStyles.buttonIcon} />
                    </button>
                  </div>
                </div>
              );
            })}
        </div>

        <div className={carPageStyles.decor1}></div>
        <div className={carPageStyles.decor2}></div>
      </div>
    </div>
  );
};

export default Cars;