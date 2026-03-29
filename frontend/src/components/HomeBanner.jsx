import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FaChevronLeft, FaChevronRight, FaArrowRight } from "react-icons/fa";
import { heroStyles as styles } from "../assets/dummyStyles";

// Import all your marketing / promo images
// import hc1 from "../assets/HC1.jpeg";
import hc2 from "../assets/HC2.png";
import hc3 from "../assets/HC3.png";
import hc4 from "../assets/HC4.png";

// ── slide data (add / remove entries here and the carousel adapts) ──
const slides = [
  // { src: hc1, alt: "Vroomoo Promotion — Premium car fleet showcase" },
  { src: hc3, alt: "Vroomoo Promotion — Affordable rental deals" },
  { src: hc2, alt: "Vroomoo Promotion — Easy online booking" },
  { src: hc4, alt: "Vroomoo Promotion — Trusted car rental service" },
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
    <section className="bg-[#FFFBF5]" aria-label="Hero banner">
      {/* ── CAROUSEL BANNER ── */}
      <div
        ref={wrapRef}
        className="relative w-full h-[50vh] sm:h-[60vh] md:h-[75vh] lg:h-screen max-h-[700px] bg-gray-100 overflow-hidden flex items-center justify-center rounded-b-3xl"
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

        {/* ── Carousel controls ── */}
        {slides.length > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="Previous slide"
              className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 z-20 bg-white/70 hover:bg-white/90 backdrop-blur-sm text-slate-800 p-3 sm:p-3.5 rounded-full transition-all shadow-md"
            >
              <FaChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button
              onClick={next}
              aria-label="Next slide"
              className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 z-20 bg-white/70 hover:bg-white/90 backdrop-blur-sm text-slate-800 p-3 sm:p-3.5 rounded-full transition-all shadow-md"
            >
              <FaChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Dot indicators */}
            <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2.5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className={`w-3 h-3 sm:w-2.5 sm:h-2.5 rounded-full transition-all duration-300 ${
                    i === current
                      ? "bg-orange-500 scale-125"
                      : "bg-slate-400/50 hover:bg-slate-500/70"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── CTA SECTION — light cheerful card ── */}
      <div className="bg-[#FFFBF5] py-8 sm:py-10 flex justify-center px-4">
        <div className="relative rounded-2xl p-5 sm:p-6 bg-white border border-orange-100 shadow-lg shadow-orange-100/50 flex flex-col md:flex-row items-center justify-between gap-4 max-w-xl w-full text-center md:text-left">
          <div>
            <p className="text-xs uppercase tracking-widest text-orange-500/80">
              Vroomoo Car Rental
            </p>
            <h2 className="text-slate-800 text-lg sm:text-xl md:text-2xl font-semibold mt-1">
              Find Your Perfect Ride
            </h2>
            <p className="mt-1 text-sm text-slate-500">
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
        </div>
      </div>
    </section>
  );
}