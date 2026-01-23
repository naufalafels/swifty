import React, { useState } from "react";
import * as authService from "../utils/authService";

const HostOnboardPage = () => {
  const [form, setForm] = useState({
    payoutAccountRef: "",
    notes: "",
    renterUserIdLookup: "",
  });
  const [message, setMessage] = useState("");
  const [kycLookup, setKycLookup] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const becomeHost = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const res = await authService.becomeHost({
        payoutAccountRef: form.payoutAccountRef,
        notes: form.notes,
      });
      setMessage(res.message || "Host enabled");
    } catch (err) {
      setMessage(err?.response?.data?.message || "Failed to enable host");
    } finally {
      setLoading(false);
    }
  };

  const lookupKyc = async () => {
    setLookupLoading(true);
    setKycLookup(null);
    setMessage("");
    try {
      const res = await authService.hostGetRenterKyc(form.renterUserIdLookup);
      setKycLookup(res.renter);
    } catch (err) {
      setMessage(err?.response?.data?.message || "Lookup failed");
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-10">
      <section>
        <h1 className="text-2xl font-bold mb-3">Become a Host</h1>
        <p className="text-sm text-gray-600 mb-4">
          Provide your payout reference (e.g., bank or Razorpay Curlec mandate ref). We do not store card/PAN data.
        </p>

        <form onSubmit={becomeHost} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Payout Account Reference</label>
            <input
              name="payoutAccountRef"
              value={form.payoutAccountRef}
              onChange={onChange}
              className="w-full border rounded px-3 py-2"
              placeholder="e.g., CURLEC-REF-123"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes (optional)</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={onChange}
              className="w-full border rounded px-3 py-2"
              rows={3}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 text-white rounded px-4 py-2 font-semibold hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading ? "Saving..." : "Enable Host"}
          </button>
        </form>
      </section>

      <section className="border-t pt-6">
        <h2 className="text-xl font-semibold mb-3">Host: Validate Renter KYC</h2>
        <p className="text-sm text-gray-600 mb-3">
          Enter the renter's userId to fetch their submitted NRIC/Passport metadata. Validate in person before handing over keys.
        </p>
        <div className="flex gap-2 mb-3">
          <input
            name="renterUserIdLookup"
            value={form.renterUserIdLookup}
            onChange={onChange}
            className="flex-1 border rounded px-3 py-2"
            placeholder="Renter userId (ObjectId)"
          />
          <button
            type="button"
            onClick={lookupKyc}
            disabled={lookupLoading || !form.renterUserIdLookup}
            className="bg-blue-600 text-white rounded px-3 py-2 font-semibold hover:bg-blue-700 disabled:opacity-60"
          >
            {lookupLoading ? "Checking..." : "Fetch KYC"}
          </button>
        </div>

        {kycLookup && (
          <div className="p-3 border rounded text-sm space-y-1">
            <div className="font-semibold">Renter: {kycLookup.name} ({kycLookup.email})</div>
            <div>Status: {kycLookup.kyc?.status}</div>
            <div>ID Type: {kycLookup.kyc?.idType}</div>
            <div>ID Number: {kycLookup.kyc?.idNumber}</div>
            <div>Country: {kycLookup.kyc?.idCountry}</div>
            {kycLookup.kyc?.frontImageUrl && (
              <div className="text-blue-600">
                Front: <a className="underline" href={kycLookup.kyc.frontImageUrl} target="_blank" rel="noreferrer">view</a>
              </div>
            )}
            {kycLookup.kyc?.backImageUrl && (
              <div className="text-blue-600">
                Back: <a className="underline" href={kycLookup.kyc.backImageUrl} target="_blank" rel="noreferrer">view</a>
              </div>
            )}
          </div>
        )}

        {message && <div className="mt-3 text-sm text-blue-700">{message}</div>}
      </section>
    </div>
  );
};

export default HostOnboardPage;