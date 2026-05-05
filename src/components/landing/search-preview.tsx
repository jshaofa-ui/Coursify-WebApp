"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, TrendingUp, BookOpen, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const sampleSearches = [
  "COMP101",
  "MATH121",
  "ECON110",
  "PSYC100",
  "BIOL102",
  "CHEM112",
  "PHIL129",
  "BUS801",
];

const stats = [
  {
    icon: BookOpen,
    label: "Total Courses",
    value: "2,400+",
    description: "Queen's courses indexed",
    color: "text-brand-navy dark:text-blue-400",
    bgColor: "bg-brand-navy/10 dark:bg-blue-400/10",
  },
  {
    icon: TrendingUp,
    label: "Departments",
    value: "60+",
    description: "Academic departments",
    color: "text-brand-red",
    bgColor: "bg-brand-red/10 dark:bg-brand-red/20",
  },
  {
    icon: BarChart3,
    label: "Distributions",
    value: "18K+",
    description: "Grade distributions",
    color: "text-brand-gold",
    bgColor: "bg-brand-gold/10 dark:bg-brand-gold/20",
  },
];

export function SearchPreview() {
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [typedText, setTypedText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const currentSearch = sampleSearches[currentSearchIndex];

  const handleTyping = useCallback(() => {
    if (!isDeleting && typedText === currentSearch) {
      // Pause before deleting
      if (!isPaused) {
        setIsPaused(true);
        setTimeout(() => {
          setIsPaused(false);
          setIsDeleting(true);
        }, 2000);
      }
      return;
    }

    if (isDeleting && typedText === "") {
      // Move to next search
      setIsDeleting(false);
      setCurrentSearchIndex((prev) => (prev + 1) % sampleSearches.length);
      return;
    }

    const timeout = isDeleting ? 50 : 120;
    setTimeout(() => {
      setTypedText((prev) =>
        isDeleting ? prev.slice(0, -1) : currentSearch.slice(0, prev.length + 1)
      );
    }, timeout);
  }, [typedText, isDeleting, isPaused, currentSearch]);

  useEffect(() => {
    handleTyping();
  }, [handleTyping]);

  return (
    <section
      className="section-glass py-16 sm:py-20 px-4 relative overflow-hidden"
      aria-label="Search preview and platform statistics"
    >
      {/* Background glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-[15%] top-8 h-72 w-72 rounded-full blur-[145px] opacity-70 hidden md:block"
        style={{
          background:
            "radial-gradient(circle, rgba(0,48,95,0.12) 0%, rgba(0,48,95,0.05) 48%, transparent 76%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[10%] bottom-12 h-64 w-64 rounded-full blur-[135px] opacity-60 hidden md:block"
        style={{
          background:
            "radial-gradient(circle, rgba(239,178,21,0.10) 0%, rgba(239,178,21,0.04) 42%, transparent 74%)",
        }}
      />

      <div className="container mx-auto relative z-10">
        {/* Section header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center gap-2 rounded-full glass-pill px-4 py-2 mb-3">
            <Search className="h-3.5 w-3.5 text-brand-red" />
            <span className="text-brand-red text-xs font-semibold">
              Try It Now
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold mb-2 text-brand-navy dark:text-white">
            Search any{" "}
            <span className="text-brand-red">Queen&apos;s course</span>
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
            See grade distributions, professor reviews, and AI-powered insights
            for every course.
          </p>
        </div>

        {/* Mock search bar */}
        <div className="max-w-xl mx-auto mb-12">
          <div className="glass-card rounded-2xl p-3">
            <div className="relative flex items-center">
              <div className="absolute left-4 flex items-center justify-center w-8 h-8 rounded-lg bg-brand-navy/10 dark:bg-blue-400/10">
                <Search className="h-4 w-4 text-brand-navy dark:text-white" />
              </div>
              <div
                className="flex-1 pl-14 pr-4 py-3 text-sm font-mono text-brand-navy dark:text-white"
                aria-label={`Sample search: ${currentSearch}`}
                role="textbox"
                aria-readonly="true"
              >
                {typedText}
                <span
                  className={cn(
                    "inline-block w-[2px] h-4 ml-0.5 align-middle bg-brand-red animate-pulse"
                  )}
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>
          {/* Quick tags */}
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {sampleSearches.slice(0, 6).map((code) => (
              <button
                key={code}
                type="button"
                className={cn(
                  "text-xs font-medium px-3 py-1.5 rounded-full transition-all duration-200",
                  "glass-pill text-brand-navy/70 dark:text-white/70",
                  "hover:text-brand-red dark:hover:text-brand-red hover:scale-105"
                )}
                aria-label={`Search for ${code}`}
              >
                {code}
              </button>
            ))}
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="static-glass-card rounded-2xl p-6 text-center transition-all duration-300 hover:scale-[1.02]"
            >
              <div
                className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3",
                  stat.bgColor
                )}
              >
                <stat.icon className={cn("h-5 w-5", stat.color)} />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-brand-navy dark:text-white mb-1">
                {stat.value}
              </div>
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                {stat.label}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-500">
                {stat.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
