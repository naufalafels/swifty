import React from "react";

/**
 * Admin cookie consent (same UX as frontend).
 * Keep as a small separate component to avoid cross-import complexity.
 */

const AdminCookieConsent = () => {
  // Reuse same markup & behavior as the frontend component but keep local to admin.
  const [consent, setConsent] = React.useState(null);

  React.useEffect(() => {
    try {
      setConsent(localStorage.getItem("cookie_consent"));
    } catch {
      setConsent(null);
    }
  }, []);

  const doAccept = () => {
    try {
      localStorage.setItem("cookie_consent", "accepted");
      localStorage.setItem("cookie_consent_at", Date.now().toString());
      setConsent("accepted");
      window.dispatchEvent(new CustomEvent("cookie-consent-changed", { detail: { consent: "accepted" } }));
    } catch {
      setConsent("accepted");
    }
  };

  const doDecline = () => {
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

  return (
    <div className="fixed inset-x-0 bottom-0 z-50">
      <div className="max-w-screen-xl mx-auto bg-gray-900/95 text-white shadow-lg rounded-t-lg p-4 md:p-6 flex flex-col md:flex-row items-center md:justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm md:text-base leading-snug">
            This admin panel uses cookies for authentication and improved UX. Accept to continue using cookies, or Decline to limit cookie usage.
          </p>
        </div>

        <div className="flex-shrink-0 flex gap-2 items-center">
          <button
            onClick={doDecline}
            className="px-3 py-2 rounded-md bg-gray-700 text-sm md:text-base hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            aria-label="Decline cookies"
          >
            Decline
          </button>

          <button
            onClick={doAccept}
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

export default AdminCookieConsent;