"use client";

import { Star, Quote } from "lucide-react";
import { cn } from "@/lib/utils";

interface Testimonial {
  quote: string;
  name: string;
  year: string;
  program: string;
  rating: number;
}

const testimonials: Testimonial[] = [
  {
    quote:
      "Coursify completely changed how I plan my courses. Seeing the actual grade distributions helped me balance my schedule and avoid courses that would have destroyed my GPA.",
    name: "Sarah M.",
    year: "Year 3",
    program: "Computer Science",
    rating: 5,
  },
  {
    quote:
      "The AI assistant is incredibly helpful. I asked about workload comparisons between two electives and got detailed, accurate answers that matched what upper-years told me.",
    name: "James K.",
    year: "Year 2",
    program: "Commerce (BCom)",
    rating: 5,
  },
  {
    quote:
      "I love that I can see professor reviews aggregated from multiple sources. It saves me from scrolling through Reddit threads trying to find relevant info about my courses.",
    name: "Priya S.",
    year: "Year 4",
    program: "Life Sciences",
    rating: 4,
  },
  {
    quote:
      "As a first-year, I had no idea what to expect. Coursify gave me the confidence to choose courses that matched my strengths. The analytics visualizations are beautiful too.",
    name: "Alex T.",
    year: "Year 1",
    program: "Engineering",
    rating: 5,
  },
];

const colorClasses = [
  {
    avatarBg: "bg-brand-navy/10 dark:bg-blue-400/15",
    avatarText: "text-brand-navy dark:text-blue-400",
    quoteBg: "text-brand-navy/5 dark:text-white/5",
  },
  {
    avatarBg: "bg-brand-red/10 dark:bg-brand-red/15",
    avatarText: "text-brand-red",
    quoteBg: "text-brand-red/5 dark:text-brand-red/5",
  },
  {
    avatarBg: "bg-brand-gold/10 dark:bg-brand-gold/15",
    avatarText: "text-brand-gold",
    quoteBg: "text-brand-gold/5 dark:text-brand-gold/5",
  },
  {
    avatarBg: "bg-brand-navy/10 dark:bg-blue-400/15",
    avatarText: "text-brand-navy dark:text-blue-400",
    quoteBg: "text-brand-navy/5 dark:text-white/5",
  },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div
      className="flex items-center gap-0.5"
      role="img"
      aria-label={`${rating} out of 5 stars`}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3.5 w-3.5",
            i < rating
              ? "text-brand-gold fill-brand-gold"
              : "text-gray-300 dark:text-gray-600"
          )}
        />
      ))}
    </div>
  );
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function Testimonials() {
  return (
    <section
      className="section-glass py-16 sm:py-20 px-4 relative overflow-hidden"
      aria-label="Student testimonials"
    >
      {/* Background glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-[10%] top-12 h-72 w-72 rounded-full blur-[145px] opacity-60 hidden md:block"
        style={{
          background:
            "radial-gradient(circle, rgba(239,178,21,0.12) 0%, rgba(239,178,21,0.04) 44%, transparent 74%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-[8%] bottom-16 h-64 w-64 rounded-full blur-[135px] opacity-50 hidden md:block"
        style={{
          background:
            "radial-gradient(circle, rgba(214,40,57,0.10) 0%, rgba(214,40,57,0.04) 42%, transparent 74%)",
        }}
      />

      <div className="container mx-auto relative z-10">
        {/* Section header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center gap-2 rounded-full glass-pill px-4 py-2 mb-3">
            <span className="text-brand-gold text-xs font-semibold">
              Student Stories
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold mb-2 text-brand-navy dark:text-white">
            Trusted by{" "}
            <span className="text-brand-gold">Queen&apos;s students</span>
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
            See how Coursify is helping students make smarter course decisions
            across campus.
          </p>
        </div>

        {/* Testimonial cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-4xl mx-auto">
          {testimonials.map((testimonial, index) => {
            const colors = colorClasses[index % colorClasses.length];
            return (
              <div
                key={testimonial.name}
                className="static-glass-card rounded-2xl p-6 relative overflow-hidden transition-all duration-300 hover:scale-[1.02]"
              >
                {/* Quote icon */}
                <Quote
                  className={cn(
                    "absolute top-4 right-4 h-8 w-8",
                    colors.quoteBg
                  )}
                  aria-hidden="true"
                />

                <div className="relative z-10">
                  {/* Star rating */}
                  <StarRating rating={testimonial.rating} />

                  {/* Quote */}
                  <blockquote className="mt-4 mb-5 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    &ldquo;{testimonial.quote}&rdquo;
                  </blockquote>

                  {/* Author */}
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm",
                        colors.avatarBg,
                        colors.avatarText
                      )}
                    >
                      {getInitials(testimonial.name)}
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-brand-navy dark:text-white">
                        {testimonial.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {testimonial.year} &middot; {testimonial.program}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
