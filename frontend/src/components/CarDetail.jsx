import React, { useState, useEffect, useRef } from "react";
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
  FaInfoCircle
} from "react-icons/fa";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import api from "../utils/api";
import * as authService from "../utils/authService";
import carsData from "../assets/carsData.js";
import { carDetailStyles } from "../assets/dummyStyles.js";
import { createRazorpayOrder, verifyRazorpayPayment } from "../services/paymentService";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:7889";

const todayISO = () => new Date().toISOString().split("T")[0];

const buildImageSrc = (image) => {
  if (!image) return `${API_BASE}/uploads/default-car.png`;
  if (Array.isArray(image)) image = image[0];
  if (!image || typeof image !== "string")
    return `${API_BASE}/uploads/default-car.png`;
  const t = image.trim();
  if (!t) return `${API_BASE}/uploads/default-car.png`;
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  if (t.startsWith("/")) return `${API_BASE}${t}`;
  return `${API_BASE}/uploads/${t}`;
};

const handleImageError = (
  e,
  fallback = `${API_BASE}/uploads/default-car.png`
) => {
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

const calculateDays = (from, to) => {
  if (!from || !to) return 1;
  const days = Math.ceil(
    (new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24)
  );
  return Math.max(1, days);
};

// Insurance plans (clean labels; fees per day)
const insuranceOptions = [
  {
    value: "full_excess",
    label: "Full Excess",
    feePerDay: 0,
    info: "You keep the standard excess; no extra daily fee."
  },
  {
    value: "half_excess",
    label: "Half Excess",
    feePerDay: 15,
    info: "Reduce your excess liability by half for a small daily fee."
  },
  {
    value: "no_excess",
    label: "No Excess (Incl. 24h cancellation)",
    feePerDay: 30,
    info: "Zero excess plus 24-hour cancellation coverage for peace of mind."
  }
];

const countryOptions = [
  "Malaysia",
  "Singapore",
  "Thailand",
  "Indonesia",
  "Brunei",
  "Philippines",
  "Vietnam",
  "Japan",
  "South Korea",
  "China",
  "India",
  "Australia",
  "New Zealand",
  "United Kingdom",
  "United States",
  "Canada",
  "Germany",
  "France",
  "Netherlands",
  "United Arab Emirates",
  "Saudi Arabia"
];

const loadRazorpayScript = () =>
  new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
    document.body.appendChild(script);
  });

