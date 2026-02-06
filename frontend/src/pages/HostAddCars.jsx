import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaCheckCircle, FaList, FaRocket } from "react-icons/fa";
import { createHostCar } from "../services/hostService";
import { toast } from "react-toastify";

const HostAddCars = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [car, setCar] = useState({
    make: "",
    model: "",
    year: "",
    dailyRate: "",
    seats: "4",
    transmission: "Automatic",
    fuelType: "Gasoline",
    mileage: "",
    category: "Sedan",
    image: null,
  });

  const next = () => setStep(2);
  const prev = () => setStep(1);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    setCar((c) => ({ ...c, image: file || null }));
  };

  const publish = async () => {
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

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
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
              {[
                ["make", "Make"],
                ["model", "Model"],
                ["year", "Year"],
                ["dailyRate", "Daily Rate (RM)"],
                ["seats", "Seats"],
                ["transmission", "Transmission"],
                ["fuelType", "Fuel Type"],
                ["mileage", "Mileage"],
                ["category", "Category"],
              ].map(([key, label]) => (
                <label key={key} className="text-sm text-slate-200 space-y-1">
                  {label}
                  <input
                    value={car[key]}
                    onChange={(e) => setCar((c) => ({ ...c, [key]: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  />
                </label>
              ))}
            </div>

            <div className="space-y-2">
              <label className="text-sm text-slate-200">Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFile}
                className="w-full text-sm"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={next}
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

export default HostAddCars;