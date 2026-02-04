import React, { useEffect, useMemo, useState } from "react";
import {
  FaCheckCircle,
  FaExclamationTriangle,
  FaUserShield,
  FaHome,
  FaEdit,
  FaChevronDown,
  FaChevronUp,
  FaIdBadge,
  FaInfoCircle,
  FaPlusCircle,
  FaCar,
  FaCalendarAlt,
  FaExternalLinkAlt,
  FaMapMarkerAlt,
  FaShieldAlt,
  FaPhone,
  FaEnvelope,
} from "react-icons/fa";
import api from "../utils/api";
import * as authService from "../utils/authService";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const Collapsible = ({ title, subtitle, children, defaultOpen = false, badge }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-xl shadow-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/70 transition"
      >
        <div>
          <div className="text-sm font-semibold text-white flex items-center gap-2">
            {title}
            {badge ? (
              <span className="px-2 py-0.5 text-[11px] rounded-full bg-slate-800 text-slate-200 border border-slate-700">
                {badge}
              </span>
            ) : null}
          </div>
          {subtitle ? <div className="text-xs text-slate-400 mt-0.5">{subtitle}</div> : null}
        </div>
        {open ? <FaChevronUp className="text-slate-300" /> : <FaChevronDown className="text-slate-300" />}
      </button>
      {open && <div className="border-t border-slate-800 px-4 py-4 space-y-4">{children}</div>}
    </div>
  );
};

const Field = ({ label, children, required }) => (
  <label className="block">
    <div className="text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
      {label}
      {required ? <span className="text-rose-400">*</span> : null}
    </div>
    {children}
  </label>
);

const Toggle = ({ label, checked, onChange }) => (
  <div className="flex items-center justify-between py-2">
    <div className="text-sm text-slate-200">{label}</div>
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={onChange} />
      <div className="w-10 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:bg-emerald-500 transition-colors"></div>
      <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transform transition peer-checked:translate-x-5" />
    </label>
  </div>
);

const MetricCard = ({ icon: Icon, label, value, accent = "emerald" }) => {
  const accentMap = {
    emerald: "from-emerald-500/70 to-emerald-600/50 text-emerald-100 border-emerald-500/30",
    blue: "from-blue-500/70 to-blue-600/50 text-blue-100 border-blue-500/30",
    amber: "from-amber-500/70 to-amber-600/50 text-amber-100 border-amber-500/30",
    rose: "from-rose-500/70 to-rose-600/50 text-rose-100 border-rose-500/30",
  };
  return (
    <div className={`rounded-xl border p-4 bg-gradient-to-br ${accentMap[accent]} shadow-lg flex items-center gap-3`}>
      <div className="p-2 rounded-lg bg-black/20">
        <Icon size={22} />
      </div>
      <div className="flex-1">
        <div className="text-xs uppercase tracking-wide opacity-80">{label}</div>
        <div className="text-xl font-semibold">{value}</div>
      </div>
    </div>
  );
};

