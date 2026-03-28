import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import {
  FaUserFriends,
  FaGasPump,
  FaTachometerAlt,
  FaCheckCircle,
  FaCalendarAlt,
  FaPhone,
  FaEnvelope,
  FaUser,
  FaArrowLeft,
  FaCreditCard,
  FaMapMarkerAlt,
  FaCity,
  FaGlobeAsia,
  FaMapPin,
  FaBuilding,
  FaPassport,
  FaShieldAlt,
  FaInfoCircle,
  FaImage,
  FaComments,
  FaPaperPlane,
  FaTimes,
  FaFileContract
} from "react-icons/fa";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import api from "../utils/api";
import * as authService from "../utils/authService";
import carsData from "../assets/carsData.js";
import { carDetailStyles } from "../assets/dummyStyles.js";
import { createXenditInvoice, markPaymentFailed } from "../services/paymentService";
import io from "socket.io-client";
import { LoadScript, StandaloneSearchBox } from "@react-google-maps/api";
import { DateRange } from "react-date-range";
import { addDays, eachDayOfInterval, format } from "date-fns";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import "../styles/calendar-overrides.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:7889";
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:7889` : "http://localhost:7889");
const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

const todayISO = () => format(new Date(), "yyyy-MM-dd");
const formatISODate = (d) => format(d, "yyyy-MM-dd");

// Normalize any date value to midnight local time (00:00:00.000).
// react-date-range internally creates its calendar Date objects at midnight,
// so every entry in disabledDates MUST also be at midnight for the grey-out
// comparison to succeed.
const toLocalMidnight = (value) => {
  if (!value) return null;
  const datePart = String(value).split("T")[0];
  if (!datePart) return null;
  const [y, m, d] = datePart.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d, 0, 0, 0, 0);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

// Build an inclusive list of days for a booking (start through end)
const bookingDaysInclusive = (pickupIso, returnIso) => {
  const start = toLocalMidnight(pickupIso);
  const end = toLocalMidnight(returnIso);
  if (!start || !end) return [];
  return eachDayOfInterval({ start, end });
};

const calculateDays = (from, to) => {
  if (!from || !to) return 1;
  const days = Math.ceil((new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24));
  return Math.max(1, days);
};

const insuranceOptions = [
  { value: "full_excess", label: "Full Excess", feePerDay: 0, info: "You keep the standard excess; no extra daily fee." },
  { value: "half_excess", label: "Half Excess", feePerDay: 15, info: "Reduce your excess liability by half for a small daily fee." },
  { value: "no_excess", label: "No Excess (Incl. 24h cancellation)", feePerDay: 30, info: "Zero excess plus 24-hour cancellation coverage for peace of mind." }
];

const countryOptions = [
  "Malaysia","Singapore","Thailand","Indonesia","Brunei","Philippines","Vietnam","Japan","South Korea","China","India",
  "Australia","New Zealand","United Kingdom","United States","Canada","Germany","France","Netherlands","United Arab Emirates","Saudi Arabia"
];

const buildImageSrc = (image) => {
  if (!image) return `${API_BASE}/uploads/default-car.png`;
  if (Array.isArray(image)) image = image[0];
  if (!image || typeof image !== "string") return `${API_BASE}/uploads/default-car.png`;
  const t = image.trim();
  if (!t) return `${API_BASE}/uploads/default-car.png`;
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  if (t.startsWith("/")) return `${API_BASE}${t}`;
  return `${API_BASE}/uploads/${t}`;
};

const handleImageError = (e, fallback = `${API_BASE}/uploads/default-car.png`) => {
  const img = e?.target;
  if (!img) return;
  img.onerror = null;
  img.src = fallback;
  img.onerror = () => {
    img.onerror = null;
    img.src = "https://via.placeholder.com/800x500.png?text=No+Image";
  };
  img.alt = img.alt || "Image not available";
  img.style.objectFit = img.style.objectFit || "cover";
};

const BLOCKING_STATUSES = ["pending", "active", "upcoming"];

const CarDetail = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [car, setCar] = useState(() => location.state?.car || null);
  const [loadingCar, setLoadingCar] = useState(false);
  const [carError, setCarError] = useState("");
  const [currentImage, setCurrentImage] = useState(0);

  const initialPickup = location.state?.pickupDate || "";
  const initialReturn = location.state?.returnDate || "";

  const currentUser = authService.getCurrentUser();
  const emailPrefill = currentUser?.email || "";

  const currentUserId = currentUser?.id || currentUser?._id || null;

  const [userKycApproved, setUserKycApproved] = useState(false);
  const [kycCheckDone, setKycCheckDone] = useState(false);

  useEffect(() => {
    if (!currentUserId) {
      setKycCheckDone(true);
      return;
    }
    let cancelled = false;

    const checkKyc = async () => {
      const endpoints = ['/api/user/me', '/api/auth/me'];
      for (const endpoint of endpoints) {
        try {
          const res = await api.get(endpoint);
          if (cancelled) return;
          const userData = res.data?.user || res.data;
          if (userData?.kyc?.status === 'approved') {
            setUserKycApproved(true);
          }
          setKycCheckDone(true);
          return;
        } catch (err) {
          if (err?.response?.status !== 404) {
            if (!cancelled) setKycCheckDone(true);
            return;
          }
        }
      }
      if (!cancelled) setKycCheckDone(true);
    };

    checkKyc();
    return () => { cancelled = true; };
  }, [currentUserId]);

  const [formData, setFormData] = useState({
    pickupDate: initialPickup,
    returnDate: initialReturn,
    pickupLocation: "",
    name: currentUser?.legalName || currentUser?.name || "",
    email: emailPrefill,
    phone: currentUser?.phone || "",
    city: currentUser?.city || "",
    state: currentUser?.state || "", 
    zipCode: currentUser?.zipCode || "", 
    idType: "passport",
    idNumber: "",
    idCountry: currentUser?.country || "Malaysia",
    insurancePlan: "no_excess",
  });

  const [locationQuery, setLocationQuery] = useState("");
  const searchBoxRef = useRef(null);
  const bookingFormRef = useRef(null);

  const [range, setRange] = useState([
    {
      startDate: initialPickup ? new Date(initialPickup) : new Date(),
      endDate: initialReturn ? new Date(initialReturn) : addDays(new Date(), 1),
      key: "selection",
    },
  ]);
  const [disabledDates, setDisabledDates] = useState([]);
  // FIX 5: Track which disabled dates are service blocks vs bookings
  const [serviceBlockedDates, setServiceBlockedDates] = useState(new Set());

  const [frontFile, setFrontFile] = useState(null);
  const [backFile, setBackFile] = useState(null);

  const getFlexPricing = () => car?.flexiblePricing || {
    baseDailyRate: Number(car?.dailyRate) || 0,
    baseDeposit: Number(car?.deposit) || 500,
    weekendMultiplier: 1,
    depositWeekendMultiplier: 1,
    peakMultipliers: [],
  };
  const emailReadOnly = !!emailPrefill;

  const [activeField, setActiveField] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const fetchControllerRef = useRef(null);
  const submitControllerRef = useRef(null);
  const [today, setToday] = useState(todayISO());

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [socket, setSocket] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messagingError, setMessagingError] = useState("");

  const [termsOpen, setTermsOpen] = useState(false);
  const [termsLoading, setTermsLoading] = useState(false);
  const [termsError, setTermsError] = useState("");
  const [termsText, setTermsText] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  useEffect(() => setToday(todayISO()), []);

  useEffect(() => {
    // Always reset carousel index when car or id changes
    setCurrentImage(0);

    // If car is already available from route state, we still need fresh data
    // for serviceBlocks — that is handled by the availability useEffect below.
    // But we don't need to re-fetch the full car object if we already have it.
    if (car) {
      // Even though we have car from route state, we must fetch fresh data
      // to ensure serviceBlocks are present (route state may strip them).
      const controller = new AbortController();
      (async () => {
        try {
          const res = await api.get(`/api/cars/${id}`, { signal: controller.signal });
          const payload = res.data?.data ?? res.data ?? null;
          if (payload) {
            setCar((prev) => ({
              ...prev,
              ...payload,
              serviceBlocks: payload.serviceBlocks || prev?.serviceBlocks || [],
            }));
          }
        } catch (err) {
          const canceled = err?.code === "ERR_CANCELED" || err?.name === "CanceledError" || err?.message === "canceled";
          if (!canceled) {
            console.warn("Failed to refresh car data for serviceBlocks:", err);
          }
        }
      })();
      return () => {
        try { controller.abort(); } catch {}
      };
    }

    const local = carsData.find((c) => String(c.id) === String(id));
    if (local) {
      setCar(local);
      return;
    }

    const controller = new AbortController();
    fetchControllerRef.current = controller;
    (async () => {
      setLoadingCar(true);
      setCarError("");
      try {
        const res = await api.get(`/api/cars/${id}`, { signal: controller.signal });
        const payload = res.data?.data ?? res.data ?? null;
        if (payload) setCar(payload);
        else setCarError("Car not found.");
      } catch (err) {
        const canceled = err?.code === "ERR_CANCELED" || err?.name === "CanceledError" || err?.message === "canceled";
        if (!canceled) {
          console.error("Failed to fetch car:", err);
          setCarError(err?.response?.data?.message || err.message || "Failed to load car");
        }
      } finally {
        setLoadingCar(false);
      }
    })();

    return () => {
      try { controller.abort(); } catch {}
      fetchControllerRef.current = null;
    };
  }, [id]);

  // Load availability and build disabled dates for the date-range picker (inclusive of return day)
  // Also fetch car.serviceBlocks and track them separately for visual distinction.
  // Fetch bookings and car data independently so a failure in one doesn't prevent
  // the other from loading. Service-blocked dates must always appear on the calendar.
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    (async () => {
      const disabled = [];
      const serviceDatesSet = new Set();

      // Fetch bookings (independent — failure should not block service dates)
      try {
        const bookingsRes = await api.get("/api/bookings", {
          params: { car: id, limit: 200 },
          signal: controller.signal,
        });
        const bookings = bookingsRes.data?.data || [];
        bookings
          .filter((b) => BLOCKING_STATUSES.includes(b.status))
          .forEach((b) => {
            disabled.push(...bookingDaysInclusive(b.pickupDate, b.returnDate));
          });
      } catch (err) {
        const canceled = err?.code === "ERR_CANCELED" || err?.name === "CanceledError" || err?.message === "canceled";
        if (!canceled) console.warn("Failed to load bookings for availability", err);
        if (canceled) return; // component unmounted, stop processing
      }

      // Fetch car data for serviceBlocks (independent — failure should not block bookings)
      let fetchedServiceBlocks = null;
      try {
        const carRes = await api.get(`/api/cars/${id}`, { signal: controller.signal });
        const carData = carRes.data?.data ?? carRes.data ?? null;

        // Update the car state with fresh data so serviceBlocks are always up-to-date
        if (carData) {
          setCar((prev) => {
            if (!prev) return carData;
            return { ...prev, serviceBlocks: carData.serviceBlocks || prev.serviceBlocks };
          });
          fetchedServiceBlocks = carData.serviceBlocks || [];
        }
      } catch (err) {
        const canceled = err?.code === "ERR_CANCELED" || err?.name === "CanceledError" || err?.message === "canceled";
        if (!canceled) console.warn("Failed to load car service blocks", err);
        if (canceled) return; // component unmounted, stop processing
      }

      // Use fetched service blocks, or fall back to whatever is on the car state
      const serviceBlocksToUse = fetchedServiceBlocks || car?.serviceBlocks || [];

      if (serviceBlocksToUse.length) {
        serviceBlocksToUse.forEach((d) => {
          const parsed = toLocalMidnight(d);
          if (parsed) {
            disabled.push(parsed);
            serviceDatesSet.add(format(parsed, "yyyy-MM-dd"));
          }
        });
      }

      // Deduplicate AND normalize every disabled date to midnight local time.
      // react-date-range creates its calendar Date objects at 00:00:00 local time
      // and compares against disabledDates — if our entries are at any other hour,
      // the match fails silently and the date appears white/enabled instead of grey.
      const deduped = Array.from(
        new Map(disabled.map((d) => {
          const normalized = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
          return [normalized.toDateString(), normalized];
        })).values()
      );
      setDisabledDates(deduped);
      setServiceBlockedDates(serviceDatesSet);
    })();
    return () => {
      try { controller.abort(); } catch {}
    };
  }, [id]);

  const carId = car?._id || car?.id || null;

  useEffect(() => {
    if (currentUserId && carId) {
      const newSocket = io(SOCKET_URL, {
        transports: ["websocket", "polling"],
        withCredentials: true,
      });
      setSocket(newSocket);
      newSocket.on("connect_error", (err) => {
        console.error("Socket connection error:", err);
        setMessagingError("Failed to connect to messaging server");
      });

      newSocket.emit("joinUserRoom", currentUserId);
      newSocket.on("privateMessage", (data) => {
        setMessages((prev) => [...prev, data]);
      });

      api
        .get(`/api/messages/car/${carId}`)
        .then((res) => {
          setMessages(res.data || []);
        })
        .catch(() => {
          setMessagingError("Failed to load message history");
        });

      return () => {
        newSocket.disconnect();
      };
    }
  }, [currentUserId, carId]);

  const sendMessage = () => {
    if (!socket?.connected) {
      setMessagingError("Messaging not connected");
      return;
    }
    if (!newMessage.trim()) {
      setMessagingError("Message cannot be empty");
      return;
    }
    const hostId = car?.company?.id;
    if (!hostId) {
      setMessagingError("Cannot find host ID. Check car data.");
      return;
    }
    const msgData = {
      toUserId: hostId,
      fromUserId: currentUserId,
      carId: carId,
      message: newMessage.trim(),
    };
    api
      .post("/api/messages", msgData)
      .then(() => {
        socket.emit("privateMessage", msgData);
        setNewMessage("");
        setMessagingError("");
      })
      .catch(() => {
        setMessagingError("Failed to send message");
      });
  };

  const openTerms = async () => {
    setTermsOpen(true);
    if (termsText || termsLoading) return;
    setTermsLoading(true);
    setTermsError("");
    try {
      const res = await api.get("/api/admin/public/legal/terms");
      setTermsText(res.data?.terms || "Terms & Conditions are not available at the moment.");
    } catch (err) {
      console.error(err);
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        setTermsError("Terms are unavailable. Please try again later.");
      } else {
        setTermsError("Failed to load Terms & Conditions.");
      }
    } finally {
      setTermsLoading(false);
    }
  };
  const closeTerms = () => setTermsOpen(false);

  const onRangeChange = (ranges) => {
    const sel = ranges.selection;

    // Validate that the selected range does not span across any disabled/service-blocked date
    const rangeStart = sel.startDate;
    const rangeEnd = sel.endDate;

    // FIX: Explicitly reject if the start date or end date itself is a service-blocked date.
    // The react-date-range disabledDates prop greys out dates visually but does NOT
    // prevent them from being clicked as a range anchor in all versions. This guard
    // catches the case where a user clicks directly on a maintenance-blocked date.
    if (rangeStart) {
      const startIso = format(rangeStart, "yyyy-MM-dd");
      if (serviceBlockedDates.has(startIso)) {
        toast.error(
          `${startIso} is blocked for maintenance. Please choose a different start date.`
        );
        return;
      }
    }
    if (rangeEnd) {
      const endIso = format(rangeEnd, "yyyy-MM-dd");
      if (serviceBlockedDates.has(endIso)) {
        toast.error(
          `${endIso} is blocked for maintenance. Please choose a different end date.`
        );
        return;
      }
    }

    // Also reject if start or end lands on a booking-disabled date
    if (rangeStart) {
      const disabledSet = new Set(disabledDates.map((d) => d.toDateString()));
      if (disabledSet.has(rangeStart.toDateString()) && !serviceBlockedDates.has(format(rangeStart, "yyyy-MM-dd"))) {
        toast.error("Your selected start date is already booked. Please choose an available date.");
        return;
      }
    }
    if (rangeEnd) {
      const disabledSet = new Set(disabledDates.map((d) => d.toDateString()));
      if (disabledSet.has(rangeEnd.toDateString()) && !serviceBlockedDates.has(format(rangeEnd, "yyyy-MM-dd"))) {
        toast.error("Your selected end date is already booked. Please choose an available date.");
        return;
      }
    }

    if (rangeStart && rangeEnd && rangeEnd >= rangeStart) {
      const daysInRange = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
      const blockedInRange = daysInRange.filter((d) => {
        const iso = format(d, "yyyy-MM-dd");
        return serviceBlockedDates.has(iso);
      });
      if (blockedInRange.length > 0) {
        const blockedStr = blockedInRange.map((d) => format(d, "yyyy-MM-dd")).join(", ");
        toast.error(
          `Your selected range includes maintenance-blocked date(s): ${blockedStr}. Please choose dates that do not overlap with blocked dates.`
        );
        return; // reject the range change
      }

      // Also check against general disabledDates (bookings)
      const disabledSet = new Set(disabledDates.map((d) => d.toDateString()));
      const bookingBlockedInRange = daysInRange.filter(
        (d) => disabledSet.has(d.toDateString()) && !serviceBlockedDates.has(format(d, "yyyy-MM-dd"))
      );
      if (bookingBlockedInRange.length > 0) {
        toast.error(
          "Your selected range includes dates that are already booked. Please choose available dates."
        );
        return; // reject the range change
      }
    }

    setRange([sel]);
    setFormData((f) => ({
      ...f,
      pickupDate: formatISODate(sel.startDate),
      returnDate: formatISODate(sel.endDate),
    }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((f) => ({ ...f, [name]: value }));
  };

  const handlePlaceChanged = () => {
    if (!searchBoxRef.current) return;
    const places = searchBoxRef.current.getPlaces();
    if (!places || places.length === 0) return;
    const place = places[0];
    setLocationQuery(place.formatted_address || place.name || "");

    const comps = place.address_components || [];
    let city = "";
    let state = "";
    let zip = "";
    comps.forEach((c) => {
      if (c.types.includes("locality") || c.types.includes("administrative_area_level_2")) city = c.long_name;
      if (c.types.includes("administrative_area_level_1")) state = c.long_name;
      if (c.types.includes("postal_code")) zip = c.long_name;
    });
    setFormData((f) => ({
      ...f,
      city: city || f.city,
      state: state || f.state,
      zipCode: zip || f.zipCode,
    }));
  };

  if (!car && loadingCar) return <div className="p-6 text-white">Loading car...</div>;
  if (!car && carError) return <div className="p-6 text-red-400">{carError}</div>;
  if (!car) return <div className="p-6 text-white">Car not found.</div>;

  const carImages = [
    ...(Array.isArray(car.images) ? car.images : []),
    ...(car.image ? (Array.isArray(car.image) ? car.image : [car.image]) : []),
  ].filter(Boolean);

  // NEW — flexible pricing aware:
const fp = getFlexPricing();
const days = calculateDays(formData.pickupDate, formData.returnDate);

// Compute per-day rates using flexible pricing
const computeDayRate = (dateStr) => {
  const baseRate = Number(fp.baseDailyRate) || Number(car?.dailyRate) || 0;
  const weekendMul = Number(fp.weekendMultiplier) || 1;
  const peakMultipliers = Array.isArray(fp.peakMultipliers) ? fp.peakMultipliers : [];

  let mul = 1;
  const d = new Date(dateStr);
  const dayOfWeek = d.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) mul = weekendMul;

  for (const peak of peakMultipliers) {
    if (peak.start && peak.end && dateStr >= peak.start && dateStr <= peak.end) {
      mul = Math.max(mul, Number(peak.multiplier) || 1);
    }
  }
  return Math.round(baseRate * mul * 100) / 100;
};

const computeDepositMultiplier = () => {
  const depWeekendMul = Number(fp.depositWeekendMultiplier) || 1;
  const peakMultipliers = Array.isArray(fp.peakMultipliers) ? fp.peakMultipliers : [];
  let maxMul = 1;

  if (formData.pickupDate && formData.returnDate) {
    const start = new Date(formData.pickupDate);
    for (let i = 0; i < days; i++) {
      const cur = new Date(start);
      cur.setDate(cur.getDate() + i);
      const isoStr = cur.toISOString().slice(0, 10);
      const dayOfWeek = cur.getDay();
      let mul = 1;
      if (dayOfWeek === 0 || dayOfWeek === 6) mul = depWeekendMul;
      for (const peak of peakMultipliers) {
        if (peak.start && peak.end && isoStr >= peak.start && isoStr <= peak.end) {
          mul = Math.max(mul, Number(peak.depositMultiplier) || 1);
        }
      }
      maxMul = Math.max(maxMul, mul);
    }
  }
  return maxMul;
};

const computeTotalRent = () => {
  if (!formData.pickupDate || !formData.returnDate) {
    return Number(fp.baseDailyRate) || Number(car?.dailyRate) || 0;
  }
  let total = 0;
  const start = new Date(formData.pickupDate);
  for (let i = 0; i < days; i++) {
    const cur = new Date(start);
    cur.setDate(cur.getDate() + i);
    total += computeDayRate(cur.toISOString().slice(0, 10));
  }
  return Math.round(total * 100) / 100;
};

const price = Number(fp.baseDailyRate) || Number(car?.dailyRate) || 0; // base price for display
const deposit = Math.round((Number(fp.baseDeposit) || Number(car?.deposit) || 500) * computeDepositMultiplier() * 100) / 100;

const selectedPlan = insuranceOptions.find((p) => p.value === formData.insurancePlan) || insuranceOptions[2];
const insuranceCost = days * (selectedPlan.feePerDay || 0);
const calculateTotal = () => computeTotalRent() + insuranceCost;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!acceptTerms) {
      toast.error("Please accept the Terms & Conditions to proceed.");
      return;
    }
    if (!formData.pickupDate || !formData.returnDate) {
      toast.error("Please select pickup and return dates.");
      return;
    }
    if (new Date(formData.returnDate) < new Date(formData.pickupDate)) {
      toast.error("Return date must be the same or after pickup date.");
      return;
    }
    if (!formData.email) {
      toast.error("Please provide an email address.");
      return;
    }
    if (!formData.phone) {
      toast.error("Please provide a phone number.");
      return;
    }

    if (!userKycApproved) {
      if (!formData.idCountry) {
        toast.error("Please provide your ID issuing country.");
        return;
      }
      if (!frontFile || !backFile) {
        toast.error("Please upload front and back ID images.");
        return;
      }
    }

    setSubmitting(true);
    if (submitControllerRef.current) {
      try { submitControllerRef.current.abort(); } catch {}
    }
    const controller = new AbortController();
    submitControllerRef.current = controller;

    try {
      const user = await authService.ensureAuth();
      const emailToUse = user?.email || formData.email;

      const paymentBreakdown = {
        rent: days * price,
        insurance: insuranceCost,
        insurancePlan: formData.insurancePlan,
        deposit
      };

      const countryCode = formData.idCountry === "Malaysia"
        ? "MY"
        : (formData.idCountry || "MY").slice(0, 2).toUpperCase();

      const form = new FormData();
      if (user?.id) form.append("userId", user.id);
      form.append("customer", formData.name || user?.name || "Guest");
      form.append("email", emailToUse);
      form.append("phone", formData.phone);
      form.append("pickupDate", formData.pickupDate);
      form.append("returnDate", formData.returnDate);
      form.append("amount", calculateTotal());
      form.append("currency", "MYR");
      form.append("paymentBreakdown", JSON.stringify(paymentBreakdown));
      form.append("details", JSON.stringify({ pickupLocation: formData.pickupLocation }));
      form.append("address", JSON.stringify({
        city: formData.city,
        state: formData.state,
        zipCode: formData.zipCode,
      }));
      form.append("car", JSON.stringify({
        id: car._id ?? car.id ?? null,
        make: car.make,
        model: car.model,
        year: car.year,
        dailyRate: computeTotalRent() / days,
        image: car.image,
        companyId: car.companyId || car.company?.id || null,
        companyName: car.company?.name || car.companyName || "",
      }));

      if (userKycApproved) {
        form.append("kycFromProfile", "true");
      } else {
        form.append("kyc[idType]", formData.idType === "other" ? "passport" : formData.idType);
        form.append("kyc[idNumber]", formData.idNumber || "provided_at_pickup");
        form.append("kyc[idCountry]", countryCode);
        form.append("kycFront", frontFile);
        form.append("kycBack", backFile);

        // Marketing consent — send to backend for storage
        form.append("marketingConsent", marketingConsent ? "true" : "false");
      }

      const res = await createXenditInvoice(form);

      if (!res?.invoiceUrl || !res?.bookingId) {
        toast.error("Failed to initiate payment. Please try again.");
        return;
      }

      sessionStorage.setItem("pendingBookingId", res.bookingId);

      toast.info("Redirecting to payment page...", { autoClose: 1500 });
      setTimeout(() => {
        window.location.href = res.invoiceUrl;
      }, 500);

    } catch (err) {
      const canceled = err?.code === "ERR_CANCELED" || err?.name === "CanceledError" || err?.message === "canceled";
      if (canceled) return;
      console.error("Booking error:", err);
      const serverMessage =
        err?.response?.data?.message ||
        err?.response?.data ||
        err.message ||
        "Booking failed";
      toast.error(String(serverMessage));
    } finally {
      setSubmitting(false);
    }
  };

  const transmissionLabel = car.transmission ? String(car.transmission).toLowerCase() : "standard";
  const companyName = car.companyId?.hostProfile?.companyName || car.companyId?.name || car.companyName || "Unknown Company";
  const companyAddress = (() => {
    const addr = car.company?.address || {};
    const parts = [];
    if (addr.street) parts.push(addr.street);
    if (addr.city) parts.push(addr.city);
    if (addr.state) parts.push(addr.state);
    if (addr.zipCode) parts.push(addr.zipCode);
    if (addr.country) parts.push(addr.country);
    return parts.filter(Boolean).join(", ");
  })();

  const scrollToBookingForm = () => {
    bookingFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className={carDetailStyles.pageContainer}>
      <div className={carDetailStyles.contentContainer}>
        <ToastContainer />
        <button onClick={() => navigate(-1)} className={carDetailStyles.backButton}>
          <FaArrowLeft className={carDetailStyles.backButtonIcon} />
        </button>

                {/* ═══════════════════════════════════════════════════════════════
            SECTION 1: Single column — no more suffocating 2-col layout
            ═══════════════════════════════════════════════════════════════ */}
        <div className="pt-12 max-w-4xl mx-auto space-y-6">
          {/* ── Image carousel ── */}
          <div className={carDetailStyles.imageCarousel}>
            <img
              src={buildImageSrc(carImages[currentImage] ?? car.image)}
              alt={car.name}
              className={carDetailStyles.carImage}
              onError={(e) => handleImageError(e)}
            />
            {(carImages.length > 0 || (car.image && car.image !== "")) && (
              <div className={carDetailStyles.carouselIndicators}>
                {(carImages.length > 0 ? carImages : [car.image]).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImage(idx)}
                    aria-label={`Show image ${idx + 1}`}
                    className={carDetailStyles.carouselIndicator(idx === currentImage)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Car Name ── */}
          <h1 className={carDetailStyles.carName}>{car.make}</h1>

          {/* ── Price ── */}
          <p className={carDetailStyles.carPrice}>
            MYR&nbsp;{price} <span className={carDetailStyles.pricePerDay}>/ day</span>
          </p>

          {/* ══════════════════════════════════════════════════════════
              "Reserve Your Drive" — NOW here, after Name + Price,
              BEFORE company info. Airbnb-style date picker.
              ══════════════════════════════════════════════════════════ */}
            <div className="bg-white p-5 sm:p-7 rounded-2xl border border-orange-100 shadow-xl space-y-5">            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800">
                Reserve <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-orange-600">Your Drive</span>
              </h2>
              <p className="text-slate-500 text-sm mt-1">Pick your dates to get started</p>
            </div>

            {/* ── Airbnb-style check-in / check-out display ── */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-orange-50/50 border border-orange-200 rounded-xl px-4 py-3 hover:border-orange-400 transition-colors">
                <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-0.5">Check-in</p>
                <p className="text-slate-800 font-medium text-sm">
                  {formData.pickupDate
                    ? format(new Date(formData.pickupDate), "EEE, MMM d")
                    : <span className="text-gray-400">Select date</span>
                  }
                </p>
              </div>
              <div className="bg-orange-50/50 border border-orange-200 rounded-xl px-4 py-3 hover:border-orange-400 transition-colors">
                <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-0.5">Check-in</p>
                <p className="text-slate-800 font-medium text-sm">
                  {formData.returnDate
                    ? format(new Date(formData.returnDate), "EEE, MMM d")
                    : <span className="text-gray-400">Select date</span>
                  }
                </p>
              </div>
            </div>

            {/* ── Duration pill ── */}
            {formData.pickupDate && formData.returnDate && (
              <div className="flex items-center justify-center">
                <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-100 border border-orange-200 text-orange-600 text-sm font-medium">
                  <FaCalendarAlt className="text-xs" />
                  {days} {days === 1 ? "day" : "days"}
                </span>
              </div>
            )}

            {/* ── Calendar — clean, professional Airbnb-style ── */}
            <div className="swifty-calendar-wrapper rounded-xl overflow-hidden border border-orange-200">
              <DateRange
                ranges={range}
                onChange={onRangeChange}
                minDate={new Date()}
                rangeColors={["#f97316"]}
                direction="horizontal"
                months={2}
                showMonthAndYearPickers={false}
                showDateDisplay={false}
                disabledDates={disabledDates}
                className="swifty-calendar"
                monthDisplayFormat="MMMM yyyy"
              />
            </div>

            {/* ── Price breakdown (no insurance — that's chosen during checkout) ── */}
            <div className="bg-orange-50/50 rounded-xl p-4 border border-orange-100 space-y-2.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>MYR {formData.pickupDate && formData.returnDate ? Math.round(computeTotalRent() / days) : price} × {days} {days === 1 ? "night" : "nights"}</span>
                <span className="font-medium">MYR&nbsp;{formData.pickupDate && formData.returnDate ? computeTotalRent() : price}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-xs">
                <span>Deposit (pay at counter)</span>
                <span>MYR&nbsp;{deposit}</span>
              </div>
              <div className="border-t border-orange-200 pt-2 flex justify-between font-bold text-slate-800 text-base">
                <span>Subtotal</span>
                <span>MYR&nbsp;{formData.pickupDate && formData.returnDate ? computeTotalRent() : price}</span>
              </div>
              <p className="text-slate-400 text-xs pt-1">Insurance will be selected during checkout</p>
            </div>

            {/* ── CTA ── */}
            <button
              type="button"
              onClick={scrollToBookingForm}
              className="w-full flex items-center justify-center py-3.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 cursor-pointer text-white font-bold hover:from-amber-500 hover:to-orange-600 transition-all group text-base shadow-lg hover:shadow-orange-500/30 active:scale-[0.98]"
            >
              <FaCreditCard className="mr-2 group-hover:scale-110 transition-transform" />
              <span>Continue to Book</span>
            </button>
          </div>

          {/* ── Host's Company Name — NOW AFTER "Reserve Your Drive" ── */}
          {companyName ? (
            <div className="p-4 bg-white rounded-xl border border-orange-100 shadow-sm">
              <div className="flex items-start gap-3">
                <FaBuilding className="text-orange-400 mt-1" />
                <div>
                  <div className="text-sm font-semibold text-slate-800">{companyName}</div>
                  {companyAddress ? (
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                      <FaMapMarkerAlt className="text-slate-400" />
                      <span>{companyAddress}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {/* ── Specs grid ── */}
          <div className={carDetailStyles.specsGrid}>
            {[
              { Icon: FaUserFriends, label: "Seats", value: car.seats ?? "—", color: "text-orange-400" },
              { Icon: FaGasPump, label: "Fuel", value: car.fuel ?? car.fuelType ?? "—", color: "text-green-400" },
              { Icon: FaTachometerAlt, label: "Mileage", value: car.mileage ? `${car.mileage}\u00A0kmpl` : "—", color: "text-yellow-400" },
              { Icon: FaCheckCircle, label: "Transmission", value: transmissionLabel, color: "text-purple-400" },
            ].map((spec, i) => (
              <div key={i} className={carDetailStyles.specCard}>
                <spec.Icon className={`${spec.color} ${carDetailStyles.specIcon}`} />
                <p className={carDetailStyles.aboutText + " " + carDetailStyles.specLabel}>{spec.label}</p>
                <p className={carDetailStyles.specValue}>{spec.value}</p>
              </div>
            ))}
          </div>

          {/* ── About this car ── */}
          <div className={carDetailStyles.aboutSection}>
            <h2 className={carDetailStyles.aboutTitle}>About this car</h2>
            <p className={carDetailStyles.aboutText}>
              Experience luxury in the {car.name}. With its {transmissionLabel} transmission and seating for {car.seats ?? "—"}, every journey is exceptional.
            </p>
            <p className={carDetailStyles.aboutText}>
              {car.description ?? "This car combines performance and comfort for an unforgettable drive."}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="flex items-center"><FaCheckCircle className="text-green-400 mr-2 text-sm" /><span className="text-slate-600 text-sm">Free cancellation</span></div>
              <div className="flex items-center"><FaCheckCircle className="text-green-400 mr-2 text-sm" /><span className="text-gray-300 text-sm">24/7 Roadside assistance</span></div>
              <div className="flex items-center"><FaCheckCircle className="text-green-400 mr-2 text-sm" /><span className="text-gray-300 text-sm">Unlimited mileage</span></div>
              <div className="flex items-center"><FaCheckCircle className="text-green-400 mr-2 text-sm" /><span className="text-gray-300 text-sm">Collision damage waiver</span></div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 2: Full-Width Booking Form
            ═══════════════════════════════════════════════════════════════ */}
        <div className={carDetailStyles.sectionDivider} />
        <div ref={bookingFormRef} className={carDetailStyles.bookingSection}>
          <div className={carDetailStyles.bookingFormCard}>
            <h2 className={carDetailStyles.bookingTitle}>
              Complete <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-500">Your Booking</span>
            </h2>
            <p className={carDetailStyles.bookingSubtitle}>Fast · Secure · Easy</p>

            <form onSubmit={handleSubmit} className={carDetailStyles.form}>
              {/* ── Personal Information (wrapped in container like KYC / Insurance) ── */}
              <div className="p-3 rounded-xl border border-orange-200 bg-orange-50/30">
                <div className="flex items-center gap-2 mb-2">
                  <FaUser className="text-orange-400" />
                  <h3 className="text-sm font-semibold text-slate-800">Personal Information</h3>
                </div>

                {/* ── Name / Email / Phone row ── */}
                <div className={carDetailStyles.bookingFormGrid}>
                  <div className="flex flex-col">
                    <label className={carDetailStyles.formLabel}>Full Name</label>
                    <div className={carDetailStyles.inputContainer(activeField === "name")}>
                      <div className={carDetailStyles.inputIcon}><FaUser /></div>
                      <input
                        type="text"
                        name="name"
                        placeholder="Your full name"
                        value={formData.name}
                        onChange={handleInputChange}
                        onFocus={() => setActiveField("name")}
                        onBlur={() => setActiveField(null)}
                        required
                        className={carDetailStyles.textInputField}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <label className={carDetailStyles.formLabel}>Email Address</label>
                    <div className={carDetailStyles.inputContainer(activeField === "email")}>
                      <div className={carDetailStyles.inputIcon}><FaEnvelope /></div>
                      <input
                        type="email"
                        name="email"
                        placeholder="Your email"
                        value={formData.email}
                        onChange={handleInputChange}
                        onFocus={() => setActiveField("email")}
                        onBlur={() => setActiveField(null)}
                        required
                        className={carDetailStyles.textInputField + (emailReadOnly ? " opacity-80 bg-orange-50" : "")}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <label className={carDetailStyles.formLabel}>Phone Number</label>
                    <div className={carDetailStyles.inputContainer(activeField === "phone")}>
                      <div className={carDetailStyles.inputIcon}><FaPhone /></div>
                      <input
                        type="tel"
                        name="phone"
                        placeholder="Your phone number"
                        value={formData.phone}
                        onChange={handleInputChange}
                        onFocus={() => setActiveField("phone")}
                        onBlur={() => setActiveField(null)}
                        required
                        className={carDetailStyles.textInputField}
                      />
                    </div>
                  </div>
                </div>

                {/* ── Location search ── */}
                <div className="flex flex-col mt-3">
                  <label className={carDetailStyles.formLabel}>Location (city, state, landmark)</label>
                  <div className={carDetailStyles.inputContainer(activeField === "locationSearch")}>
                    <div className={carDetailStyles.inputIcon}><FaMapPin /></div>
                    {GOOGLE_MAPS_KEY ? (
                      <LoadScript googleMapsApiKey={GOOGLE_MAPS_KEY} libraries={["places"]}>
                        <StandaloneSearchBox
                          onLoad={(ref) => (searchBoxRef.current = ref)}
                          onPlacesChanged={handlePlaceChanged}
                        >
                          <input
                            type="text"
                            placeholder="Start typing to search..."
                            value={locationQuery}
                            onChange={(e) => setLocationQuery(e.target.value)}
                            onFocus={() => setActiveField("locationSearch")}
                            onBlur={() => setActiveField(null)}
                            className={carDetailStyles.textInputField}
                          />
                        </StandaloneSearchBox>
                      </LoadScript>
                    ) : (
                      <input
                        type="text"
                        placeholder="Start typing to search..."
                        value={locationQuery}
                        onChange={(e) => setLocationQuery(e.target.value)}
                        onFocus={() => setActiveField("locationSearch")}
                        onBlur={() => setActiveField(null)}
                        className={carDetailStyles.textInputField}
                      />
                    )}
                  </div>
                </div>

                {/* ── City / State / ZIP row ── */}
                <div className={carDetailStyles.bookingFormGrid + " mt-3"}>
                  <div className="flex flex-col">
                    <label className={carDetailStyles.formLabel}>City</label>
                    <div className={carDetailStyles.inputContainer(activeField === "city")}>
                      <div className={carDetailStyles.inputIcon}><FaCity /></div>
                      <input
                        type="text"
                        name="city"
                        placeholder="Your city"
                        value={formData.city}
                        onChange={handleInputChange}
                        onFocus={() => setActiveField("city")}
                        onBlur={() => setActiveField(null)}
                        required
                        className={carDetailStyles.textInputField}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <label className={carDetailStyles.formLabel}>State</label>
                    <div className={carDetailStyles.inputContainer(activeField === "state")}>
                      <div className={carDetailStyles.inputIcon}><FaGlobeAsia /></div>
                      <input
                        type="text"
                        name="state"
                        placeholder="Your state"
                        value={formData.state}
                        onChange={handleInputChange}
                        onFocus={() => setActiveField("state")}
                        onBlur={() => setActiveField(null)}
                        required
                        className={carDetailStyles.textInputField}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <label className={carDetailStyles.formLabel}>ZIP Code</label>
                    <div className={carDetailStyles.inputContainer(activeField === "zipCode")}>
                      <div className={carDetailStyles.inputIcon}><FaMapPin /></div>
                      <input
                        type="text"
                        name="zipCode"
                        placeholder="ZIP/Postal code"
                        value={formData.zipCode}
                        onChange={handleInputChange}
                        onFocus={() => setActiveField("zipCode")}
                        onBlur={() => setActiveField(null)}
                        required
                        className={carDetailStyles.textInputField}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── KYC section ── */}
              {!kycCheckDone && currentUserId ? (
                <div className="p-3 rounded-xl border border-orange-200 bg-orange-50/30">
                  <div className="flex items-center gap-2">
                    <FaShieldAlt className="text-gray-400 animate-pulse" />
                    <span className="text-sm text-slate-500">Checking verification status...</span>
                  </div>
                </div>
              ) : userKycApproved ? (
                <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50">
                  <div className="flex items-center gap-2">
                    <FaCheckCircle className="text-emerald-400" />
                    <span className="text-sm text-emerald-600 font-semibold">Identity Verified</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Your KYC has been approved. No additional verification needed.
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-xl border border-orange-200 bg-orange-50/30">
                  <div className="flex items-center gap-2 mb-2">
                    <FaPassport className="text-orange-400" />
                    <h3 className="text-sm font-semibold text-slate-800">KYC (Passport / NRIC)</h3>
                  </div>
                  <div className={carDetailStyles.bookingFormGrid}>
                    <div>
                      <label className={carDetailStyles.formLabel}>ID Type</label>
                      <select
                        name="idType"
                        value={formData.idType}
                        onChange={handleInputChange}
                        onFocus={() => setActiveField("idType")}
                        onBlur={() => setActiveField(null)}
                        className={carDetailStyles.textInputField + " bg-gray-800"}
                      >
                        <option value="passport">Passport</option>
                        <option value="nric">Malaysian NRIC</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className={carDetailStyles.formLabel}>ID Number (optional)</label>
                      <input
                        type="text"
                        name="idNumber"
                        placeholder="e.g. A1234567"
                        value={formData.idNumber}
                        onChange={handleInputChange}
                        onFocus={() => setActiveField("idNumber")}
                        onBlur={() => setActiveField(null)}
                        className={carDetailStyles.textInputField}
                      />
                    </div>
                    <div>
                      <label className={carDetailStyles.formLabel}>Issuing Country</label>
                      <select
                        name="idCountry"
                        value={formData.idCountry}
                        onChange={handleInputChange}
                        onFocus={() => setActiveField("idCountry")}
                        onBlur={() => setActiveField(null)}
                        required
                        className={carDetailStyles.textInputField + " bg-gray-800"}
                      >
                        {countryOptions.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className={carDetailStyles.formLabel}>Front Image (upload)</label>
                      <div className={carDetailStyles.inputContainer(activeField === "frontImage")}>
                        <div className={carDetailStyles.inputIcon}><FaImage /></div>
                        <input
                          type="file"
                          accept="image/*"
                          name="frontImage"
                          onChange={(e) => setFrontFile(e.target.files?.[0] || null)}
                          onFocus={() => setActiveField("frontImage")}
                          onBlur={() => setActiveField(null)}
                          className={carDetailStyles.textInputField}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={carDetailStyles.formLabel}>Back Image (upload)</label>
                      <div className={carDetailStyles.inputContainer(activeField === "backImage")}>
                        <div className={carDetailStyles.inputIcon}><FaImage /></div>
                        <input
                          type="file"
                          accept="image/*"
                          name="backImage"
                          onChange={(e) => setBackFile(e.target.files?.[0] || null)}
                          onFocus={() => setActiveField("backImage")}
                          onBlur={() => setActiveField(null)}
                          className={carDetailStyles.textInputField}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-start gap-2 text-xs text-orange-300">
                    <FaShieldAlt className="mt-0.5" />
                    <span>Reminder: Please bring your valid driving license (domestic or international per Malaysian law). Host will verify ID in person.</span>
                  </div>
                </div>
              )}

              {/* ── Insurance options (now full width — much more breathing room) ── */}
              <div className="p-3 rounded-xl border border-gray-700 bg-gray-800/70">
                <div className="flex items-center gap-2 mb-2">
                  <FaShieldAlt className="text-orange-400" />
                  <h3 className="text-sm font-semibold text-slate-800">Insurance / Excess</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {insuranceOptions.map((opt) => (
                    <label
                      key={opt.value}
                      className="flex items-start gap-3 cursor-pointer rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2 hover:border-orange-500 transition"
                    >
                      <input
                        type="radio"
                        name="insurancePlan"
                        value={opt.value}
                        checked={formData.insurancePlan === opt.value}
                        onChange={handleInputChange}
                        className="mt-1 accent-orange-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-100">
                          {opt.label}
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-orange-300">
                            {opt.feePerDay ? `MYR ${opt.feePerDay}/day` : "No daily fee"}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{opt.info}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* ── Terms & Conditions ── */}
              <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-white font-semibold">
                  <FaFileContract className="text-orange-400" /> Terms & Conditions
                </div>
                <p className="text-sm text-gray-300">
                  By booking, you agree to our{" "}
                  <button
                    type="button"
                    onClick={openTerms}
                    className="text-orange-400 underline hover:text-orange-300"
                  >
                    Terms & Conditions
                  </button>.
                </p>
                <label className="flex items-start gap-2 text-sm text-gray-200">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="mt-1 accent-orange-500"
                  />
                  <span>I have read and accept the Terms & Conditions.</span>
                </label>
                <label className="flex items-start gap-2 text-sm text-gray-200 mt-2">
                  <input
                    type="checkbox"
                    checked={marketingConsent}
                    onChange={(e) => setMarketingConsent(e.target.checked)}
                    className="mt-1 accent-emerald-500"
                  />
                  <span>
                    I agree to receive marketing communications and promotional offers from the car host via email. You can unsubscribe anytime.
                  </span>
                </label>
                {termsError && <p className="text-xs text-red-400">{termsError}</p>}
              </div>

              {/* ── Final price breakdown + submit ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className={carDetailStyles.priceBreakdown}>
                  <div className={carDetailStyles.priceRow}>
                    <span>Rate/day {(Number(fp.weekendMultiplier) > 1 || (fp.peakMultipliers && fp.peakMultipliers.length > 0)) ? "(avg)" : ""}</span>
                    <span>MYR&nbsp;{formData.pickupDate && formData.returnDate ? Math.round(computeTotalRent() / days) : price}</span>
                  </div>
                  {formData.pickupDate && formData.returnDate && (
                    <div className={carDetailStyles.priceRow}><span>Days</span><span>{days}</span></div>
                  )}
                  <div className={carDetailStyles.priceRow}><span>Insurance ({selectedPlan.label})</span><span>MYR&nbsp;{insuranceCost}</span></div>
                  <div className={carDetailStyles.priceRow}><span>Deposit (pay at counter)</span><span className="text-gray-300">MYR&nbsp;{deposit}</span></div>
                  <div className={carDetailStyles.totalRow}><span>Total (to pay now)</span><span>MYR&nbsp;{calculateTotal()}</span></div>
                  <p className="text-xs text-gray-400 mt-2">No hidden costs. Deposit is collected at the rental desk and will not be charged online.</p>
                </div>

                <div className="flex flex-col justify-end h-full">
                  <button type="submit" disabled={submitting} className={carDetailStyles.submitButton}>
                    <FaCreditCard className="mr-2 group-hover:scale-110 transition-transform" />
                    <span>{submitting ? "Redirecting to payment..." : "Pay & Confirm Booking"}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            CHAT WIDGET (unchanged)
            ═══════════════════════════════════════════════════════════════ */}
        {currentUser && (
          <div className="fixed bottom-4 left-4 z-50">
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="bg-orange-500 text-white p-3 rounded-full shadow-lg hover:bg-orange-600 transition md:p-4"
              aria-label="Toggle chat"
            >
              <FaComments className="text-lg md:text-xl" />
            </button>

            {isChatOpen && (
              <div className="mt-2 w-80 h-96 bg-gray-900 border border-gray-700 rounded-lg shadow-xl flex flex-col md:w-96 md:h-[28rem]">
                <div className="flex items-center justify-between p-3 border-b border-gray-700">
                  <h3 className="text-sm font-semibold text-white">Message Host</h3>
                  <button
                    onClick={() => setIsChatOpen(false)}
                    className="text-gray-400 hover:text-white"
                    aria-label="Close chat"
                  >
                    <FaTimes className="text-lg" />
                  </button>
                </div>

                <div className="flex-1 p-3 overflow-y-auto bg-gray-800">
                  {messages.length === 0 && <div className="text-xs text-gray-500">No messages yet.</div>}
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`mb-2 text-sm ${
                        msg.fromUserId === currentUserId ? "text-right" : "text-left"
                      }`}
                    >
                      <span className="bg-gray-700 p-2 rounded inline-block max-w-xs break-words">
                        {msg.message}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="p-3 border-t border-gray-700 bg-gray-900">
                  {messagingError && <div className="text-red-400 text-xs mb-2">{messagingError}</div>}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message..."
                      className="flex-1 p-2 bg-gray-800 border border-gray-600 rounded text-sm"
                    />
                    <button
                      onClick={sendMessage}
                      className="bg-orange-500 text-white p-2 rounded hover:bg-orange-600"
                    >
                      <FaPaperPlane className="text-sm" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            TERMS MODAL (unchanged)
            ═══════════════════════════════════════════════════════════════ */}
        {termsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
                <div className="flex items-center gap-2 text-white font-semibold">
                  <FaFileContract className="text-orange-400" /> Terms & Conditions
                </div>
                <button
                  onClick={closeTerms}
                  className="text-gray-400 hover:text-white"
                  aria-label="Close terms"
                >
                  <FaTimes />
                </button>
              </div>
              <div className="p-5 overflow-y-auto max-h-[65vh] text-gray-200 leading-relaxed whitespace-pre-wrap">
                {termsLoading ? "Loading..." : termsError ? termsError : termsText || "No terms available."}
              </div>
              <div className="px-5 py-4 border-t border-gray-800 flex justify-end">
                <button
                  onClick={closeTerms}
                  className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CarDetail;