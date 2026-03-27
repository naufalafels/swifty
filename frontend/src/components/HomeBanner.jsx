import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FaChevronLeft, FaChevronRight, FaArrowRight } from "react-icons/fa";
import { heroStyles as styles } from "../assets/dummyStyles";

// Import all your marketing / promo images
import hc1 from "../assets/HC1.jpeg";
import hc2 from "../assets/HC2.png";
import hc3 from "../assets/HC3.png";
import hc4 from "../assets/HC4.png";

// ── slide data (add / remove entries here and the carousel adapts) ──
const slides = [
  { src: hc1, alt: "Swifty Promotion — Premium car fleet showcase" },
  { src: hc2, alt: "Swifty Promotion — Affordable rental deals" },
  { src: hc3, alt: "Swifty Promotion — Easy online booking" },
  { src: hc4, alt: "Swifty Promotion — Trusted car rental service" },
];

const AUTOPLAY_MS = 5000; // 5 seconds per slide

export default function HeroSleek() {
  const navigate = useNavigate();
  const wrapRef = useRef(null);
  const bgRef = useRef(null);
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 });
  const [current, setCurrent] = useState(0);
  const timerRef = useRef(null);

  // ── parallax mouse tracking ──
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    function onMove(e) {
      const r = el.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const x = (clientX - r.left) / r.width;
      const y = (clientY - r.top) / r.height;
      setMouse({ x, y });
      el.style.setProperty("--mx", `${x}`);
      el.style.setProperty("--my", `${y}`);
    }

    function onLeave() {
      setMouse({ x: 0.5, y: 0.5 });
      el.style.setProperty("--mx", `0.5`);
      el.style.setProperty("--my", `0.5`);
    }

    el.addEventListener("mousemove", onMove);
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("mouseleave", onLeave);
    el.addEventListener("touchend", onLeave);

    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      el.removeEventListener("touchend", onLeave);
    };
  }, []);

  // ── autoplay loop ──
  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, AUTOPLAY_MS);
  }, []);

  useEffect(() => {
    resetTimer();
    return () => clearInterval(timerRef.current);
  }, [resetTimer]);

  const goTo = (idx) => {
    setCurrent(idx);
    resetTimer();
  };
  const prev = () => goTo((current - 1 + slides.length) % slides.length);
  const next = () => goTo((current + 1) % slides.length);

  // ── parallax values ──
  const maxTranslate = 14;
  const tx = (mouse.x - 0.5) * 2 * maxTranslate;
  const ty = (mouse.y - 0.5) * 2 * (maxTranslate * 0.55);

  return (
    <section className="bg-slate-950" aria-label="Hero banner">
      {/* ── CAROUSEL BANNER — FIX: fluid height instead of fixed h-[600px] ── */}
      <div
        ref={wrapRef}
        className="relative w-full h-[50vh] sm:h-[60vh] md:h-[75vh] lg:h-screen bg-slate-950 overflow-hidden flex items-center justify-center"
        style={{ ["--mx"]: 0.5, ["--my"]: 0.5 }}
      >
        {/* BACKGROUND — carousel of promo images */}
        <div
          ref={bgRef}
          className={styles.background}
          style={{
            transform: `translate3d(${tx * 0.55}px, ${
              ty * 0.55
            }px, 0) scale(1.03)`,
            transition: "transform 220ms cubic-bezier(.2,.9,.25,1)",
          }}
        >
          {/* ── PROMOTION CAROUSEL — FIX: lazy load non-first slides ── */}
          {slides.map((slide, i) => (
            <img
              key={i}
              src={slide.src}
              alt={slide.alt}
              loading={i === 0 ? "eager" : "lazy"}
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out"
              style={{ opacity: i === current ? 1 : 0 }}
              draggable={false}
            />
          ))}
        </div>

        {/* ── Carousel controls — FIX: larger touch targets (min 44x44) ── */}
        {slides.length > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="Previous slide"
              className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 z-50 bg-black/40 hover:bg-black/60 backdrop-blur-sm text-white p-3 sm:p-3.5 rounded-full transition-all"
            >
              <FaChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button
              onClick={next}
              aria-label="Next slide"
              className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 z-50 bg-black/40 hover:bg-black/60 backdrop-blur-sm text-white p-3 sm:p-3.5 rounded-full transition-all"
            >
              <FaChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Dot indicators — FIX: larger tap targets */}
            <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 flex gap-2.5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className={`w-3 h-3 sm:w-2.5 sm:h-2.5 rounded-full transition-all duration-300 ${
                    i === current
                      ? "bg-orange-400 scale-125"
                      : "bg-white/40 hover:bg-white/70"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── CTA SECTION — FIX: flex-col on mobile, md:flex-row for tablets, centered text ── */}
      <div className="bg-slate-950 py-8 sm:py-10 flex justify-center px-4">
        <div className="relative rounded-2xl p-5 sm:p-6 bg-[rgba(255,255,255,0.05)] border border-white/[0.08] backdrop-blur-md shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4 max-w-xl w-full text-center md:text-left">
          <div>
            <p className="text-xs uppercase tracking-widest text-sky-300/70">
              Swifty Car Rental
            </p>
            <h2 className="text-white text-lg sm:text-xl md:text-2xl font-semibold mt-1">
              Find Your Perfect Ride
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Browse our premium fleet and book instantly.
            </p>
          </div>
          <button
            onClick={() => navigate("/cars")}
            className={styles.ctaButton}
          >
            <span className={styles.buttonText}>Browse Cars</span>
            <FaArrowRight className="w-4 h-4" />
          </button>
          <span className="absolute -inset-1 rounded-2xl pointer-events-none ring-1 ring-white/[0.08]" />
        </div>
      </div>
    </section>
  );
}