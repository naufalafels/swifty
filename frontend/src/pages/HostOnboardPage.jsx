import React, { useState } from 'react';
import { FaCheckCircle, FaChevronLeft, FaChevronRight, FaRocket, FaList, FaCarSide } from 'react-icons/fa';
import * as authService from '../utils/authService';
import { toast } from 'react-toastify';

const HostOnboardPage = () => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [company, setCompany] = useState({
    payoutAccountRef: '',
    companyName: '',
    ssmNumber: '',
    nricNumber: '',
    notes: '',
  });

  const [vehicle, setVehicle] = useState({
    make: '',
    model: '',
    year: '',
    dailyRate: '',
    seats: '',
    shiftType: '',
    fuel: '',
    carType: '',
  });

  const next = () => setStep((s) => Math.min(3, s + 1));
  const prev = () => setStep((s) => Math.max(1, s - 1));

  const publish = async () => {
    setLoading(true);
    try {
      await authService.becomeHost({
        payoutAccountRef: company.payoutAccountRef,
        notes: company.notes,
      });
      toast.success('Host onboarding submitted. Admin will review.');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to submit host onboarding');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center gap-2 text-gray-500 text-2xl font-bold">
        <FaRocket className="text-emerald-400" /> Become a Host
      </div>
      <div className="text-sm text-slate-400">
        Step-by-step wizard: Company → Vehicle → Publish (with summary).
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs text-center">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`rounded-lg border px-2 py-2 ${
              s === step ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-900 text-slate-200 border-slate-800'
            }`}
          >
            {s === 1 ? 'Tell us about your company' : s === 2 ? 'Add a vehicle' : 'Publish'}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="text-sm text-white font-semibold flex items-center gap-2">
            <FaList /> Company details
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm text-slate-200">Company name
              <input
                value={company.companyName}
                onChange={(e) => setCompany({ ...company, companyName: e.target.value })}
                className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
                required
              />
            </label>
            <label className="text-sm text-slate-200">SSM number
              <input
                value={company.ssmNumber}
                onChange={(e) => setCompany({ ...company, ssmNumber: e.target.value })}
                className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
                required
              />
            </label>
            <label className="text-sm text-slate-200">NRIC number
              <input
                value={company.nricNumber}
                onChange={(e) => setCompany({ ...company, nricNumber: e.target.value })}
                className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
                required
              />
            </label>
            <label className="text-sm text-slate-200">Payout account reference (Razorpay Curlec)
              <input
                value={company.payoutAccountRef}
                onChange={(e) => setCompany({ ...company, payoutAccountRef: e.target.value })}
                className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
                placeholder="CURLEC-REF-123"
                required
              />
            </label>
          </div>
          <label className="text-sm text-slate-200">Notes (optional)
            <textarea
              value={company.notes}
              onChange={(e) => setCompany({ ...company, notes: e.target.value })}
              className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
              rows={3}
            />
          </label>
        </div>
      )}

      {step === 2 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="text-sm text-white font-semibold flex items-center gap-2">
            <FaCarSide /> Vehicle details
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm text-slate-200">Make
              <input
                value={vehicle.make}
                onChange={(e) => setVehicle({ ...vehicle, make: e.target.value })}
                className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
                required
              />
            </label>
            <label className="text-sm text-slate-200">Model
              <input
                value={vehicle.model}
                onChange={(e) => setVehicle({ ...vehicle, model: e.target.value })}
                className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
                required
              />
            </label>
            <label className="text-sm text-slate-200">Manufactured year
              <input
                value={vehicle.year}
                onChange={(e) => setVehicle({ ...vehicle, year: e.target.value })}
                className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
                placeholder="2023"
                required
              />
            </label>
            <label className="text-sm text-slate-200">Daily rate (MYR)
              <input
                value={vehicle.dailyRate}
                onChange={(e) => setVehicle({ ...vehicle, dailyRate: e.target.value })}
                className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
                placeholder="Flexible pricing supported"
                required
              />
            </label>
            <label className="text-sm text-slate-200">Seats
              <select
                value={vehicle.seats}
                onChange={(e) => setVehicle({ ...vehicle, seats: e.target.value })}
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
                value={vehicle.shiftType}
                onChange={(e) => setVehicle({ ...vehicle, shiftType: e.target.value })}
                className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
              >
                <option value="">Select</option>
                <option>Automatic</option>
                <option>Manual</option>
              </select>
            </label>
            <label className="text-sm text-slate-200">Fuel
              <select
                value={vehicle.fuel}
                onChange={(e) => setVehicle({ ...vehicle, fuel: e.target.value })}
                className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
              >
                <option value="">Select</option>
                <option>Petrol</option>
                <option>Diesel</option>
                <option>Hybrid</option>
                <option>Electric</option>
              </select>
            </label>
            <label className="text-sm text-slate-200">Car type
              <select
                value={vehicle.carType}
                onChange={(e) => setVehicle({ ...vehicle, carType: e.target.value })}
                className="w-full mt-1 p-2 rounded bg-slate-800 border border-slate-700 text-white"
              >
                <option value="">Select</option>
                {['Hatchback', 'Sedan', 'SUV', 'MPV', 'Truck', 'Van', 'Luxury', 'Classic'].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="text-sm text-white font-semibold flex items-center gap-2">
            <FaCheckCircle className="text-emerald-400" /> Summary
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-sm text-slate-200">
            <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3">
              <div className="font-semibold text-white mb-1">Company</div>
              <div>Company name: {company.companyName || '—'}</div>
              <div>SSM: {company.ssmNumber || '—'}</div>
              <div>NRIC: {company.nricNumber || '—'}</div>
              <div>Payout ref: {company.payoutAccountRef || '—'}</div>
            </div>
            <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3">
              <div className="font-semibold text-white mb-1">Vehicle</div>
              <div>
                {vehicle.make || 'Make'} {vehicle.model || 'Model'} {vehicle.year ? `(${vehicle.year})` : ''}
              </div>
              <div>Daily rate: {vehicle.dailyRate || '—'}</div>
              <div>Seats: {vehicle.seats || '—'} | Shift: {vehicle.shiftType || '—'}</div>
              <div>Fuel: {vehicle.fuel || '—'} | Type: {vehicle.carType || '—'}</div>
            </div>
          </div>
          <div className="text-xs text-slate-400">
            When you publish, details go to Admin for validation. After approval, you will see Host Centre.
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={prev}
          disabled={step === 1}
          className="px-4 py-3 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800 disabled:opacity-50 inline-flex items-center gap-2"
        >
          <FaChevronLeft /> Back
        </button>
        {step < 3 ? (
          <button
            onClick={next}
            className="px-4 py-3 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center gap-2"
          >
            Next <FaChevronRight />
          </button>
        ) : (
          <button
            onClick={publish}
            disabled={loading}
            className="px-4 py-3 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center gap-2"
          >
            <FaCheckCircle /> {loading ? 'Publishing...' : 'Publish to marketplace'}
          </button>
        )}
      </div>
    </div>
  );
};

export default HostOnboardPage;