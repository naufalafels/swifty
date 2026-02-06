import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaCheckCircle, FaChevronDown, FaImage, FaList, FaRocket } from "react-icons/fa";
import { createHostCar } from "../services/hostService";
import { toast } from "react-toastify";

const seatOptions = ["2 Seater", "4 Seater", "5 Seater", "7 Seater", "8 Seater", "9 Seater", "12 Seater (Van)"];
const shiftOptions = ["Automatic", "Manual", "CVT", "Dual-clutch", "Semi-automatic"];
const carTypeOptions = ["Hatchback", "Sedan", "SUV", "MPV", "Truck", "Van", "Luxury", "Classic", "Coupe", "Convertible"];
const fuelOptions = ["Petrol", "Diesel", "Hybrid", "Electric"];
const petrolTypes = ["RON95", "RON97", "RON100", "Ethanol", "E85"];

const HostAddCars = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [car, setCar] = useState({
    make: "",
    model: "",
    year: "",
    dailyRate: "",
    deposit: "",
    seats: "5 Seater",
    transmission: "Automatic",
    fuelType: "Petrol",
    petrolType: "RON95",
    mileage: "",
    category: "Sedan",
    gasUsage: "",
    image: null,
  });

  const petrolEnabled = car.fuelType === "Petrol";

  const requiredFields = ["make", "model", "year", "dailyRate", "deposit", "seats", "transmission", "fuelType", "category", "gasUsage"];
  const validate = () => {
    const next = {};
    requiredFields.forEach((f) => {
      if (!car[f] || `${car[f]}`.trim() === "") next[f] = "Required";
    });
    if (petrolEnabled && (!car.petrolType || `${car.petrolType}`.trim() === "")) {
      next.petrolType = "Required for Petrol";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const next = () => setStep(2);
  const prev = () => setStep(1);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    setCar((c) => ({ ...c, image: file || null }));
  };

  const publish = async () => {
    if (!validate()) {
      toast.error("Please fill all required fields.");
      return;
    }
    setSaving(true);
    try {
      const form = new FormData();
      Object.entries(car).forEach(([k, v]) => {
        if (v !== null && v !== undefined && v !== "") {
          form.append(k, v);
        }
      });
      await createHostCar(form);
      toast.success("Car published!");
      navigate("/host/dashboard");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to add car");
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (name) => errors[name] ? <span className="text-xs text-rose-400">{errors[name]}</span> : null;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <button
          onClick={() => navigate("/host/dashboard")}
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm"
        >
          <FaArrowLeft /> Back to Dashboard
        </button>

        <div className="flex items-center gap-2 text-2xl font-bold">
          <FaRocket className="text-emerald-400" /> Add Car
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-center">
          <div className={`rounded-lg border px-2 py-2 ${step === 1 ? "bg-emerald-700 border-emerald-500" : "bg-slate-900 border-slate-800"}`}>
            Add Car
          </div>
          <div className={`rounded-lg border px-2 py-2 ${step === 2 ? "bg-emerald-700 border-emerald-500" : "bg-slate-900 border-slate-800"}`}>
            Publish (Summary)
          </div>
        </div>

        {step === 1 && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="text-sm text-white font-semibold flex items-center gap-2">
              <FaList /> Car details
            </div>

            <div className="grid md:grid-cols-[1fr_1fr] gap-4">
              <div className="space-y-3">
                {[
                  ["make", "Make (Toyota, Honda, etc)"],
                  ["model", "Model (Camry, Civic, etc)"],
                  ["year", "Manufactured Year"],
                  ["dailyRate", "Daily Rate (MYR) — flexible pricing applies"],
                  ["deposit", "Deposit (MYR) — flexible pricing applies"],
                  ["mileage", "Mileage (km)"],
                  ["gasUsage", "Gas Usage (e.g., 18.9 km/l)"],
                ].map(([key, label]) => (
                  <label key={key} className="text-sm text-slate-200 space-y-1">
                    {label}
                    <input
                      value={car[key]}
                      onChange={(e) => setCar((c) => ({ ...c, [key]: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
                    />
                    {fieldError(key)}
                  </label>
                ))}

                <label className="text-sm text-slate-200 space-y-1">
                  Category (Car Type)
                  <ScrollableSelect
                    value={car.category}
                    options={carTypeOptions}
                    onChange={(v) => setCar((c) => ({ ...c, category: v }))}
                  />
                  {fieldError("category")}
                </label>

                <label className="text-sm text-slate-200 space-y-1">
                  Seats
                  <ScrollableSelect
                    value={car.seats}
                    options={seatOptions}
                    onChange={(v) => setCar((c) => ({ ...c, seats: v }))}
                  />
                  {fieldError("seats")}
                </label>

                <label className="text-sm text-slate-200 space-y-1">
                  Shift Type
                  <ScrollableSelect
                    value={car.transmission}
                    options={shiftOptions}
                    onChange={(v) => setCar((c) => ({ ...c, transmission: v }))}
                  />
                  {fieldError("transmission")}
                </label>
              </div>

              <div className="space-y-3">
                <label className="text-sm text-slate-200 space-y-1">
                  Fuel
                  <ScrollableSelect
                    value={car.fuelType}
                    options={fuelOptions}
                    onChange={(v) => setCar((c) => ({ ...c, fuelType: v }))}
                  />
                  {fieldError("fuelType")}
                </label>

                {petrolEnabled && (
                  <label className="text-sm text-slate-200 space-y-1">
                    Petrol Type (only if Petrol)
                    <ScrollableSelect
                      value={car.petrolType}
                      options={petrolTypes}
                      onChange={(v) => setCar((c) => ({ ...c, petrolType: v }))}
                    />
                    {fieldError("petrolType")}
                  </label>
                )}

                <div className="space-y-2">
                  <label className="text-sm text-slate-200 flex items-center gap-2">
                    <FaImage /> Upload Vehicle Image
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-16 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden">
                      {car.image ? (
                        <img
                          src={URL.createObjectURL(car.image)}
                          alt="preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs text-slate-500">Preview</span>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFile}
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => {
                  if (validate()) next();
                  else toast.error("Please fill all required fields.");
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-4 py-2 font-semibold"
              >
                Continue to summary
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="text-sm text-white font-semibold flex items-center gap-2">
              <FaCheckCircle className="text-emerald-400" /> Summary
            </div>
            <div className="space-y-2 text-sm text-slate-200">
              {Object.entries(car).filter(([k]) => k !== "image").map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-slate-800 py-1">
                  <span className="capitalize text-slate-400">{k}</span>
                  <span>{v || "-"}</span>
                </div>
              ))}
              <div className="flex justify-between border-b border-slate-800 py-1">
                <span className="text-slate-400">Image</span>
                <span>{car.image ? car.image.name : "Not uploaded"}</span>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={prev}
                className="bg-slate-800 hover:bg-slate-700 text-white rounded-lg px-4 py-2 font-semibold"
              >
                Back
              </button>
              <button
                onClick={publish}
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg px-4 py-2 font-semibold"
              >
                {saving ? "Publishing..." : "Publish"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ScrollableSelect = ({ value, options, onChange, disabled = false }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => options.filter((o) => o.toLowerCase().includes(query.toLowerCase())),
    [options, query]
  );

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-left text-white flex items-center justify-between ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <span>{value || "Select"}</span>
        <FaChevronDown className="text-slate-400" />
      </button>
      {open && !disabled && (
        <div className="absolute z-20 mt-1 w-full bg-slate-900 border border-slate-800 rounded-lg shadow-lg">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to filter"
            className="w-full bg-slate-800 border-b border-slate-800 px-3 py-2 text-sm text-white"
          />
          <div className="max-h-48 overflow-auto">
            {filtered.map((opt) => (
              <button
                key={opt}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                  setQuery("");
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-800 text-white flex items-center justify-between"
              >
                <span>{opt}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-sm text-slate-400">No matches</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HostAddCars;