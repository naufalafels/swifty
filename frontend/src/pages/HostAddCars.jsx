import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaCheckCircle, FaChevronDown, FaImage, FaList, FaRocket } from "react-icons/fa";
import { createHostCar } from "../services/hostService";
import { toast } from "react-toastify";

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
    deposit: "",  // Added
    seats: "",
    transmission: "Automatic",
    fuelType: "Petrol",
    petrolType: [],  // Changed to array
    mileage: "",
    category: "Sedan",
    gasUsage: "",  // Added
    image: null,
  });

  const petrolEnabled = car.fuelType === "Petrol";

  const requiredFields = ["make", "model", "year", "dailyRate", "deposit", "seats", "transmission", "fuelType", "category", "gasUsage", "mileage"];
  const validate = () => {
    const next = {};
    requiredFields.forEach((f) => {
      if (!car[f] || `${car[f]}`.trim() === "") next[f] = "Required";
    });
    if (petrolEnabled && (!car.petrolType || car.petrolType.length === 0)) {
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
        if (k === "petrolType") {
          form.append(k, JSON.stringify(v));  // Send as JSON array
        } else if (v !== null && v !== undefined && v !== "") {
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

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-sm text-slate-200">Make
                <input
                  value={car.make}
                  onChange={(e) => setCar((c) => ({ ...c, make: e.target.value }))}
                  className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
                  placeholder="e.g., Toyota, Honda, Perodua"
                  required
                />
              </label>
              <label className="text-sm text-slate-200">Model
                <input
                  value={car.model}
                  onChange={(e) => setCar((c) => ({ ...c, model: e.target.value }))}
                  className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
                  placeholder="e.g., Corolla, Civic, Myvi"
                  required
                />
              </label>
              <label className="text-sm text-slate-200">Manufactured year
                <input
                  value={car.year}
                  onChange={(e) => setCar((c) => ({ ...c, year: e.target.value }))}
                  className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
                  placeholder="2023"
                  required
                />
              </label>
              <label className="text-sm text-slate-200">Daily rate (MYR)
                <input
                  value={car.dailyRate}
                  onChange={(e) => setCar((c) => ({ ...c, dailyRate: e.target.value }))}
                  className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
                  placeholder="Flexible pricing supported"
                  required
                />
              </label>
              <label className="text-sm text-slate-200">Deposit (MYR)
                <input
                  value={car.deposit}
                  onChange={(e) => setCar((c) => ({ ...c, deposit: e.target.value }))}
                  className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
                  placeholder="Flexible pricing supported"
                  type="number"
                  required
                />
              </label>
              <label className="text-sm text-slate-200">Mileage (km)
                <input
                  value={car.mileage}
                  onChange={(e) => setCar((c) => ({ ...c, mileage: e.target.value }))}
                  className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
                  placeholder="e.g., 50000"
                  required
                />
              </label>
              <label className="text-sm text-slate-200">Gas Usage
                <input
                  value={car.gasUsage}
                  onChange={(e) => setCar((c) => ({ ...c, gasUsage: e.target.value }))}
                  className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
                  placeholder="e.g., 18.9 km/l"
                  required
                />
              </label>
              <label className="text-sm text-slate-200">Seats
                <select
                  value={car.seats}
                  onChange={(e) => setCar((c) => ({ ...c, seats: e.target.value }))}
                  className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
                >
                  <option value="">Select</option>
                  {[2, 4, 5, 7, 8, 12].map((s) => (
                    <option key={s} value={s}>
                      {s} seater
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-200">Shift type
                <select
                  value={car.transmission}
                  onChange={(e) => setCar((c) => ({ ...c, transmission: e.target.value }))}
                  className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
                >
                  <option value="">Select</option>
                  <option>Automatic</option>
                  <option>Manual</option>
                </select>
              </label>
              <label className="text-sm text-slate-200">Fuel type
                <select
                  value={car.fuelType}
                  onChange={(e) => setCar((c) => ({ ...c, fuelType: e.target.value }))}
                  className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
                >
                  <option value="">Select</option>
                  <option>Petrol</option>
                  <option>Diesel</option>
                  <option>Hybrid</option>
                  <option>Electric</option>
                </select>
              </label>
              {car.fuelType === 'Petrol' && (
                <div className="col-span-2">
                  <label className="text-sm text-slate-200">Petrol type (check all that apply)
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {['Ron95', 'Ron97', 'Ron100', 'Ethanol', 'E85'].map(type => (
                        <label key={type} className="flex items-center gap-2 text-sm text-slate-200">
                          <input
                            type="checkbox"
                            checked={Array.isArray(car.petrolType) ? car.petrolType.includes(type) : false}
                            onChange={(e) => {
                              const current = Array.isArray(car.petrolType) ? car.petrolType : [];
                              const updated = e.target.checked
                                ? [...current, type]
                                : current.filter(t => t !== type);
                              setCar((c) => ({ ...c, petrolType: updated }));
                            }}
                            className="accent-emerald-500"
                          />
                          {type}
                        </label>
                      ))}
                    </div>
                  </label>
                </div>
              )}
              <label className="text-sm text-slate-200">Car type
                <select
                  value={car.category}
                  onChange={(e) => setCar((c) => ({ ...c, category: e.target.value }))}
                  className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
                >
                  <option value="">Select</option>
                  {['Hatchback', 'Sedan', 'SUV', 'MPV', 'Truck', 'Van', 'Luxury', 'Classic'].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <div className="col-span-2">
                <label className="text-sm text-slate-200">Vehicle image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFile}
                    className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
                    required
                  />
                </label>
                {car.image && (
                  <div className="mt-2">
                    <img src={URL.createObjectURL(car.image)} alt="Vehicle Preview" className="w-32 h-32 object-cover rounded border" />
                  </div>
                )}
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
                  <span>{Array.isArray(v) ? v.join(', ') : v || "-"}</span>
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

export default HostAddCars;