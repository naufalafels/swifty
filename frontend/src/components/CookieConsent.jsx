import React, { useEffect, useState } from "react";

/**
 * CookieConsent
 * - Shows a bottom bar on first visit or if consent expires/cleared.
 * - Stores 'cookie_consent' in localStorage as 'accepted' | 'declined'.
 * - Accessible, responsive, enterprise-minded UI.
 *
 * Behavior:
 * - Accept: sets 'accepted'. If you want server-side to set cookies only after accept,
 *   send the user's choice with auth requests and the server should respect it.
 * - Decline: sets 'declined'. Client will avoid sending credentials when possible (frontend decisions).
 *
 * Styling: Tailwind CSS is used across the project.
 */

const Banner = ({ onAccept, onDecline }) => {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50">
      <div className="max-w-screen-xl mx-auto bg-gray-900/95 text-white shadow-lg rounded-t-lg p-4 md:p-6 flex flex-col md:flex-row items-center md:justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm md:text-base leading-snug">
            We use cookies to provide essential authentication, preferences, and to improve your experience.
            By clicking "Accept", you consent to cookies (including secure, httpOnly tokens used for authentication).
            You can also choose "Decline" to disable non-essential cookies. Essential authentication may be limited if you decline.
          </p>
        </div>

        <div className="flex-shrink-0 flex gap-2 items-center">
          <button
            onClick={onDecline}
            className="px-3 py-2 rounded-md bg-gray-700 text-sm md:text-base hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            aria-label="Decline cookies"
          >
            Decline
          </button>

          <button
            onClick={onAccept}
            className="px-3 py-2 rounded-md bg-emerald-500 text-sm md:text-base font-semibold hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-300"
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
      // optional: record timestamp for expiration or analytics
      localStorage.setItem("cookie_consent_at", Date.now().toString());
      setConsent("accepted");
      // emit event for the app to react
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

  // show banner if not set
  if (consent === "accepted" || consent === "declined") return null;

  return <Banner onAccept={handleAccept} onDecline={handleDecline} />;
};

export default CookieConsent;