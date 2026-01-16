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
} from "react-icons/fa";
import { myBookingsStyles as s } from "../assets/dummyStyles.js";
import { fetchMyBookings, cancelBooking as serviceCancelBooking } from "../services/bookingService.js";

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

/**
 * Build a readable address string from various address shapes.
 */
const buildCompanyAddress = (company) => {
  if (!company) return "";
  const addr = company.address || company || {};
  // Try multiple possible field names
  const street = addr.street || addr.address_street || addr.addressLine1 || "";
  const city = addr.city || addr.address_city || addr.town || "";
  const state = addr.state || addr.address_state || addr.region || "";
  const zip = addr.zipCode || addr.postal_code || addr.address_zipCode || "";
  const country = addr.country || addr.address_country || "";
  return [street, city, state, zip, country].filter(Boolean).join(", ");
};

/**
 * Resolve a company object from many possible locations/shapes within a booking payload.
 * Returns { id, name, address, logo } or null.
 *
 * This function now also attempts to recover a usable name/address from snapshot fields
 * (booking.car.companyName, booking.raw.*) so the UI doesn't show raw ObjectId strings.
 */
const resolveCompanyFromBooking = (booking, carSnapshot = {}) => {
  if (!booking && !carSnapshot) return null;

  const normalize = (c) => {
    if (!c) return null;
    if (typeof c === "string") {
      // If it looks like an ObjectId, treat as id; otherwise treat as name
      const isId = /^[0-9a-fA-F]{8,}$/.test(c);
      if (isId) return { id: c };
      return { name: c };
    }
    // object shape
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

  // 1) booking.company
  const bCompany = safeAccess(() => booking.company, null);
  const n1 = normalize(bCompany);
  if (n1 && (n1.name || n1.address || n1.logo || n1.id)) return n1;

  // 2) booking.companyName or booking.company_name
  const bCompanyName =
    safeAccess(() => booking.companyName, null) ||
    safeAccess(() => booking.company_name, null);
  if (bCompanyName) return normalize(bCompanyName);

  // 3) booking.raw?.company or booking.raw?.companyName
  const rawCompany = safeAccess(() => booking.raw?.company, null);
  const n3 = normalize(rawCompany);
  if (n3 && (n3.name || n3.address || n3.logo || n3.id)) return n3;

  const rawCompanyName = safeAccess(() => booking.raw?.companyName, null);
  if (rawCompanyName) return normalize(rawCompanyName);

  // 4) carSnapshot.company or booking.car.company or booking.raw?.car?.company
  const carCompany =
    safeAccess(() => carSnapshot.company, null) ||
    safeAccess(() => booking.car?.company, null) ||
    safeAccess(() => booking.raw?.car?.company, null) ||
    null;
  const n4 = normalize(carCompany);
  if (n4 && (n4.name || n4.address || n4.logo || n4.id)) return n4;

  // 5) fallback: sometimes the canonical company name is stored on the car snapshot as companyName
  const snapshotCompanyName =
    safeAccess(() => carSnapshot.companyName, null) ||
    safeAccess(() => booking.car?.companyName, null) ||
    safeAccess(() => booking.raw?.car?.companyName, null) ||
    safeAccess(() => booking.raw?.companyName, null);
  if (snapshotCompanyName) return normalize(snapshotCompanyName);

  // 6) company id fields (no metadata)
  const companyId =
    safeAccess(() => booking.companyId, null) ||
    safeAccess(() => booking.company_id, null) ||
    safeAccess(() => booking.raw?.companyId, null) ||
    safeAccess(() => booking.car?.companyId, null) ||
    safeAccess(() => carSnapshot.companyId, null) ||
    null;
  if (companyId) {
    // try to get a friendly name from other fields before exposing id
    const fallbackName =
      safeAccess(() => booking.car?.companyName, null) ||
      safeAccess(() => booking.raw?.car?.companyName, null) ||
      safeAccess(() => booking.raw?.company?.name, null) ||
      null;
    if (fallbackName) return { id: companyId, name: fallbackName };
    // we will return id but caller will hide raw id if no name available
    return { id: companyId };
  }

  // no company found
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
    // fallback to raw.car
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

  // Resolve company using robust helper; pass car snapshot for additional info
  const companyObj = resolveCompanyFromBooking(booking, carObj);

  // If companyObj exists but only contains id, try a few more fallbacks for name/address
  let resolvedCompany = { name: "", address: "", logo: "", id: "" };
  if (companyObj) {
    resolvedCompany.id = companyObj.id || "";
    resolvedCompany.name = companyObj.name || "";
    resolvedCompany.address = companyObj.address || "";
    resolvedCompany.logo = companyObj.logo || "";
  }

  // Additional fallback: car snapshot companyName or company address fields
  if (!resolvedCompany.name) {
    resolvedCompany.name =
      safeAccess(() => carObj.companyName, "") ||
      safeAccess(() => booking.raw?.car?.companyName, "") ||
      safeAccess(() => booking.raw?.companyName, "") ||
      "";
  }
  if (!resolvedCompany.address) {
    // possible fields on carObj or booking.raw
    resolvedCompany.address =
      safeAccess(() => carObj.companyAddress, "") ||
      safeAccess(() => booking.raw?.company?.address, "") ||
      safeAccess(() => booking.raw?.companyAddress, "") ||
      "";
  }

  // If still no name and only id present, hide raw id and show unavailable label
  if (!resolvedCompany.name && resolvedCompany.id) {
    resolvedCompany.name = ""; // keep empty so UI displays friendly fallback
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

  // derive completed/upcoming from return date
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

// ---------- Small presentational components ----------
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
        {/* optional company logo badge */}
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

            {/* Company line */}
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

      const normalized = (Array.isArray(rawData) ? rawData : []).map(
        normalizeBooking
      );

      if (!isMounted.current) return;
      setBookings(normalized);
      setLoading(false);
    } catch (err) {
      if (!isMounted.current) return;
      if (err?.name === "CanceledError" || err?.message === "canceled") {
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
                ? "You haven't made any bookings yet. Browse our collection to get started!"
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