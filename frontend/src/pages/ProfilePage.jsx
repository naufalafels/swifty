import React, { useEffect, useState } from "react";
import { FaCheckCircle, FaExclamationTriangle, FaUserShield, FaHome } from "react-icons/fa";
import api from "../utils/api";
import * as authService from "../utils/authService";
import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get("/api/auth/me");
        if (mounted) {
          const profile = res?.data?.user ?? res?.data ?? null;
          setUser(profile);
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
    return () => { mounted = false; };
  }, []);

  const isVerified = !!user?.kyc?.status && user.kyc.status === "approved";
  const isHost = Array.isArray(user?.roles) && user.roles.includes("host");
  const verifiedLabel = isVerified ? "Verified" : "Not Verified";
  const hostLabel = isHost ? "Approved Host" : "Not a Host";

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Your Profile</h1>
          <p className="text-sm text-slate-400">Identity, host status, and essentials.</p>
        </div>
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-700 text-slate-200 hover:bg-slate-800"
        >
          <FaHome /> Frontpage
        </button>
      </div>

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
              <span className={`text-xs px-2 py-1 rounded-full ${isVerified ? "bg-emerald-900 text-emerald-100" : "bg-amber-900 text-amber-100"}`}>
                {verifiedLabel}
              </span>
              <span className={`text-xs px-2 py-1 rounded-full ${isHost ? "bg-blue-900 text-blue-100" : "bg-slate-800 text-slate-100"}`}>
                {hostLabel}
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-white font-semibold">
                <FaUserShield /> Verification
              </div>
              <p className="text-sm text-slate-300">
                KYC Status: {user?.kyc?.status || "not submitted"}
              </p>
              {user?.kyc?.status === "approved" ? (
                <div className="inline-flex items-center gap-2 text-emerald-200 text-sm">
                  <FaCheckCircle /> You are verified.
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 text-amber-200 text-sm">
                  <FaExclamationTriangle /> Submit/complete KYC to get verified.
                </div>
              )}
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-white font-semibold">
                <FaCheckCircle /> Host Status
              </div>
              <p className="text-sm text-slate-300">
                {isHost
                  ? "You are approved as a host. Manage your cars and bookings in Host Centre."
                  : "Not approved as a host yet. Apply and wait for admin approval."}
              </p>
              <div className="flex flex-wrap gap-2">
                {!isHost && (
                  <button
                    onClick={() => navigate("/host/onboard")}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600 text-white hover:bg-amber-700 text-sm"
                  >
                    Become a Host
                  </button>
                )}
                {isHost && (
                  <button
                    onClick={() => navigate("/host/dashboard")}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-700 text-white hover:bg-emerald-800 text-sm"
                  >
                    Host Centre
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;