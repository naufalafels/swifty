import React, { useEffect, useState } from "react";
import * as authService from "../utils/authService";

const KycPage = () => {
  const [form, setForm] = useState({
    idType: "passport",
    idNumber: "",
    idCountry: "MY",
    frontImageUrl: "",
    backImageUrl: "",
  });
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const r = await authService.getKyc();
      setStatus(r.kyc || { status: "not_submitted" });
    } catch {
      setStatus(null);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const res = await authService.submitKyc(form);
      setMessage(res.message || "Submitted");
      setStatus(res.kyc);
    } catch (err) {
      setMessage(err?.response?.data?.message || "Failed to submit");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-4">Identity Verification (NRIC / Passport)</h1>
      <p className="text-sm text-gray-600 mb-4">
        You must bring a valid driving license when collecting the car. We only collect NRIC/Passport for the host to verify in person.
      </p>

      {status && (
        <div className="mb-4 p-3 rounded border text-sm">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Status: {status.status}</span>
            {status.statusReason && <span className="text-red-600">Reason: {status.statusReason}</span>}
          </div>
          {status.submittedAt && <div>Submitted: {new Date(status.submittedAt).toLocaleString()}</div>}
          {status.reviewedAt && <div>Reviewed: {new Date(status.reviewedAt).toLocaleString()}</div>}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">ID Type</label>
          <select
            name="idType"
            value={form.idType}
            onChange={onChange}
            className="w-full border rounded px-3 py-2"
          >
            <option value="passport">Passport</option>
            <option value="nric">NRIC</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">ID Number</label>
          <input
            name="idNumber"
            value={form.idNumber}
            onChange={onChange}
            className="w-full border rounded px-3 py-2"
            placeholder="e.g., A1234567"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">ID Country</label>
          <input
            name="idCountry"
            value={form.idCountry}
            onChange={onChange}
            className="w-full border rounded px-3 py-2"
            placeholder="MY"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Front Image URL (optional)</label>
          <input
            name="frontImageUrl"
            value={form.frontImageUrl}
            onChange={onChange}
            className="w-full border rounded px-3 py-2"
            placeholder="https://..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Back Image URL (optional)</label>
          <input
            name="backImageUrl"
            value={form.backImageUrl}
            onChange={onChange}
            className="w-full border rounded px-3 py-2"
            placeholder="https://..."
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white rounded px-4 py-2 font-semibold hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "Submitting..." : "Submit KYC"}
        </button>
      </form>

      {message && <div className="mt-4 text-sm text-blue-700">{message}</div>}
    </div>
  );
};

export default KycPage;