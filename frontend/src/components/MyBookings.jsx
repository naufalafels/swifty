import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
  import { Link } from "react-router-dom";
  import {
    FaCar,
    FaCalendarAlt,
    FaMapMarkerAlt,
    FaFilter,
    FaTimes,
    FaCheckCircle,
    FaClock,
    FaTimesCircle,
    FaUser,
    FaCreditCard,
    FaReceipt,
    FaArrowRight,
    FaBuilding,
    FaSearch,
  } from "react-icons/fa";
  import { myBookingsStyles as s } from "../assets/dummyStyles.js";
  import {
    fetchMyBookings,
    cancelBooking as serviceCancelBooking,
    lookupBooking as serviceLookupBooking,
  } from "../services/bookingService.js";
  import api from "../utils/api";

  const TIMEOUT = 15000;

  // ---------- Helpers ----------
  const safeAccess = (fn, fallback = "") => {
    try {
      const v = fn();
      return v === undefined || v === null ? fallback : v;
    } catch {
      return fallback;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const d = new Date(dateString);
    return Number.isNaN(d.getTime())
      ? String(dateString)
      : d.toLocaleDateString("en-US", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
  };

  const formatPrice = (price) => {
    const num = typeof price === "number" ? price : Number(price) || 0;
    return num.toLocaleString("en-US", {
      style: "currency",
      currency: "MYR",
      maximumFractionDigits: 0,
    });
  };

  const daysBetween = (start, end) => {
    try {
      const a = new Date(start);
      const b = new Date(end);
      if (Number.isNaN(a) || Number.isNaN(b)) return 0;
      return Math.ceil((b - a) / (1000 * 60 * 60 * 24));
    } catch {
      return 0;
    }
  };

  const buildCompanyAddress = (company) => {
    if (!company) return "";
    const addr = company.address || company || {};
    const street = addr.street || addr.address_street || "";
    const city = addr.city || addr.address_city || addr.town || "";
    const state = addr.state || addr.address_state || addr.region || "";
    const zip = addr.zipCode || addr.postal_code || addr.address_zipCode || "";
    const country = addr.country || addr.address_country || "";
    return [street, city, state, zip, country].filter(Boolean).join(", ");
  };

  const resolveCompanyFromBooking = (booking, carSnapshot = {}) => {
    if (!booking && !carSnapshot) return null;

    const normalize = (c) => {
      if (!c) return null;
      if (typeof c === "string") {
        const isId = /^[0-9a-fA-F]{8,}$/.test(c);
        if (isId) return { id: c };
        return { name: c };
      }
      const name =
        c.name ||
        c.companyName ||
        c.company_name ||
        c.title ||
        c.displayName ||
        "";
      const logo = c.logo || c.logoUrl || c.logo_url || c.image || c.avatar || "";
      const address = buildCompanyAddress(c);
      const id = c._id || c.id || c.companyId || c.company_id || null;
      return { id, name, address, logo };
    };

    const bCompany = safeAccess(() => booking.company, null);
    const n1 = normalize(bCompany);
    if (n1 && (n1.name || n1.address || n1.logo || n1.id)) return n1;

    const bCompanyName =
      safeAccess(() => booking.companyName, null) ||
      safeAccess(() => booking.company_name, null);
    if (bCompanyName) return normalize(bCompanyName);

    const rawCompany = safeAccess(() => booking.raw?.company, null);
    const n3 = normalize(rawCompany);
    if (n3 && (n3.name || n3.address || n3.logo || n3.id)) return n3;

    const rawCompanyName = safeAccess(() => booking.raw?.companyName, null);
    if (rawCompanyName) return normalize(rawCompanyName);

    const carCompany =
      safeAccess(() => carSnapshot.company, null) ||
      safeAccess(() => booking.car?.company, null) ||
      safeAccess(() => booking.raw?.car?.company, null) ||
      null;
    const n4 = normalize(carCompany);
    if (n4 && (n4.name || n4.address || n4.logo || n4.id)) return n4;

    const snapshotCompanyName =
      safeAccess(() => carSnapshot.companyName, null) ||
      safeAccess(() => booking.car?.companyName, null) ||
      safeAccess(() => booking.raw?.car?.companyName, null) ||
      safeAccess(() => booking.raw?.companyName, null);
    if (snapshotCompanyName) return normalize(snapshotCompanyName);

    const companyId =
      safeAccess(() => booking.companyId, null) ||
      safeAccess(() => booking.company_id, null) ||
      safeAccess(() => booking.raw?.companyId, null) ||
      safeAccess(() => booking.car?.companyId, null) ||
      safeAccess(() => carSnapshot.companyId, null) ||
      null;
    if (companyId) return { id: companyId };

    return null;
  };

  const normalizeBooking = (booking) => {
    const getCarData = () => {
      if (!booking) return {};
      if (typeof booking.car === "string") return { name: booking.car };
      if (booking.car && typeof booking.car === "object") {
        const snapshot = { ...booking.car };
        if (snapshot.id && typeof snapshot.id === "object") {
          const populated = { ...snapshot.id };
          delete snapshot.id;
          return { ...snapshot, ...populated };
        }
        return snapshot;
      }
      if (booking.raw?.car && typeof booking.raw.car === "object") {
        return { ...booking.raw.car };
      }
      return {};
    };

    const carObj = getCarData();
    const details = booking.details || {};
    const address = booking.address || {};

    const image =
      safeAccess(() => booking.carImage) ||
      safeAccess(() => carObj.image) ||
      "https://via.placeholder.com/800x450.png?text=No+Image";

    const pickupDate =
      safeAccess(() => booking.pickupDate) ||
      safeAccess(() => booking.dates?.pickup) ||
      booking.pickup ||
      null;

    const returnDate =
      safeAccess(() => booking.returnDate) ||
      safeAccess(() => booking.dates?.return) ||
      booking.return ||
      null;

    const companyObj = resolveCompanyFromBooking(booking, carObj);

    let resolvedCompany = { name: "", address: "", logo: "", id: "" };
    if (companyObj) {
      resolvedCompany.id = companyObj.id || "";
      resolvedCompany.name = companyObj.name || "";
      resolvedCompany.address = companyObj.address || "";
      resolvedCompany.logo = companyObj.logo || "";
    }

    if (!resolvedCompany.name) {
      resolvedCompany.name =
        safeAccess(() => carObj.companyName, "") ||
        safeAccess(() => booking.raw?.car?.companyName, "") ||
        safeAccess(() => booking.raw?.companyName, "") ||
        "";
    }
    if (!resolvedCompany.address) {
      resolvedCompany.address =
        safeAccess(() => carObj.companyAddress, "") ||
        safeAccess(() => booking.raw?.company?.address, "") ||
        safeAccess(() => booking.raw?.companyAddress, "") ||
        "";
    }
    if (!resolvedCompany.name && resolvedCompany.id) {
      resolvedCompany.name = "";
    }

    const normalized = {
      id: booking._id || booking.id || String(Math.random()).slice(2, 8),
      car: {
        make: carObj.make || carObj.name || "Unnamed Car",
        image,
        year: carObj.year || carObj.modelYear || "",
        category: carObj.category,
        seats: details.seats || carObj.seats || 4,
        transmission:
          details.transmission || carObj.transmission || carObj.gearbox || "",
        fuelType:
          details.fuelType ||
          details.fuel ||
          carObj.fuelType ||
          carObj.fuel ||
          carObj.fuel_type ||
          "",
        mileage:
          details.mileage || carObj.mileage || carObj.kmpl || carObj.mpg || "",
      },
      user: {
        name: booking.customer || safeAccess(() => booking.user?.name) || "Guest",
        email: booking.email || safeAccess(() => booking.user?.email) || "",
        phone: booking.phone || safeAccess(() => booking.user?.phone) || "",
        address:
          address.street || address.city || address.state
            ? `${address.street || ""}${address.city ? ", " + address.city : ""}${
                address.state ? ", " + address.state : ""
              }`
            : safeAccess(() => booking.user?.address) || "",
      },
      dates: { pickup: pickupDate, return: returnDate },
      location:
        address.city || booking.location || carObj.location || "Pickup location",
      price: Number(booking.amount || booking.price || booking.total || 0),
      status:
        booking.status ||
        (booking.paymentStatus === "paid" ? "active" : "") ||
        (booking.paymentStatus === "pending" ? "pending" : "") ||
        "pending",
      bookingDate:
        booking.bookingDate ||
        booking.createdAt ||
        booking.updatedAt ||
        Date.now(),
      paymentMethod: booking.paymentMethod || booking.payment?.method || "",
      paymentId:
        booking.paymentIntentId || booking.paymentId || booking.sessionId || "",
      company: {
        name: resolvedCompany.name || "",
        address: resolvedCompany.address || "",
        logo: resolvedCompany.logo || "",
        id: resolvedCompany.id || "",
      },
      raw: booking,
    };

    try {
      const now = new Date();
      const _return = new Date(normalized.dates.return);
      if (normalized.status === "active" || normalized.status === "pending") {
        normalized.status = _return > now ? "upcoming" : "completed";
      }
    } catch {
      normalized.status = normalized.status || "upcoming";
    }

    return normalized;
  };

  const FilterButton = ({ filterKey, currentFilter, icon, label, onClick }) => (
    <button
      type="button"
      onClick={() => onClick(filterKey)}
      className={s.filterButton(currentFilter === filterKey, filterKey)}
    >
      {icon} {label}
    </button>
  );

  const StatusBadge = ({ status }) => {
    const map = {
      completed: {
        text: "Completed",
        color: "bg-green-500",
        icon: <FaCheckCircle />,
      },
      upcoming: { text: "Upcoming", color: "bg-blue-500", icon: <FaClock /> },
      cancelled: {
        text: "Cancelled",
        color: "bg-red-500",
        icon: <FaTimesCircle />,
      },
      default: { text: "Unknown", color: "bg-gray-500", icon: null },
    };
    const { text, color, icon } = map[status] || map.default;
    return (
      <div
        className={`${color} text-white px-3 py-1 rounded-full inline-flex items-center gap-2 text-sm`}
      >
        {icon}
        <span>{text}</span>
      </div>
    );
  };

  const BookingCard = ({ booking, onViewDetails }) => {
    const days = daysBetween(booking.dates.pickup, booking.dates.return);
    return (
      <div className={s.bookingCard}>
        <div className={s.cardImageContainer}>
          <img
            src={booking.car.image}
            alt={booking.car.make}
            className={s.cardImage}
          />
          {booking.company?.logo ? (
            <img
              src={booking.company.logo}
              alt={booking.company.name || "Company"}
              className="absolute left-3 top-3 w-10 h-10 rounded-full object-cover border border-gray-800"
              style={{ background: "#fff" }}
            />
          ) : null}
        </div>

        <div className={s.cardContent}>
          <div className={s.cardHeader}>
            <div>
              <h3 className={s.carTitle}>{booking.car.make}</h3>
              <p className={s.carSubtitle}>
                {booking.car.category} • {booking.car.year}
              </p>

              {booking.company?.name ? (
                <div className="flex items-center gap-2 mt-2 text-sm text-gray-300">
                  <FaBuilding className="text-gray-400" />
                  <div>
                    <div className="font-medium text-sm text-gray-100">
                      {booking.company.name}
                    </div>
                    {booking.company.address ? (
                      <div className="text-xs text-gray-400">
                        {booking.company.address}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : booking.company?.id ? (
                <div className="flex items-center gap-2 mt-2 text-sm text-gray-400">
                  <FaBuilding className="text-gray-400" />
                  <span>Company information unavailable</span>
                </div>
              ) : null}
            </div>
            <div className="text-right">
              <p className={s.priceText}>{formatPrice(booking.price)}</p>
              <p className={s.daysText}>
                for {days} {days > 1 ? "days" : "day"}
              </p>
            </div>
          </div>

          <StatusBadge status={booking.status} />

          <div className={s.detailSection}>
            <div className={s.detailItem}>
              <div className={s.detailIcon}>
                <FaCalendarAlt />
              </div>
              <div>
                <p className={s.detailLabel}>Dates</p>
                <p className={s.detailValue}>
                  {formatDate(booking.dates.pickup)} -{" "}
                  {formatDate(booking.dates.return)}
                </p>
              </div>
            </div>

            <div className={s.detailItem}>
              <div className={s.detailIcon}>
                <FaMapMarkerAlt />
              </div>
              <div>
                <p className={s.detailLabel}>Pickup Location</p>
                <p className={s.detailValue}>{booking.location}</p>
              </div>
            </div>
          </div>

          <div className={s.cardActions}>
            <button
              type="button"
              onClick={() => onViewDetails(booking)}
              className={s.viewDetailsButton}
            >
              <FaReceipt /> View Details
            </button>
            <Link to="/cars" className={s.bookAgainButton}>
              <FaCar />
              {booking.status === "upcoming" ? "Modify" : "Book Again"}
            </Link>
          </div>
        </div>
      </div>
    );
  };

  const BookingModal = ({ booking, onClose, onCancel }) => {
    const days = daysBetween(booking.dates.pickup, booking.dates.return);
    const pricePerDay = days > 0 ? booking.price / days : booking.price;

    return (
      <div className={s.modalOverlay}>
        <div className={s.modalContainer}>
          <div className={s.modalContent}>
            <div className={s.modalHeader}>
              <h2 className={s.modalTitle}>
                <FaReceipt className="text-orange-400" /> Booking Details
              </h2>
              <div className="flex items-center gap-2">
                {booking.status === "upcoming" && (
                  <button
                    type="button"
                    onClick={() => onCancel(booking.id)}
                    className={s.cancelButton}
                  >
                    Cancel Booking
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className={s.modalCloseButton}
                >
                  <FaTimes />
                </button>
              </div>
            </div>

            <div className={s.modalGrid}>
              <div>
                <img
                  src={booking.car.image}
                  alt={booking.car.make}
                  className={s.carImageModal}
                />
              </div>

              <div>
                <div className="flex items-center gap-3">
                  {booking.company?.logo ? (
                    <img
                      src={booking.company.logo}
                      alt={booking.company.name || "Company"}
                      className="w-12 h-12 rounded-md object-cover"
                    />
                  ) : (
                    <FaBuilding className="text-orange-400 w-12 h-12" />
                  )}
                  <div>
                    <h3 className="text-lg font-semibold">{booking.car.make}</h3>
                    {booking.company?.name ? (
                      <div className="text-sm text-gray-300">{booking.company.name}</div>
                    ) : booking.company?.id ? (
                      <div className="text-sm text-gray-400">Company information unavailable</div>
                    ) : null}
                  </div>
                </div>

                <div className={s.carTags}>
                  <span className={s.carTag}>{booking.car.category}</span>
                  <span className={s.carTag}>{booking.car.year}</span>
                  <span className={s.carTag}>{booking.car.seats} seats</span>
                  <span className={s.carTag}>{booking.car.transmission}</span>
                </div>

                <div className={s.infoGrid}>
                  <div>
                    <p className={s.infoLabel}>Fuel Type</p>
                    <p className={s.infoValue}>{booking.car.fuelType}</p>
                  </div>
                  <div>
                    <p className={s.infoLabel}>Mileage</p>
                    <p className={s.infoValue}>{booking.car.mileage}</p>
                  </div>
                  <div>
                    <p className={s.infoLabel}>Price per day</p>
                    <p className={s.infoValue}>{formatPrice(pricePerDay)}</p>
                  </div>
                  <div>
                    <p className={s.infoLabel}>Total Price</p>
                    <p className={s.priceValue}>{formatPrice(booking.price)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className={s.modalGrid}>
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <FaCalendarAlt className="text-orange-400" /> Booking Dates
                </h3>
                <div className={s.infoCard}>
                  <div className={s.infoRow}>
                    <p className={s.infoLabel}>Pickup Date:</p>
                    <p className={s.infoValue}>
                      {formatDate(booking.dates.pickup)}
                    </p>
                  </div>
                  <div className={s.infoRow}>
                    <p className={s.infoLabel}>Return Date:</p>
                    <p className={s.infoValue}>
                      {formatDate(booking.dates.return)}
                    </p>
                  </div>
                  <div className={`${s.infoRow} ${s.infoDivider}`}>
                    <p className={s.infoLabel}>Duration:</p>
                    <p className={s.infoValue}>{days} days</p>
                  </div>
                </div>

                <h3 className="text-lg font-semibold flex items-center gap-2 mt-6">
                  <FaMapMarkerAlt className="text-orange-400" /> Location Details
                </h3>
                <div className={s.infoCard}>
                  <p className={s.infoLabel}>Pickup Location:</p>
                  <p className={s.infoValue}>{booking.location}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2 mt-6">
                  <FaUser className="text-orange-400" /> User Information
                </h3>
                <div className={s.infoCard}>
                  <div className="mb-3">
                    <p className={s.infoLabel}>Full Name:</p>
                    <p className={s.infoValue}>{booking.user.name}</p>
                  </div>
                  <div className="mb-3">
                    <p className={s.infoLabel}>Email:</p>
                    <p className={s.infoValue}>{booking.user.email}</p>
                  </div>
                  <div className="mb-3">
                    <p className={s.infoLabel}>Phone:</p>
                    <p className={s.infoValue}>{booking.user.phone}</p>
                  </div>
                  <div>
                    <p className={s.infoLabel}>Address:</p>
                    <p className={s.infoValue}>{booking.user.address}</p>
                  </div>
                </div>

                <h3 className="text-lg font-semibold flex items-center gap-2 mt-6">
                  <FaBuilding className="text-orange-400" /> Company
                </h3>
                <div className={s.infoCard}>
                  <div className="mb-3">
                    <p className={s.infoLabel}>Company Name:</p>
                    <p className={s.infoValue}>{booking.company?.name || (booking.company?.id ? "Company information unavailable" : "—")}</p>
                  </div>
                  <div>
                    <p className={s.infoLabel}>Company Address:</p>
                    <p className={s.infoValue}>{booking.company?.address || (booking.company?.id ? "Company information unavailable" : "—")}</p>
                  </div>
                </div>

                <h3 className="text-lg font-semibold flex items-center gap-2 mt-6">
                  <FaCreditCard className="text-orange-400" /> Payment Details
                </h3>
                <div className={s.infoCard}>
                  <div className="mb-3">
                    <p className={s.infoLabel}>Payment Method:</p>
                    <p className={s.infoValue}>
                      {booking.paymentMethod || "—"}
                    </p>
                  </div>
                  <div>
                    <p className={s.infoLabel}>Transaction ID:</p>
                    <p className={s.infoValue}>
                      {booking.paymentId || booking.raw?.sessionId || "—"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className={s.infoCard}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className={s.infoLabel}>Booking Status:</p>
                  <StatusBadge status={booking.status} />
                </div>
                <div>
                  <p className={s.infoLabel}>Booking Date:</p>
                  <p className={s.infoValue}>{formatDate(booking.bookingDate)}</p>
                </div>
              </div>
            </div>

            <div className={s.modalActions}>
              <button type="button" onClick={onClose} className={s.closeButton}>
                Close
              </button>
              <Link to="/cars" onClick={onClose} className={s.modalBookButton}>
                Book Again <FaArrowRight className="text-sm" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ---------- Main page ----------
  const StatsCard = ({ value, label, color }) => (
    <div className={s.statsCard}>
      <div className={s.statsValue(color)}>{value}</div>
      <p className={s.statsLabel}>{label}</p>
    </div>
  );

  const MyBookings = () => {
    const [bookings, setBookings] = useState([]);
    const [filter, setFilter] = useState("all");
    const [loading, setLoading] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [error, setError] = useState(null);

    const [guestEmail, setGuestEmail] = useState("");
    const [guestBookingId, setGuestBookingId] = useState("");
    const [guestLoading, setGuestLoading] = useState(false);
    const [guestError, setGuestError] = useState("");

    const isMounted = useRef(true);
    useEffect(() => () => (isMounted.current = false), []);

    const fetchBookings = useCallback(async () => {
      setError(null);
      setLoading(true);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

      try {
        const responseData = await fetchMyBookings({ signal: controller.signal });

        const rawData = Array.isArray(responseData)
          ? responseData
          : responseData?.data ||
            responseData?.bookings ||
            responseData?.rows ||
            responseData ||
            [];

        let normalized = (Array.isArray(rawData) ? rawData : []).map(
          normalizeBooking
        );

        // Find bookings that only have a company id and no name, then batch fetch company metadata
        const idsToFetch = Array.from(
          new Set(
            normalized
              .map((b) => (b.company && b.company.id ? String(b.company.id) : null))
              .filter((id) => id && id.length > 5 && !normalized.find((nb) => nb.company.id === id && nb.company.name))
          )
        );

        if (idsToFetch.length > 0) {
          try {
            const res = await api.get("/api/companies", { params: { ids: idsToFetch.join(",") } });
            const companies = (res?.data?.companies) || [];
            const map = {};
            companies.forEach((c) => {
              map[String(c.id)] = {
                name: c.name || "",
                address: (c.address && (typeof c.address === "object" ? Object.values(c.address).filter(Boolean).join(", ") : c.address)) || "",
                logo: c.logo || "",
              };
            });

            normalized = normalized.map((b) => {
              const cid = b.company?.id;
              if (cid && map[cid]) {
                return {
                  ...b,
                  company: {
                    ...b.company,
                    name: map[cid].name || b.company.name,
                    address: map[cid].address || b.company.address,
                    logo: map[cid].logo || b.company.logo,
                  },
                };
              }
              return b;
            });
          } catch (err) {
            console.warn("Failed to fetch company metadata for bookings", err);
          }
        }

        if (!isMounted.current) return;
        setBookings(normalized);
        setLoading(false);
      } catch (err) {
        if (!isMounted.current) return;
        if (err?.response?.status === 401) {
          // Not logged in: allow guest mode (no blocking error)
          setError(null);
        } else if (err?.name === "CanceledError" || err?.message === "canceled") {
          setError("Request cancelled / timed out");
        } else {
          setError(
            err.response?.data?.message ||
              err.message ||
              "Failed to load bookings"
          );
        }
        setLoading(false);
      } finally {
        clearTimeout(timeoutId);
        if (isMounted.current) setLoading(false);
      }
    }, []);

    useEffect(() => {
      fetchBookings();
    }, [fetchBookings]);

    const handleGuestLookup = async (e) => {
      e.preventDefault();
      setGuestError("");
      if (!guestEmail && !guestBookingId) {
        setGuestError("Please enter email and/or booking ID");
        return;
      }
      try {
        setGuestLoading(true);
        const res = await serviceLookupBooking({
          email: guestEmail || undefined,
          bookingId: guestBookingId || undefined,
        });
        const raw = Array.isArray(res?.data) ? res.data : [];
        const mapped = raw.map((b) => normalizeBooking(b));
        setBookings(mapped);
        if (mapped.length === 0) {
          setGuestError("No bookings found for that email/booking ID");
        }
        setFilter("all");
      } catch (err) {
        console.error("Guest lookup failed:", err);
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          "Lookup failed. Please try again.";
        setGuestError(msg);
      } finally {
        setGuestLoading(false);
      }
    };

    const handleClearLookup = () => {
      setGuestEmail("");
      setGuestBookingId("");
      setGuestError("");
    };

    const cancelBooking = useCallback(
      async (bookingId) => {
        if (!window.confirm("Are you sure you want to cancel this booking?"))
          return;
        try {
          const responseData = await serviceCancelBooking(bookingId);
          const updated = normalizeBooking(
            responseData ||
              responseData?.data || { _id: bookingId, status: "cancelled" }
          );
          setBookings((prev) =>
            prev.map((b) => (b.id === bookingId ? updated : b))
          );
          if (selectedBooking?.id === bookingId) setSelectedBooking(updated);
        } catch (err) {
          alert(
            err.response?.data?.message ||
              err.message ||
              "Failed to cancel booking"
          );
        }
      },
      [selectedBooking]
    );

    const filteredBookings = useMemo(
      () =>
        filter === "all" ? bookings : bookings.filter((b) => b.status === filter),
      [bookings, filter]
    );

    const filterButtons = [
      { key: "all", label: "All Bookings", icon: <FaFilter /> },
      { key: "upcoming", label: "Upcoming", icon: <FaClock /> },
      { key: "completed", label: "Completed", icon: <FaCheckCircle /> },
      { key: "cancelled", label: "Cancelled", icon: <FaTimes /> },
    ];

    const openDetails = (b) => {
      setSelectedBooking(b);
      setShowModal(true);
    };
    const closeModal = () => {
      setSelectedBooking(null);
      setShowModal(false);
    };

    return (
      <div className={s.pageContainer}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h1 className={s.title}>My Bookings</h1>
            <p className={s.subtitle}>
              View and manage all your current and past car rental bookings
            </p>
          </div>

          {/* Guest lookup */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 md:p-6 mb-8">
            <div className="flex items-center gap-2 text-orange-300 font-semibold mb-3">
              <FaSearch /> <span>Find your booking</span>
            </div>
            <form className="grid md:grid-cols-3 gap-3" onSubmit={handleGuestLookup}>
              <div>
                <label className="text-xs text-gray-400">Email used during booking</label>
                <input
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  className="w-full mt-1 p-2 rounded bg-gray-800 text-white border border-gray-700"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Booking ID (optional)</label>
                <input
                  value={guestBookingId}
                  onChange={(e) => setGuestBookingId(e.target.value)}
                  className="w-full mt-1 p-2 rounded bg-gray-800 text-white border border-gray-700"
                  placeholder="Paste Booking ID"
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  type="submit"
                  disabled={guestLoading}
                  className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold py-2.5 rounded-lg shadow"
                >
                  {guestLoading ? "Searching..." : "Search"}
                </button>
                <button
                  type="button"
                  onClick={handleClearLookup}
                  className="px-3 py-2 rounded-lg border border-gray-700 text-gray-200 bg-gray-800 hover:bg-gray-750"
                >
                  Clear
                </button>
              </div>
            </form>
            {guestError ? (
              <p className="text-red-400 text-sm mt-2">{guestError}</p>
            ) : null}
            <p className="text-gray-500 text-xs mt-2">
              Enter your booking email, and optionally the Booking ID from your confirmation. We’ll fetch matching bookings.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {filterButtons.map((btn) => (
              <FilterButton
                key={btn.key}
                filterKey={btn.key}
                currentFilter={filter}
                icon={btn.icon}
                label={btn.label}
                onClick={setFilter}
              />
            ))}
          </div>

          {loading && (
            <div className="flex justify-center items-center py-20">
              <div className={s.loadingSpinner} />
            </div>
          )}

          {!loading && error && (
            <div className={s.errorContainer}>
              <p className={s.errorText}>{error}</p>
              <button
                type="button"
                onClick={fetchBookings}
                className={s.retryButton}
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && filteredBookings.length === 0 && (
            <div className={s.emptyState}>
              <div className={s.emptyIconContainer}>
                <FaCar className={s.emptyIcon} />
              </div>
              <h3 className={s.emptyTitle}>No bookings found</h3>
              <p className={s.emptyText}>
                {filter === "all"
                  ? "Use the search above to find your booking by email or Booking ID."
                  : `You don't have any ${filter} bookings.`}
              </p>
              <Link to="/cars" className={s.browseButton}>
                <FaCar /> Browse Cars
              </Link>
            </div>
          )}

          {!loading && !error && filteredBookings.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBookings.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  onViewDetails={openDetails}
                />
              ))}
            </div>
          )}

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatsCard
              value={bookings.length}
              label="Total Bookings"
              color="text-orange-400"
            />
            <StatsCard
              value={bookings.filter((b) => b.status === "completed").length}
              label="Completed Trips"
              color="text-green-400"
            />
            <StatsCard
              value={bookings.filter((b) => b.status === "upcoming").length}
              label="Upcoming Trips"
              color="text-blue-400"
            />
          </div>
        </div>

        {showModal && selectedBooking && (
          <BookingModal
            booking={selectedBooking}
            onClose={closeModal}
            onCancel={cancelBooking}
          />
        )}
      </div>
    );
  };

  export default MyBookings;