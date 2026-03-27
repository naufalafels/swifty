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
  { src: hc1, alt: "Swifty Promotion 1" },
  { src: hc2, alt: "Swifty Promotion 2" },
  { src: hc3, alt: "Swifty Promotion 3" },
  { src: hc4, alt: "Swifty Promotion 4" },
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
    <div className="bg-black">
      {/* ── CAROUSEL BANNER ── */}
      <div
        ref={wrapRef}
        className={styles.container}
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
          {/* ── PROMOTION CAROUSEL ── */}
          {slides.map((slide, i) => (
            <img
              key={i}
              src={slide.src}
              alt={slide.alt}
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out"
              style={{ opacity: i === current ? 1 : 0 }}
              draggable={false}
            />
          ))}

          {/* REMOVED: <div className={styles.gradientOverlay} /> — this was the dark screen */}
        </div>

        {/* ── Carousel controls ── */}
        {slides.length > 1 && (
          <>
            {/* Left / Right arrows */}
            <button
              onClick={prev}
              aria-label="Previous slide"
              className="absolute left-4 top-1/2 -translate-y-1/2 z-50 bg-black/40 hover:bg-black/60 backdrop-blur-sm text-white p-3 rounded-full transition-all"
            >
              <FaChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={next}
              aria-label="Next slide"
              className="absolute right-4 top-1/2 -translate-y-1/2 z-50 bg-black/40 hover:bg-black/60 backdrop-blur-sm text-white p-3 rounded-full transition-all"
            >
              <FaChevronRight className="w-4 h-4" />
            </button>

            {/* Dot indicators */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex gap-2">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                    i === current
                      ? "bg-orange-400 scale-125"
                      : "bg-white/40 hover:bg-white/70"
                  }`}
                />
              ))}
            </div>
          </>
        )}

        {/* REMOVED: SVG sweeps — decorative glowing paths that also sat on top of the images */}
      </div>

      {/* ── CTA SECTION — sits BELOW the carousel, no overlap ── */}
      <div className="bg-black py-10 flex justify-center px-4">
        <div className="relative rounded-2xl p-6 bg-[rgba(255,255,255,0.04)] border border-white/[0.06] backdrop-blur-md shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 max-w-xl w-full">
          <div>
            <p className="text-xs uppercase tracking-widest text-sky-300/70">
              Swifty Car Rental
            </p>
            <h2 className="text-white text-lg sm:text-2xl font-semibold mt-1">
              Find Your Perfect Ride
            </h2>
            <p className="mt-1 text-sm text-slate-300/70">
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
          <span className="absolute -inset-1 rounded-2xl pointer-events-none ring-1 ring-white/[0.06]" />
        </div>
      </div>
    </div>
  );
}