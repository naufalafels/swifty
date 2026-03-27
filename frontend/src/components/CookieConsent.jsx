import React, { useEffect, useState } from "react";

const Banner = ({ onAccept, onDecline }) => {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-3 sm:px-4 pb-3 sm:pb-4">
      <div className="max-w-screen-xl mx-auto bg-white/95 backdrop-blur-md text-slate-800 shadow-2xl shadow-orange-200/30 rounded-2xl p-4 sm:p-5 md:p-6 flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-3 sm:gap-4 border border-orange-200/60">
        <div className="flex-1">
          <p className="text-xs sm:text-sm md:text-base leading-relaxed text-slate-600">
            We use cookies to provide essential authentication, preferences, and to improve your experience.
            By clicking "Accept", you consent to cookies (including secure, httpOnly tokens used for authentication).
            You can also choose "Decline" to disable non-essential cookies.
          </p>
        </div>

        {/* FIX: Larger tap targets (min 44px), full-width on mobile, inline on sm+ */}
        <div className="flex-shrink-0 flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            onClick={onDecline}
            className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-300 transition-colors"
            aria-label="Decline cookies"
          >
            Decline
          </button>

          <button
            onClick={onAccept}
            className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-400 transition-colors"
            aria-label="Accept cookies"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};

const CookieConsent = () => {
  const [consent, setConsent] = useState(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem("cookie_consent");
      setConsent(v);
    } catch {
      setConsent(null);
    }
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem("cookie_consent", "accepted");
      localStorage.setItem("cookie_consent_at", Date.now().toString());
      setConsent("accepted");
      window.dispatchEvent(new CustomEvent("cookie-consent-changed", { detail: { consent: "accepted" } }));
    } catch {
      setConsent("accepted");
    }
  };

  const handleDecline = () => {
    try {
      localStorage.setItem("cookie_consent", "declined");
      localStorage.setItem("cookie_consent_at", Date.now().toString());
      setConsent("declined");
      window.dispatchEvent(new CustomEvent("cookie-consent-changed", { detail: { consent: "declined" } }));
    } catch {
      setConsent("declined");
    }
  };

  if (consent === "accepted" || consent === "declined") return null;

  return <Banner onAccept={handleAccept} onDecline={handleDecline} />;
};

export default CookieConsent;