const CarDetail = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [car, setCar] = useState(() => location.state?.car || null);
  const [loadingCar, setLoadingCar] = useState(false);
  const [carError, setCarError] = useState("");
  const [currentImage, setCurrentImage] = useState(0);

  // Initialize pickup/return from navigation state if passed (so clicking Book Now carries dates)
  const initialPickup = location.state?.pickupDate || "";
  const initialReturn = location.state?.returnDate || "";

  // If logged in, pre-fill email and use readOnly
  const currentUser = authService.getCurrentUser();
  const emailPrefill = currentUser?.email || "";

  const [formData, setFormData] = useState({
    pickupDate: initialPickup,
    returnDate: initialReturn,
    pickupLocation: "",
    name: currentUser?.name || "",
    email: emailPrefill,
    phone: "",
    city: "",
    state: "",
    zipCode: "",
    idType: "passport",
    idNumber: "",
    idCountry: "Malaysia",
    insurancePlan: "no_excess"
  });

  // constants for pricing
  const deposit = 500; // MYR deposit paid at rental counter (not charged online)

  // If user is logged in, we want email read-only and not required to be typed.
  const emailReadOnly = !!emailPrefill;

  const [activeField, setActiveField] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const fetchControllerRef = useRef(null);
  const submitControllerRef = useRef(null);
  const [today, setToday] = useState(todayISO());

  useEffect(() => setToday(todayISO()), []);

  useEffect(() => {
    if (car) {
      setCurrentImage(0);
      return;
    }

    const local = carsData.find((c) => String(c.id) === String(id));
    if (local) {
      setCar(local);
      setCurrentImage(0);
      return;
    }

    const controller = new AbortController();
    fetchControllerRef.current = controller;
    (async () => {
      setLoadingCar(true);
      setCarError("");
      try {
        const res = await api.get(`/api/cars/${id}`, {
          signal: controller.signal,
        });
        const payload = res.data?.data ?? res.data ?? null;
        if (payload) setCar(payload);
        else setCarError("Car not found.");
      } catch (err) {
        const canceled =
          err?.code === "ERR_CANCELED" ||
          err?.name === "CanceledError" ||
          err?.message === "canceled";
        if (!canceled) {
          console.error("Failed to fetch car:", err);
          setCarError(
            err?.response?.data?.message || err.message || "Failed to load car"
          );
        }
      } finally {
        setLoadingCar(false);
      }
    })();

    return () => {
      try {
        controller.abort();
      } catch {}
      fetchControllerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!car && loadingCar)
    return <div className="p-6 text-white">Loading car...</div>;
  if (!car && carError)
    return <div className="p-6 text-red-400">{carError}</div>;
  if (!car) return <div className="p-6 text-white">Car not found.</div>;

  const carImages = [
    ...(Array.isArray(car.images) ? car.images : []),
    ...(car.image ? (Array.isArray(car.image) ? car.image : [car.image]) : []),
  ].filter(Boolean);

  const price = Number(car.price ?? car.dailyRate ?? 0) || 0;
  const days = calculateDays(formData.pickupDate, formData.returnDate);

  const selectedPlan = insuranceOptions.find((p) => p.value === formData.insurancePlan) || insuranceOptions[2];
  const insuranceCost = days * (selectedPlan.feePerDay || 0);
  const calculateTotal = () => days * price + insuranceCost;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.pickupDate || !formData.returnDate) {
      toast.error("Please select pickup and return dates.");
      return;
    }
    if (new Date(formData.returnDate) < new Date(formData.pickupDate)) {
      toast.error("Return date must be the same or after pickup date.");
      return;
    }
    if (!emailReadOnly && !formData.email) {
      toast.error("Please provide an email address.");
      return;
    }
    if (!formData.phone) {
      toast.error("Please provide a phone number.");
      return;
    }
    if (!formData.idNumber || !formData.idCountry) {
      toast.error("Please provide your ID number and issuing country.");
      return;
    }

    setSubmitting(true);
    if (submitControllerRef.current) {
      try {
        submitControllerRef.current.abort();
      } catch {}
    }
    const controller = new AbortController();
    submitControllerRef.current = controller;

    try {
      // Prefer authenticated user id/email when available
      const user = authService.getCurrentUser();
      const userId = user?.id;
      const emailToUse = user?.email || formData.email;

      const paymentBreakdown = {
        rent: days * price,
        insurance: insuranceCost,
        insurancePlan: formData.insurancePlan,
        deposit // shown to user, paid at counter (not charged online)
      };

      const payload = {
        userId,
        customer: formData.name || (user?.name || "Guest"),
        email: emailToUse,
        phone: formData.phone,
        car: {
          id: car._id ?? car.id ?? null,
          name: car.name ?? `${car.make ?? ""} ${car.model ?? ""}`.trim(),
        },
        pickupDate: formData.pickupDate,
        returnDate: formData.returnDate,
        amount: calculateTotal(),
        paymentBreakdown,
        details: { pickupLocation: formData.pickupLocation },
        address: {
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
        },
        kyc: {
          idType: formData.idType,
          idNumber: formData.idNumber,
          idCountry: formData.idCountry,
          licenseReminderSent: false,
          licenseNote: "Please bring your valid driving license (domestic or international per Malaysian law)."
        },
        carImage: car.image
          ? buildImageSrc(Array.isArray(car.image) ? car.image[0] : car.image)
          : undefined,
      };

      await loadRazorpayScript();

      const res = await createRazorpayOrder(payload);

      if (!res?.orderId || !res?.key) {
        toast.error("Failed to initiate payment. Please try again.");
        return;
      }

      const rzp = new window.Razorpay({
        key: res.key,
        amount: res.amount,
        currency: res.currency,
        name: "Swifty Car Rental",
        description: car.name || "Car Rental",
        order_id: res.orderId,
        prefill: {
          name: payload.customer,
          email: payload.email,
          contact: payload.phone,
        },
        notes: {
          bookingId: res.bookingId,
          pickupDate: payload.pickupDate,
          returnDate: payload.returnDate,
        },
        handler: async (response) => {
          toast.success("Payment captured. Finalizing booking...", { autoClose: 1200 });
          // Optional client verify (webhook is source of truth)
          try {
            await verifyRazorpayPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              bookingId: res.bookingId,
            });
          } catch (e) {
            console.warn("Client verification failed (webhook will handle):", e);
          }
          navigate(`/success?booking_id=${res.bookingId}&payment_status=success`, { replace: true });
        },
        modal: {
          ondismiss: () => {
            toast.info("Payment was cancelled.");
            navigate(`/cancel?booking_id=${res.bookingId}&payment_status=cancelled`, { replace: true });
          },
        },
        theme: {
          color: "#f97316"
        }
      });

      rzp.open();
    } catch (err) {
      const canceled =
        err?.code === "ERR_CANCELED" ||
        err?.name === "CanceledError" ||
        err?.message === "canceled";
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

  const transmissionLabel = car.transmission
    ? String(car.transmission).toLowerCase()
    : "standard";

  // company info helpers
  const companyName = car.company?.name || car.companyName || car.ownerName || "";
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

  return (
    <div className={carDetailStyles.pageContainer}>
      <div className={carDetailStyles.contentContainer}>
        <ToastContainer />
        <button
          onClick={() => navigate(-1)}
          className={carDetailStyles.backButton}
        >
          <FaArrowLeft className={carDetailStyles.backButtonIcon} />
        </button>

        <div className={carDetailStyles.mainLayout}>
          <div className={carDetailStyles.leftColumn}>
            <div className={carDetailStyles.imageCarousel}>
              <img
                src={buildImageSrc(carImages[currentImage] ?? car.image)}
                alt={car.name}
                className={carDetailStyles.carImage}
                onError={(e) => handleImageError(e)}
              />
              {(carImages.length > 0 || (car.image && car.image !== "")) && (
                <div className={carDetailStyles.carouselIndicators}>
                  {(carImages.length > 0 ? carImages : [car.image]).map(
                    (_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentImage(idx)}
                        aria-label={`Show image ${idx + 1}`}
                        className={carDetailStyles.carouselIndicator(
                          idx === currentImage
                        )}
                      />
                    )
                  )}
                </div>
              )}
            </div>

            <h1 className={carDetailStyles.carName}>{car.make}</h1>
            <p className={carDetailStyles.carPrice}>
              MYR&nbsp;{price}{" "}
              <span className={carDetailStyles.pricePerDay}>/ day</span>
            </p>

            {/* Company brief */}
            {companyName ? (
              <div className="mt-3 mb-3 p-3 bg-gray-800 rounded-md border border-gray-700">
                <div className="flex items-start gap-3">
                  <FaBuilding className="text-orange-400 mt-1" />
                  <div>
                    <div className="text-sm font-semibold text-gray-100">{companyName}</div>
                    {companyAddress ? (
                      <div className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                        <FaMapMarkerAlt className="text-gray-500" />
                        <span>{companyAddress}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            <div className={carDetailStyles.specsGrid}>
              {[
                {
                  Icon: FaUserFriends,
                  label: "Seats",
                  value: car.seats ?? "—",
                  color: "text-orange-400",
                },
                {
                  Icon: FaGasPump,
                  label: "Fuel",
                  value: car.fuel ?? car.fuelType ?? "—",
                  color: "text-green-400",
                },
                {
                  Icon: FaTachometerAlt,
                  label: "Mileage",
                  value: car.mileage ? `${car.mileage} kmpl` : "—",
                  color: "text-yellow-400",
                },
                {
                  Icon: FaCheckCircle,
                  label: "Transmission",
                  value: transmissionLabel,
                  color: "text-purple-400",
                },
              ].map((spec, i) => (
                <div key={i} className={carDetailStyles.specCard}>
                  <spec.Icon
                    className={`${spec.color} ${carDetailStyles.specIcon}`}
                  />
                  <p
                    className={
                      carDetailStyles.aboutText +
                      " " +
                      carDetailStyles.specLabel
                    }
                  >
                    {spec.label}
                  </p>
                  <p className={carDetailStyles.specValue}>{spec.value}</p>
                </div>
              ))}
            </div>

            <div className={carDetailStyles.aboutSection}>
              <h2 className={carDetailStyles.aboutTitle}>About this car</h2>
              <p className={carDetailStyles.aboutText}>
                Experience luxury in the {car.name}. With its{" "}
                {transmissionLabel} transmission and seating for{" "}
                {car.seats ?? "—"}, every journey is exceptional.
              </p>
              <p className={carDetailStyles.aboutText}>
                {car.description ??
                  "This car combines performance and comfort for an unforgettable drive."}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="flex items-center">
                  <FaCheckCircle className="text-green-400 mr-2 text-sm" />
                  <span className="text-gray-300 text-sm">
                    Free cancellation
                  </span>
                </div>
                <div className="flex items-center">
                  <FaCheckCircle className="text-green-400 mr-2 text-sm" />
                  <span className="text-gray-300 text-sm">
                    24/7 Roadside assistance
                  </span>
                </div>
                <div className="flex items-center">
                  <FaCheckCircle className="text-green-400 mr-2 text-sm" />
                  <span className="text-gray-300 text-sm">
                    Unlimited mileage
                  </span>
                </div>
                <div className="flex items-center">
                  <FaCheckCircle className="text-green-400 mr-2 text-sm" />
                  <span className="text-gray-300 text-sm">
                    Collision damage waiver
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className={carDetailStyles.rightColumn}>
            <div className={carDetailStyles.bookingCard}>
              <h2 className={carDetailStyles.bookingTitle}>
                Reserve{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-500">
                  Your Drive
                </span>
              </h2>
              <p className={carDetailStyles.bookingSubtitle}>
                Fast · Secure · Easy
              </p>

              <form onSubmit={handleSubmit} className={carDetailStyles.form}>
                <div className={carDetailStyles.grid2}>
                  <div>
                    <label className={carDetailStyles.formLabel}>
                      Pickup Date
                    </label>
                    <div
                      className={carDetailStyles.inputContainer(
                        activeField === "pickupDate"
                      )}
                    >
                      <div className={carDetailStyles.inputIcon}>
                        <FaCalendarAlt />
                      </div>
                      <input
                        id="pickupDate"
                        type="date"
                        name="pickupDate"
                        min={today}
                        value={formData.pickupDate}
                        onChange={handleInputChange}
                        onFocus={() => setActiveField("pickupDate")}
                        onBlur={() => setActiveField(null)}
                        required
                        className={carDetailStyles.inputField}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={carDetailStyles.formLabel}>
                      Return Date
                    </label>
                    <div
                      className={carDetailStyles.inputContainer(
                        activeField === "returnDate"
                      )}
                    >
                      <div className={carDetailStyles.inputIcon}>
                        <FaCalendarAlt />
                      </div>
                      <input
                        id="returnDate"
                        type="date"
                        name="returnDate"
                        min={formData.pickupDate || today}
                        value={formData.returnDate}
                        onChange={handleInputChange}
                        onFocus={() => setActiveField("returnDate")}
                        onBlur={() => setActiveField(null)}
                        required
                        className={carDetailStyles.inputField}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col mt-3">
                  <label className={carDetailStyles.formLabel}>Full Name</label>
                  <div
                    className={carDetailStyles.inputContainer(
                      activeField === "name"
                    )}
                  >
                    <div className={carDetailStyles.inputIcon}>
                      <FaUser />
                    </div>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                  <div className="flex flex-col">
                    <label className={carDetailStyles.formLabel}>
                      Email Address
                    </label>
                    <div
                      className={carDetailStyles.inputContainer(
                        activeField === "email"
                      )}
                    >
                      <div className={carDetailStyles.inputIcon}>
                        <FaEnvelope />
                      </div>
                      <input
                        type="email"
                        name="email"
                        placeholder="Your email"
                        value={formData.email}
                        onChange={handleInputChange}
                        onFocus={() => setActiveField("email")}
                        onBlur={() => setActiveField(null)}
                        required={!emailReadOnly}
                        readOnly={emailReadOnly}
                        className={carDetailStyles.textInputField + (emailReadOnly ? " opacity-80 bg-gray-800" : "")}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <label className={carDetailStyles.formLabel}>
                      Phone Number
                    </label>
                    <div
                      className={carDetailStyles.inputContainer(
                        activeField === "phone"
                      )}
                    >
                      <div className={carDetailStyles.inputIcon}>
                        <FaPhone />
                      </div>
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                  <div className="flex flex-col">
                    <label className={carDetailStyles.formLabel}>City</label>
                    <div
                      className={carDetailStyles.inputContainer(
                        activeField === "city"
                      )}
                    >
                      <div className={carDetailStyles.inputIcon}>
                        <FaCity />
                      </div>
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
                    <div
                      className={carDetailStyles.inputContainer(
                        activeField === "state"
                      )}
                    >
                      <div className={carDetailStyles.inputIcon}>
                        <FaGlobeAsia />
                      </div>
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
                    <label className={carDetailStyles.formLabel}>
                      ZIP Code
                    </label>
                    <div
                      className={carDetailStyles.inputContainer(
                        activeField === "zipCode"
                      )}
                    >
                      <div className={carDetailStyles.inputIcon}>
                        <FaMapPin />
                      </div>
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

                {/* KYC Section */}
                <div className="mt-4 p-3 rounded-xl border border-gray-700 bg-gray-800/70">
                  <div className="flex items-center gap-2 mb-2">
                    <FaPassport className="text-orange-400" />
                    <h3 className="text-sm font-semibold text-gray-100">KYC (Passport / NRIC)</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                      <label className={carDetailStyles.formLabel}>ID Number</label>
                      <input
                        type="text"
                        name="idNumber"
                        placeholder="e.g. A1234567"
                        value={formData.idNumber}
                        onChange={handleInputChange}
                        onFocus={() => setActiveField("idNumber")}
                        onBlur={() => setActiveField(null)}
                        required
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
                  <div className="mt-3 flex items-start gap-2 text-xs text-orange-300">
                    <FaShieldAlt className="mt-0.5" />
                    <span>Reminder: Please bring your valid driving license (domestic or international) as required by Malaysian law.</span>
                  </div>
                </div>

                {/* Insurance selection */}
                <div className="mt-4 p-3 rounded-xl border border-gray-700 bg-gray-800/70">
                  <div className="flex items-center gap-2 mb-2">
                    <FaShieldAlt className="text-orange-400" />
                    <h3 className="text-sm font-semibold text-gray-100">Insurance / Excess</h3>
                  </div>
                  <div className="space-y-2">
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

                <div className={carDetailStyles.priceBreakdown + " mt-4"}>
                  <div className={carDetailStyles.priceRow}>
                    <span>Rate/day</span>
                    <span>MYR&nbsp;{price}</span>
                  </div>
                  {formData.pickupDate && formData.returnDate && (
                    <div className={carDetailStyles.priceRow}>
                      <span>Days</span>
                      <span>{days}</span>
                    </div>
                  )}
                  <div className={carDetailStyles.priceRow}>
                    <span>Insurance ({selectedPlan.label})</span>
                    <span>MYR&nbsp;{insuranceCost}</span>
                  </div>
                  <div className={carDetailStyles.priceRow}>
                    <span>Deposit (pay at counter)</span>
                    <span className="text-gray-300">MYR&nbsp;{deposit}</span>
                  </div>
                  <div className={carDetailStyles.totalRow}>
                    <span>Total (to pay now)</span>
                    <span>MYR&nbsp;{calculateTotal()}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    No hidden costs. Deposit is collected at the rental desk and will not be charged online.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className={carDetailStyles.submitButton}
                >
                  <FaCreditCard className="mr-2 group-hover:scale-110 transition-transform" />
                  <span>
                    {submitting ? "Processing..." : "Pay & Confirm Booking"}
                  </span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CarDetail;