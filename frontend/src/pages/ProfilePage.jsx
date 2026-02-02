import React, { useEffect, useMemo, useState } from "react";
import { FaCheckCircle, FaExclamationTriangle, FaUserShield, FaHome, FaEdit } from "react-icons/fa";
import api from "../utils/api";
import * as authService from "../utils/authService";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const FloatyModal = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 transform transition-transform duration-300 scale-100 animate-slide-up">
        {children}
        <button onClick={onClose} className="mt-4 w-full bg-gray-500 text-white py-2 rounded hover:bg-gray-600">
          Close
        </button>
      </div>
    </div>
  );
};

const ProfilePage = () => {
  const [user, setUser] = useState(() => {
    try {
      return authService.getCurrentUser?.() || null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(!user);
  const [error, setError] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", address: "" });
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get("/api/auth/me");
        if (mounted) {
          const profile = res?.data?.user ?? res?.data ?? null;
          setUser(profile);
          setEditForm({
            name: profile?.name || "",
            email: profile?.email || "",
            phone: profile?.phone || "",
            address: profile?.address || "",
          });
          try {
            authService.setCurrentUser(profile);
          } catch {}
        }
      } catch (err) {
        if (mounted) setError(err?.response?.data?.message || "Failed to load profile");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.put("/api/auth/update-profile", editForm);
      setUser(res.data.user);
      authService.setCurrentUser(res.data.user);
      setIsEditModalOpen(false);
      toast.success("Profile updated!");
    } catch (err) {
      setError(err?.response?.data?.message || "Update failed");
    } finally {
      setLoading(false);
    }
  };

  const isVerified = !!user?.kyc?.status && user.kyc.status === "approved";
  const isHost = Array.isArray(user?.roles) && user.roles.includes("host");
  const verifiedLabel = isVerified ? "Verified" : "Not Verified";
  const hostLabel = isHost ? "Approved Host" : "Not a Host";

  const completion = useMemo(() => {
    const checks = [
      { label: "Name", done: !!user?.name },
      { label: "Email", done: !!user?.email },
      { label: "Phone", done: !!user?.phone },
      { label: "Address", done: !!user?.address },
      { label: "KYC Approved", done: isVerified },
    ];
    // Host payout ref only matters if the user is a host / applying as host
    if (isHost || user?.hostProfile) {
      checks.push({ label: "Host Payout Ref", done: !!user?.hostProfile?.payoutAccountRef });
    }
    const done = checks.filter((c) => c.done).length;
    const percent = Math.round((done / checks.length) * 100);
    return { percent, checks };
  }, [user, isVerified, isHost]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Your Profile</h1>
          <p className="text-sm text-slate-400">Identity, host status, and essentials.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-700 text-slate-200 hover:bg-slate-800"
          >
            <FaEdit /> Edit Profile
          </button>
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-700 text-slate-200 hover:bg-slate-800"
          >
            <FaHome /> Frontpage
          </button>
        </div>
      </div>

      {completion.percent < 100 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between text-sm text-slate-200">
            <div className="font-semibold">Complete your profile</div>
            <div>{completion.percent}%</div>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="h-2 bg-gradient-to-r from-orange-400 via-amber-400 to-emerald-400 transition-all"
              style={{ width: `${completion.percent}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {completion.checks.map((c) => (
              <span
                key={c.label}
                className={`px-2 py-1 rounded-full border ${
                  c.done ? "border-emerald-500 text-emerald-200 bg-emerald-900/30" : "border-amber-400 text-amber-200 bg-amber-900/30"
                }`}
              >
                {c.done ? "✓" : "…"} {c.label}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="px-3 py-2 rounded-md bg-orange-600 text-white hover:bg-orange-700"
            >
              Complete profile now
            </button>
            {!isVerified && (
              <button
                onClick={() => navigate("/kyc")}
                className="px-3 py-2 rounded-md border border-blue-400 text-blue-100 hover:bg-blue-900/40"
              >
                Submit KYC
              </button>
            )}
            {isHost && !user?.hostProfile?.payoutAccountRef && (
              <button
                onClick={() => navigate("/host/onboard")}
                className="px-3 py-2 rounded-md border border-amber-400 text-amber-100 hover:bg-amber-900/40"
              >
                Add payout details
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-slate-200">Loading profile...</div>
      ) : error ? (
        <div className="text-rose-300 text-sm">{error}</div>
      ) : (
        <div className="space-y-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-4 space-y-2">
            <div className="text-lg font-semibold text-white">{user?.name || "Unnamed user"}</div>
            <div className="text-sm text-slate-300">{user?.email || "No email"}</div>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-100">
                Roles: {(user?.roles || []).join(", ") || "user"}
              </span>
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  isVerified ? "bg-emerald-900 text-emerald-100" : "bg-amber-900 text-amber-100"
                }`}
              >
                {verifiedLabel}
              </span>
              {isHost && (
                <span className="text-xs px-2 py-1 rounded-full bg-blue-900 text-blue-100">{hostLabel}</span>
              )}
            </div>
          </div>
        </div>
      )}

      <FloatyModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)}>
        <h2 className="text-xl font-bold mb-4">Edit Profile</h2>
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Name"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            className="w-full p-2 border rounded"
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={editForm.email}
            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
            className="w-full p-2 border rounded"
            required
          />
          <input
            type="tel"
            placeholder="Phone"
            value={editForm.phone}
            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
            className="w-full p-2 border rounded"
          />
          <input
            type="text"
            placeholder="Address"
            value={editForm.address}
            onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
            className="w-full p-2 border rounded"
          />
          <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700" disabled={loading}>
            {loading ? "Updating..." : "Update"}
          </button>
        </form>
      </FloatyModal>
    </div>
  );
};

export default ProfilePage;