const Step = ({ step, title, body, done }) => (
  <div className="flex gap-3 items-start">
    <div
      className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
        done ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-200 border border-slate-700"
      }`}
    >
      {step}
    </div>
    <div className="flex-1">
      <div className="text-sm font-semibold text-white flex items-center gap-2">
        {title} {done ? <FaCheckCircle className="text-emerald-400" /> : null}
      </div>
      <div className="text-xs text-slate-300 mt-1 leading-relaxed">{body}</div>
    </div>
  </div>
);

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
  const [editForm, setEditForm] = useState({
    legalName: "",
    birthdate: "",
    preferredName: "",
    phone: "",
    email: "",
    residentialAddress: "",
    mailingAddress: "",
    sameMailing: true,
    emergencyName: "",
    emergencyRelationship: "",
    emergencyEmail: "",
    emergencyPhone: "",
    about: "",
    showCity: true,
    showAbout: true,
  });

  const [securityForm, setSecurityForm] = useState({ password: "", confirm: "" });
  const [hostVehicleForm, setHostVehicleForm] = useState({
    make: "",
    model: "",
    year: "",
    dailyRate: "",
    seats: "",
    gasUsage: "",
    shiftType: "",
    carType: "",
    fuel: "",
    petrolType: "",
  });

  const [identitySubmitted, setIdentitySubmitted] = useState(false);
  const [hostNRICSubmitted, setHostNRICSubmitted] = useState(false);
  const [vehicleImage, setVehicleImage] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get("/api/auth/me");
        if (mounted) {
          const profile = res?.data?.user ?? res?.data ?? null;
          setUser(profile);
          setEditForm((prev) => ({
            ...prev,
            legalName: profile?.legalName || "",
            birthdate: profile?.birthdate || "",
            preferredName: profile?.preferredName || profile?.name || "",
            phone: profile?.phone || "",
            email: profile?.email || "",
            residentialAddress: profile?.address || "",
            mailingAddress: profile?.mailingAddress || profile?.address || "",
            about: profile?.about || "",
            showCity: profile?.privacy?.showCity ?? true,
            showAbout: profile?.privacy?.showAbout ?? true,
          }));
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

  const isVerified = !!user?.kyc?.status && user.kyc.status === "approved";
  const isHost = Array.isArray(user?.roles) && user.roles.includes("host");
  const verifiedLabel = isVerified ? "Verified" : "Not Verified";
  const hostLabel = isHost ? "Approved Host" : "Not a Host";

  const completion = useMemo(() => {
    const checks = [
      { label: "Legal Name", done: !!editForm.legalName },
      { label: "Birthdate", done: !!editForm.birthdate },
      { label: "Preferred Name", done: !!editForm.preferredName },
      { label: "Phone", done: !!editForm.phone },
      { label: "Email", done: !!editForm.email },
      { label: "Residential Address", done: !!editForm.residentialAddress },
      { label: "Mailing Address", done: !!editForm.mailingAddress },
      { label: "Emergency Contact", done: !!editForm.emergencyName && !!editForm.emergencyPhone && !!editForm.emergencyRelationship },
      { label: "About", done: !!editForm.about },
      { label: "Identity Verification", done: isVerified || identitySubmitted },
    ];
    if (isHost || user?.hostProfile) {
      checks.push({ label: "Host Payout Ref", done: !!user?.hostProfile?.payoutAccountRef });
    }
    const done = checks.filter((c) => c.done).length;
    const percent = Math.round((done / checks.length) * 100);
    return { percent, checks };
  }, [editForm, isVerified, identitySubmitted, isHost, user]);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        legalName: editForm.legalName,
        birthdate: editForm.birthdate,
        preferredName: editForm.preferredName,
        phone: editForm.phone,
        email: editForm.email,
        address: editForm.residentialAddress,
        mailingAddress: editForm.sameMailing ? editForm.residentialAddress : editForm.mailingAddress,
        emergencyContact: {
          name: editForm.emergencyName,
          relationship: editForm.emergencyRelationship,
          email: editForm.emergencyEmail,
          phone: editForm.emergencyPhone,
        },
        about: editForm.about,
        privacy: {
          showCity: editForm.showCity,
          showAbout: editForm.showAbout,
        },
      };
      const res = await api.put("/api/auth/update-profile", payload);
      setUser(res.data.user);
      authService.setCurrentUser(res.data.user);
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Update failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (securityForm.password !== securityForm.confirm) {
      toast.error("Passwords do not match");
      return;
    }
    try {
      await api.put("/api/auth/update-password", {
        password: securityForm.password,
      });
      toast.success("Password updated");
      setSecurityForm({ password: "", confirm: "" });
    } catch (err) {
      toast.error(err?.response?.data?.message || "Password update failed");
    }
  };

  const handleIdentitySubmit = async () => {
    setIdentitySubmitted(true);
    toast.info("Identity submitted to Admin for verification.");
  };

  const handleHostNRICSubmit = async () => {
    setHostNRICSubmitted(true);
    toast.info("Host NRIC & Razorpay Curlec details submitted to Admin.");
  };

  const handleVehicleSave = async (e) => {
    e.preventDefault();
    // Stubbed; integrate with your /api/host/vehicles endpoint
    toast.success("Vehicle saved (stub). Add API integration when ready.");
  };

  const hostStats = {
    totalCars: user?.hostProfile?.cars?.length || 3,
    approved: 2,
    cancellations: 1,
    inService: 1,
  };

  const calendarHolidays = ["2026-01-01", "2026-02-01", "2026-04-10"]; // placeholder

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <FaUserShield className="text-emerald-400" /> Profile Centre
          </h1>
          <p className="text-sm text-slate-400">
            Enterprise-grade profile, security, verification, and host operations.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-700 text-slate-200 hover:bg-slate-800"
          >
            <FaHome /> Frontpage
          </button>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <FaInfoCircle /> View summary
          </button>
        </div>
      </div>

      {/* Completion */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-4 shadow-lg">
        <div className="flex items-center justify-between text-sm text-slate-200">
          <div className="font-semibold">Profile completeness</div>
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
                c.done
                  ? "border-emerald-500 text-emerald-200 bg-emerald-900/30"
                  : "border-amber-400 text-amber-200 bg-amber-900/30"
              }`}
            >
              {c.done ? "✓" : "…"} {c.label}
            </span>
          ))}
        </div>
      </div>

      {/* Summary header (a.v) */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 flex gap-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 border border-slate-700 flex items-center justify-center text-2xl text-white shadow-inner">
              {user?.preferredName?.[0]?.toUpperCase() || user?.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="text-xl font-semibold text-white">
                  {user?.preferredName || user?.name || "Unnamed user"}
                </div>
                {isVerified ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-emerald-900/60 text-emerald-100 border border-emerald-700 rounded-full">
                    <FaCheckCircle /> Identity verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-amber-900/60 text-amber-100 border border-amber-700 rounded-full">
                    <FaExclamationTriangle /> Identity verification pending
                  </span>
                )}
              </div>
              <div className="text-sm text-slate-300 flex items-center gap-2">
                <FaMapMarkerAlt className="text-emerald-400" />
                {user?.city && user?.country && editForm.showCity
                  ? `${user.city}, ${user.country}`
                  : "Home city hidden"}
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 rounded-full bg-slate-800 text-slate-100">
                  Roles: {(user?.roles || []).join(", ") || "user"}
                </span>
                <span
                  className={`px-2 py-1 rounded-full ${
                    isVerified ? "bg-emerald-900 text-emerald-100" : "bg-amber-900 text-amber-100"
                  }`}
                >
                  {verifiedLabel}
                </span>
                {isHost ? (
                  <span className="px-2 py-1 rounded-full bg-blue-900 text-blue-100">{hostLabel}</span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
            <MetricCard icon={FaIdBadge} label="Bookings" value={user?.stats?.bookings ?? 18} accent="emerald" />
            <MetricCard icon={FaCheckCircle} label="Completed Trips" value={user?.stats?.completedTrips ?? 14} accent="blue" />
            <MetricCard icon={FaCalendarAlt} label="Years on Swifty" value={user?.stats?.years ?? 2} accent="amber" />
            <MetricCard icon={FaShieldAlt} label="Verification" value={isVerified ? "Verified" : "Pending"} accent="rose" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => toast.info("Open edit modal from summary")}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-700 text-slate-200 hover:bg-slate-800"
          >
            <FaEdit /> Edit profile
          </button>
          <button
            onClick={handleIdentitySubmit}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-emerald-600 text-emerald-100 hover:bg-emerald-900/40"
          >
            <FaUserShield /> Submit/Resubmit identity
          </button>
        </div>
      </div>

      {/* Collapsible sections a.i - a.iv */}
      <div className="space-y-4">
        {/* a.i Professional Profile */}
        <Collapsible title="a.i Professional Profile" subtitle="Enterprise-grade UI/UX for hosts and users" defaultOpen>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Legal Name" required>
              <input
                value={editForm.legalName}
                onChange={(e) => setEditForm({ ...editForm, legalName: e.target.value })}
                className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white"
                placeholder="As per ID"
              />
            </Field>
            <Field label="Birthdate" required>
              <input
                type="date"
                value={editForm.birthdate}
                onChange={(e) => setEditForm({ ...editForm, birthdate: e.target.value })}
                className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white"
              />
            </Field>
            <Field label="Preferred First Name">
              <input
                value={editForm.preferredName}
                onChange={(e) => setEditForm({ ...editForm, preferredName: e.target.value })}
                className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white"
                placeholder="Name shown to others"
              />
            </Field>
            <Field label="Phone (secure)" required>
              <div className="flex items-center gap-2">
                <FaPhone className="text-slate-400" />
                <input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white"
                  placeholder="+60 123-456-789"
                />
              </div>
            </Field>
            <Field label="Email (secure)" required>
              <div className="flex items-center gap-2">
                <FaEnvelope className="text-slate-400" />
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white"
                  placeholder="you@example.com"
                />
              </div>
            </Field>
            <Field label="Identity Verification" required>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center justify-between bg-slate-800 rounded-lg border border-slate-700 p-3">
                <div className="text-sm text-slate-200 flex items-center gap-2">
                  <FaUserShield className="text-emerald-400" />
                  Status: {isVerified ? "Verified" : identitySubmitted ? "Submitted to Admin" : "Not submitted"}
                </div>
                <button
                  type="button"
                  onClick={handleIdentitySubmit}
                  className="px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  {isVerified ? "Re-submit" : "Submit to Admin"}
                </button>
              </div>
            </Field>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Residential Address" required>
              <textarea
                value={editForm.residentialAddress}
                onChange={(e) => setEditForm({ ...editForm, residentialAddress: e.target.value })}
                className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white"
                rows={3}
                placeholder="Country / Region, Building, Street, City, State, Postcode"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Add Google Places autocomplete here for production.
              </p>
            </Field>
            <Field label="Mailing Address">
              <div className="flex items-center gap-2 mb-2">
                <input
                  id="sameMailing"
                  type="checkbox"
                  checked={editForm.sameMailing}
                  onChange={(e) => setEditForm({ ...editForm, sameMailing: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="sameMailing" className="text-sm text-slate-200">
                  Same as Residential Address?
                </label>
              </div>
              <textarea
                value={editForm.sameMailing ? editForm.residentialAddress : editForm.mailingAddress}
                onChange={(e) => setEditForm({ ...editForm, mailingAddress: e.target.value })}
                disabled={editForm.sameMailing}
                className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white disabled:opacity-60"
                rows={3}
                placeholder="Country / Region, Building, Street, City, State, Postcode"
              />
            </Field>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Emergency Contact - Name" required>
              <input
                value={editForm.emergencyName}
                onChange={(e) => setEditForm({ ...editForm, emergencyName: e.target.value })}
                className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white"
                placeholder="Legal name preferred"
              />
            </Field>
            <Field label="Relationship" required>
              <input
                value={editForm.emergencyRelationship}
                onChange={(e) => setEditForm({ ...editForm, emergencyRelationship: e.target.value })}
                className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white"
                placeholder="e.g., Spouse, Parent"
              />
            </Field>
            <Field label="Emergency Email">
              <input
                type="email"
                value={editForm.emergencyEmail}
                onChange={(e) => setEditForm({ ...editForm, emergencyEmail: e.target.value })}
                className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white"
                placeholder="optional"
              />
            </Field>
            <Field label="Emergency Phone" required>
              <input
                value={editForm.emergencyPhone}
                onChange={(e) => setEditForm({ ...editForm, emergencyPhone: e.target.value })}
                className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white"
                placeholder="+60 ..."
              />
            </Field>
          </div>

          <Field label="About me">
            <textarea
              value={editForm.about}
              onChange={(e) => setEditForm({ ...editForm, about: e.target.value.slice(0, 500) })}
              className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white"
              rows={4}
              placeholder="Tell us a little bit about yourself (max 500 characters)"
            />
            <div className="text-[11px] text-slate-400 mt-1 flex justify-between">
              <span>Future hosts/guests will see this if you allow it.</span>
              <span>{editForm.about.length}/500</span>
            </div>
          </Field>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleProfileSave}
              className="px-4 py-3 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={loading}
            >
              {loading ? "Saving..." : "Save profile"}
            </button>
            <button
              onClick={() => setEditForm({ ...editForm, about: "" })}
              className="px-4 py-3 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800"
            >
              Clear About
            </button>
          </div>
        </Collapsible>

        {/* a.iii Login & Security */}
        <Collapsible title="a.iii Login & Security" subtitle="Password and account controls">
          <form onSubmit={handlePasswordUpdate} className="grid md:grid-cols-2 gap-4">
            <Field label="New Password" required>
              <input
                type="password"
                value={securityForm.password}
                onChange={(e) => setSecurityForm({ ...securityForm, password: e.target.value })}
                className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white"
                placeholder="********"
              />
            </Field>
            <Field label="Confirm Password" required>
              <input
                type="password"
                value={securityForm.confirm}
                onChange={(e) => setSecurityForm({ ...securityForm, confirm: e.target.value })}
                className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white"
                placeholder="********"
              />
            </Field>
            <div className="md:col-span-2 flex flex-wrap gap-3">
              <button type="submit" className="px-4 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                Update password
              </button>
              <button
                type="button"
                onClick={() => toast.warn("Account deactivation flow should call /api/auth/deactivate")}
                className="px-4 py-3 rounded-lg border border-rose-500 text-rose-200 hover:bg-rose-900/30"
              >
                Deactivate account (cannot be undone)
              </button>
            </div>
          </form>
        </Collapsible>

        {/* a.iv Privacy */}
        <Collapsible title="a.iv Privacy" subtitle="Control what is shown to others">
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4 space-y-3">
            <Toggle
              label="Show my home city and country"
              checked={editForm.showCity}
              onChange={(e) => setEditForm({ ...editForm, showCity: e.target.checked })}
            />
            <Toggle
              label="Show About me"
              checked={editForm.showAbout}
              onChange={(e) => setEditForm({ ...editForm, showAbout: e.target.checked })}
            />
            <p className="text-xs text-slate-400">
              Changes are saved with your profile and respected in public views.
            </p>
          </div>
        </Collapsible>
      </div>

      {/* Host onboarding a.vi */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
        <div className="flex items-center gap-2">
          <FaIdBadge className="text-emerald-400" />
          <h2 className="text-xl font-semibold text-white">a.vi Become a Host</h2>
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Step
              step={1}
              title="Tell us about your company"
              done={hostNRICSubmitted}
              body="Provide NRIC (number + front/back), company type, SSM number, and set up Razorpay Curlec (MY)."
            />
            <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4 space-y-3">
              <Field label="NRIC Number" required>
                <input
                  className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 text-white"
                  placeholder="NRIC number"
                  onChange={() => {}}
                />
              </Field>
              <Field label="NRIC Front & Back (upload placeholders)">
                <div className="flex flex-wrap gap-2">
                  <button className="px-3 py-2 rounded-md border border-slate-700 text-slate-200 hover:bg-slate-800">
                    Upload front
                  </button>
                  <button className="px-3 py-2 rounded-md border border-slate-700 text-slate-200 hover:bg-slate-800">
                    Upload back
                  </button>
                </div>
              </Field>
              <Field label="SSM Number" required>
                <input className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 text-white" placeholder="SSM number" />
              </Field>
              <Field label="Razorpay Curlec Merchant ID" required>
                <input className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 text-white" placeholder="Merchant ID" />
              </Field>
              <button
                onClick={handleHostNRICSubmit}
                className="w-full px-4 py-3 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Submit to Admin
              </button>
            </div>
            <Step
              step={2}
              title="Add a vehicle"
              done={false}
              body="Provide make, model, year, pricing (flexible by date/season), seats, gas usage, shift, car type, fuel, petrol type."
            />
            <Step
              step={3}
              title="Publish to marketplace"
              done={false}
              body="After Admin validation, your vehicle goes live. Hosts details + Razorpay Curlec ID sent to Admin."
            />
          </div>

          <div className="space-y-4 bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <form className="space-y-3" onSubmit={handleVehicleSave}>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Make" required>
                  <input
                    value={hostVehicleForm.make}
                    onChange={(e) => setHostVehicleForm({ ...hostVehicleForm, make: e.target.value })}
                    className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 text-white"
                    placeholder="Toyota"
                  />
                </Field>
                <Field label="Model" required>
                  <input
                    value={hostVehicleForm.model}
                    onChange={(e) => setHostVehicleForm({ ...hostVehicleForm, model: e.target.value })}
                    className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 text-white"
                    placeholder="Camry"
                  />
                </Field>
                <Field label="Manufactured Year" required>
                  <input
                    value={hostVehicleForm.year}
                    onChange={(e) => setHostVehicleForm({ ...hostVehicleForm, year: e.target.value })}
                    className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 text-white"
                    placeholder="2023"
                  />
                </Field>
                <Field label="Daily Rate (MYR)" required>
                  <input
                    value={hostVehicleForm.dailyRate}
                    onChange={(e) => setHostVehicleForm({ ...hostVehicleForm, dailyRate: e.target.value })}
                    className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 text-white"
                    placeholder="Flexible pricing supported"
                  />
                </Field>
                <Field label="Seats" required>
                  <select
                    value={hostVehicleForm.seats}
                    onChange={(e) => setHostVehicleForm({ ...hostVehicleForm, seats: e.target.value })}
                    className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 text-white"
                  >
                    <option value="">Select seats</option>
                    {[2, 4, 5, 7, 8, 12].map((s) => (
                      <option key={s} value={s}>
                        {s} seater
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Gas Usage (km/l)">
                  <input
                    value={hostVehicleForm.gasUsage}
                    onChange={(e) => setHostVehicleForm({ ...hostVehicleForm, gasUsage: e.target.value })}
                    className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 text-white"
                    placeholder="e.g., 18.9 km/l"
                  />
                </Field>
                <Field label="Shift Type" required>
                  <select
                    value={hostVehicleForm.shiftType}
                    onChange={(e) => setHostVehicleForm({ ...hostVehicleForm, shiftType: e.target.value })}
                    className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 text-white"
                  >
                    <option value="">Select</option>
                    <option>Automatic</option>
                    <option>Manual</option>
                  </select>
                </Field>
                <Field label="Car Type" required>
                  <select
                    value={hostVehicleForm.carType}
                    onChange={(e) => setHostVehicleForm({ ...hostVehicleForm, carType: e.target.value })}
                    className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 text-white"
                  >
                    <option value="">Select</option>
                    {["Hatchback", "Sedan", "SUV", "MPV", "Truck", "Van", "Luxury", "Classic"].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Car Fuel" required>
                  <select
                    value={hostVehicleForm.fuel}
                    onChange={(e) => setHostVehicleForm({ ...hostVehicleForm, fuel: e.target.value })}
                    className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 text-white"
                  >
                    <option value="">Select</option>
                    {["Petrol", "Diesel", "Hybrid", "Electric"].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </Field>
                {hostVehicleForm.fuel === "Petrol" && (
                  <Field label="Petrol Type">
                    <select
                      value={hostVehicleForm.petrolType}
                      onChange={(e) => setHostVehicleForm({ ...hostVehicleForm, petrolType: e.target.value })}
                      className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 text-white"
                    >
                      <option value="">Select</option>
                      {["Ron95", "Ron97", "Ron100", "Ethanol"].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>

              <Field label="Upload Vehicle Image">
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => document.getElementById("vehicleImageInput").click()}
                    className="px-3 py-2 rounded-md border border-slate-700 text-slate-200 hover:bg-slate-800 inline-flex items-center gap-2"
                  >
                    <FaPlusCircle /> Choose image
                  </button>
                  {vehicleImage ? (
                    <span className="text-xs text-emerald-300">{vehicleImage.name}</span>
                  ) : (
                    <span className="text-xs text-slate-400">No file selected</span>
                  )}
                  <input
                    id="vehicleImageInput"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setVehicleImage(e.target.files?.[0] || null)}
                  />
                </div>
              </Field>

              <div className="flex flex-wrap gap-3">
                <button type="submit" className="px-4 py-3 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
                  Save vehicle
                </button>
                <button
                  type="button"
                  onClick={() =>
                    toast.info("Publish flow should call /api/host/publish after admin validation.")
                  }
                  className="px-4 py-3 rounded-lg border border-blue-500 text-blue-100 hover:bg-blue-900/30"
                >
                  Publish (sends to Admin)
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Host Centre a.vii & a.viii */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
        <div className="flex items-center gap-2">
          <FaCar className="text-emerald-400" />
          <h2 className="text-xl font-semibold text-white">a.vii Host Centre</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard icon={FaCar} label="Number of Cars" value={hostStats.totalCars} accent="emerald" />
          <MetricCard icon={FaCheckCircle} label="Approved" value={hostStats.approved} accent="blue" />
          <MetricCard icon={FaExclamationTriangle} label="Cancellations" value={hostStats.cancellations} accent="rose" />
          <MetricCard icon={FaShieldAlt} label="In Service" value={hostStats.inService} accent="amber" />
        </div>

        <Collapsible
          title="a.viii.ii Add a Vehicle"
          subtitle="Same logic as onboarding vehicle form"
          defaultOpen={false}
          badge="collapsible"
        >
          <p className="text-sm text-slate-300 mb-3">
            Reuse the onboarding form to add vehicles quickly. Supports flexible pricing and seasonal rates.
          </p>
          <button
            onClick={() => toast.info("Reuse the add-vehicle form above or open a modal with it.")}
            className="px-4 py-3 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center gap-2"
          >
            <FaPlusCircle /> Add vehicle
          </button>
        </Collapsible>

        <Collapsible
          title="a.viii.iii My Cars"
          subtitle="Edit price flexibility & availability"
          defaultOpen={false}
          badge="editable"
        >
          <div className="space-y-3">
            {["Camry 2023", "Civic 2022", "Hilux 2021"].map((car) => (
              <div
                key={car}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-800/60 border border-slate-700 rounded-lg p-3"
              >
                <div>
                  <div className="text-sm text-white">{car}</div>
                  <div className="text-xs text-slate-400">Flexible pricing enabled</div>
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-2 rounded-md border border-slate-700 text-slate-200 hover:bg-slate-800">
                    Edit pricing
                  </button>
                  <button className="px-3 py-2 rounded-md border border-slate-700 text-slate-200 hover:bg-slate-800">
                    Manage bookings
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Collapsible>

        <Collapsible
          title="a.viii.iv Calendar"
          subtitle="Shows bookings with vehicle thumbnails and national holidays"
          defaultOpen={false}
          badge="calendar"
        >
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
            <div className="text-sm text-slate-200 mb-2">National Holidays</div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-100">
              {calendarHolidays.map((d) => (
                <span key={d} className="px-2 py-1 rounded-full bg-slate-900 border border-slate-700">
                  {d}
                </span>
              ))}
            </div>
            <div className="mt-3 text-xs text-slate-400">
              Integrate a real calendar component and mark bookings with vehicle thumbnails linking to Manage Bookings.
            </div>
          </div>
        </Collapsible>

        <Collapsible
          title="a.vii.v Manage Bookings"
          subtitle="Same-day bookings, accept/decline extensions"
          defaultOpen={false}
          badge="live"
        >
          <div className="space-y-3">
            {["Today 09:00 - Camry 2023", "Today 14:00 - Civic 2022"].map((b) => (
              <div
                key={b}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-800/60 border border-slate-700 rounded-lg p-3"
              >
                <div className="text-sm text-white">{b}</div>
                <div className="flex gap-2">
                  <button className="px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700">Accept</button>
                  <button className="px-3 py-2 rounded-md border border-rose-500 text-rose-200 hover:bg-rose-900/30">Decline</button>
                  <button className="px-3 py-2 rounded-md border border-slate-700 text-slate-200 hover:bg-slate-800 inline-flex items-center gap-1">
                    <FaExternalLinkAlt /> Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Collapsible>
      </div>

      {/* Error / loading */}
      {loading ? <div className="text-slate-200">Loading profile...</div> : null}
      {error ? <div className="text-rose-300 text-sm">{error}</div> : null}
    </div>
  );
};

export default ProfilePage;