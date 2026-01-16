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
  FaLocationArrow,
  FaSyncAlt,
} from "react-icons/fa";
import axios from "axios";
import { carPageStyles } from "../assets/dummyStyles.js";

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

  // --- filter state ---
  const [locationQuery, setLocationQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState(() =>
    DEFAULT_TYPES.reduce((acc, t) => ({ ...acc, [t]: false }), {})
  );
  const [pickupDate, setPickupDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [useMyLocation, setUseMyLocation] = useState(false);
  const [userCoords, setUserCoords] = useState(null);
  const [geoError, setGeoError] = useState("");

  const abortControllerRef = useRef(null);
  const base = "http://localhost:7889";
  const limit = 12;
  const fallbackImage = `${base}/uploads/default-car.png`;

  useEffect(() => {
    fetchCars();
    return () => {
      if (abortControllerRef.current) {
        try {
          abortControllerRef.current.abort();
        } catch (e) {
        }
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
    // prevent infinite loop if fallback also fails
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

  // Compute canonical availability (existing)
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
        // reservation starts today -> treat as booked
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

  // Booking overlap check for a requested date range (inclusive)
  const doesBookingOverlapRange = (booking, reqPickup, reqReturn) => {
    const pickup = booking.pickupDate ?? booking.startDate ?? booking.start ?? booking.from;
    const ret = booking.returnDate ?? booking.endDate ?? booking.end ?? booking.to;
    if (!pickup || !ret) return false;
    const bStart = startOfDay(new Date(pickup));
    const bEnd = startOfDay(new Date(ret));
    // overlap if booking.start <= reqReturn && booking.end >= reqPickup
    return bStart <= reqReturn && bEnd >= reqPickup;
  };

  // Check if car is available for requested date range (both dates required)
  const isAvailableForRange = (car, reqPickupIso, reqReturnIso) => {
    if (!reqPickupIso || !reqReturnIso) return true; // no restriction
    try {
      const reqPickup = startOfDay(new Date(reqPickupIso));
      const reqReturn = startOfDay(new Date(reqReturnIso));
      if (reqReturn < reqPickup) return false;

      // 1) check explicit bookings
      if (Array.isArray(car.bookings) && car.bookings.length) {
        for (const b of car.bookings) {
          if (doesBookingOverlapRange(b, reqPickup, reqReturn)) return false;
        }
      }

      // 2) check availability metadata from backend
      if (car.availability) {
        // if availability says booked until a date that overlaps request -> not available
        if (car.availability.state === "booked" && car.availability.until) {
          const until = startOfDay(new Date(car.availability.until));
          // if until >= reqPickup then there's an overlap (booked covering reqPickup)
          if (until >= reqPickup) return false;
        }
        // if availability has nextBookingStarts and it starts before or on reqReturn, then it's reserved within requested window -> consider unavailable
        if (car.availability.nextBookingStarts) {
          const nextStart = startOfDay(new Date(car.availability.nextBookingStarts));
          if (nextStart <= reqReturn && nextStart >= reqPickup) return false;
        }
      }

      // else assume available
      return true;
    } catch {
      return true;
    }
  };

  // --- location helpers: attempt coordinates then textual matching ---
  const getCarCoordinates = (car) => {
    // common shapes: car.location.coordinates [lng, lat], car.company.location.coordinates
    const loc = car.location ?? car.company?.location ?? null;
    if (loc && Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
      // return [lat, lng]
      return [Number(loc.coordinates[1]), Number(loc.coordinates[0])];
    }
    // fallback: lat, lng fields
    if (car.lat !== undefined && car.lng !== undefined) {
      return [Number(car.lat), Number(car.lng)];
    }
    if (car.latitude !== undefined && car.longitude !== undefined) {
      return [Number(car.latitude), Number(car.longitude)];
    }
    return null;
  };

  const haversineKm = (lat1, lon1, lat2, lon2) => {
    // returns distance in km
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

  const matchesLocationQuery = (car, query) => {
    if (!query || !query.trim()) return true;
    const q = query.trim().toLowerCase();
    const candidates = [
      car.locationName,
      car.location,
      car.address,
      car.pickupLocation,
      car.company?.name,
      car.company?.address?.city,
      car.company?.address?.street,
      car.company?.address?.state,
      car.city,
      car.cityName,
      car.make,
      car.model,
    ]
      .filter(Boolean)
      .map((s) => (typeof s === "string" ? s.toLowerCase() : JSON.stringify(s).toLowerCase()));

    return candidates.some((text) => text.includes(q));
  };

  // attempt to get user coords
  const obtainUserLocation = useCallback(() => {
    setGeoError("");
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords([pos.coords.latitude, pos.coords.longitude]);
      },
      (err) => {
        setGeoError(err?.message || "Failed to obtain location");
      },
      { timeout: 10000 }
    );
  }, []);

  // toggle "use my location"
  useEffect(() => {
    if (useMyLocation) {
      obtainUserLocation();
    } else {
      setUserCoords(null);
      setGeoError("");
    }
  }, [useMyLocation, obtainUserLocation]);

  // prepare a typed set for easier checks
  const activeTypes = useMemo(
    () => Object.keys(selectedTypes).filter((t) => selectedTypes[t]),
    [selectedTypes]
  );

  // compute filtered list (client-side)
  const filteredCars = useMemo(() => {
    const reqPickup = pickupDate ? startOfDay(new Date(pickupDate)) : null;
    const reqReturn = returnDate ? startOfDay(new Date(returnDate)) : null;

    let list = Array.isArray(cars) ? cars.slice() : [];

    // 1. filter by types if any selected
    if (activeTypes.length > 0) {
      list = list.filter((car) => {
        const cat = (car.category ?? car.type ?? "").toString();
        return activeTypes.some((t) => cat.toLowerCase() === t.toLowerCase() || cat.toLowerCase().includes(t.toLowerCase()));
      });
    }

    // 2. filter by textual location query
    if (locationQuery && locationQuery.trim()) {
      list = list.filter((car) => matchesLocationQuery(car, locationQuery));
    }

    // 3. filter by availability for requested dates
    if (reqPickup && reqReturn) {
      list = list.filter((car) => isAvailableForRange(car, reqPickup.toISOString(), reqReturn.toISOString()));
    }

    // 4. if user coords available, compute distance (and sort by it)
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
      return withDist.map((x) => {
        // attach distance for UI, but return car objects with _distanceKm field
        const out = { ...(x.car || {}), _distanceKm: Number.isFinite(x._distKm) && x._distKm !== Infinity ? Number(x._distKm.toFixed(2)) : null };
        return out;
      });
    }

    return list;
  }, [cars, activeTypes, locationQuery, pickupDate, returnDate, userCoords]);

  // --- existing availability rendering / helpers ---
  // Given an 'until' ISO date, compute day-after available date + daysUntilAvailable
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

  // Render availability badge — prefer showing concrete available date when booked
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
      // booked but no until info
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

    // fully_available or fallback
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

  const handleBook = (car, id) => {
    const disabled = isBookDisabled(car);
    if (disabled) return;
    navigate(`/cars/${id}`, { state: { car } });
  };

  // toggle type checkbox
  const toggleType = (type) => {
    setSelectedTypes((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const resetFilters = () => {
    setLocationQuery("");
    setSelectedTypes(DEFAULT_TYPES.reduce((acc, t) => ({ ...acc, [t]: false }), {}));
    setPickupDate("");
    setReturnDate("");
    setUseMyLocation(false);
    setUserCoords(null);
    setGeoError("");
  };

  return (
    <div className={carPageStyles.pageContainer}>
      {/* Main Content */}
      <div className={carPageStyles.contentContainer}>
        <div className={carPageStyles.headerContainer}>
          <div className={carPageStyles.headerDecoration}></div>
          <h1 className={carPageStyles.title}>Premium Car Collection</h1>
          <p className={carPageStyles.subtitle}>
            Discover our exclusive fleet of vehicles. Use filters to find cars by location, type and availability.
          </p>
        </div>

        {/* --- Filters panel (simple and safe UI) --- */}
        <div className="w-full max-w-7xl mx-auto mb-6">
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-start">
            <div className="flex-1 min-w-[220px]">
              <label className="text-sm text-gray-300 block mb-2">Location</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  placeholder="City or area (e.g. Kuala Lumpur)"
                  className="w-full p-2 rounded bg-gray-800 border border-gray-700 text-white"
                />
                <button
                  title="Use my current location"
                  onClick={() => setUseMyLocation((v) => !v)}
                  className={`p-2 rounded bg-gradient-to-r from-orange-600 to-orange-700 text-white flex items-center gap-2 ${useMyLocation ? "opacity-90" : "opacity-80"}`}
                  aria-pressed={useMyLocation}
                >
                  <FaLocationArrow />
                </button>
              </div>
              {geoError && <small className="text-xs text-red-400 mt-1">{geoError}</small>}
            </div>

            <div className="flex-1 min-w-[220px]">
              <label className="text-sm text-gray-300 block mb-2">Car Types</label>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_TYPES.map((t) => (
                  <label key={t} className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!selectedTypes[t]}
                      onChange={() => toggleType(t)}
                      className="w-4 h-4"
                    />
                    <span className="text-gray-200">{t}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="min-w-[220px]">
              <label className="text-sm text-gray-300 block mb-2">Dates</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="p-2 rounded bg-gray-800 border border-gray-700 text-white"
                />
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  min={pickupDate || new Date().toISOString().split("T")[0]}
                  className="p-2 rounded bg-gray-800 border border-gray-700 text-white"
                />
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-2">
                <button
                  onClick={resetFilters}
                  className="px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 text-sm text-white flex items-center gap-2"
                >
                  <FaSyncAlt /> Reset
                </button>
                <button
                  onClick={() => obtainUserLocation()}
                  className="px-3 py-2 rounded bg-orange-600 hover:bg-orange-500 text-sm text-white flex items-center gap-2"
                >
                  <FaMapMarkerAlt /> Locate
                </button>
              </div>
              <small className="text-xs text-gray-400">
                {useMyLocation && userCoords ? `Sorting by your location (closest first)` : useMyLocation && !userCoords ? 'Obtaining your location...' : 'Filters applied live'}
              </small>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className={carPageStyles.gridContainer}>
          {loading &&
            // show skeleton placeholders when loading
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

                    {/* availability badge at top-right of card */}
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

        {/* Floating decorative elements */}
        <div className={carPageStyles.decor1}></div>
        <div className={carPageStyles.decor2}></div>
      </div>
    </div>
  );
};

export default Cars;