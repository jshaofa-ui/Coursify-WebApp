"use client";

import Link from "next/link";
import { ArrowRight, Upload, BookOpen, Users, Database } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatItem {
  icon: React.ReactNode;
  label: string;
  value: string;
}

const stats: StatItem[] = [
  {
    icon: <BookOpen className="h-5 w-5" />,
    label: "Courses Indexed",
    value: "2,400+",
  },
  {
    icon: <Database className="h-5 w-5" />,
    label: "Distributions Uploaded",
    value: "18,000+",
  },
  {
    icon: <Users className="h-5 w-5" />,
    label: "Active Students",
    value: "5,000+",
  },
];

const colorVariants = [
  "text-brand-navy dark:text-blue-400",
  "text-brand-red",
  "text-brand-gold",
];

const bgVariants = [
  "bg-brand-navy/10 dark:bg-blue-400/15",
  "bg-brand-red/10 dark:bg-brand-red/15",
  "bg-brand-gold/10 dark:bg-brand-gold/15",
];

export function CTASection() {
  return (
    <section
      className="section-glass py-16 sm:py-20 px-4 relative overflow-hidden"
      aria-label="Call to action"
    >
      {/* Background glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-[10%] top-10 h-72 w-72 rounded-full blur-[145px] opacity-70 hidden md:block"
        style={{
          background:
            "radial-gradient(circle, rgba(0,48,95,0.14) 0%, rgba(0,48,95,0.05) 46%, transparent 76%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[10%] bottom-6 h-80 w-80 rounded-full blur-[155px] opacity-65 hidden md:block"
        style={{
          background:
            "radial-gradient(circle, rgba(214,40,57,0.14) 0%, rgba(214,40,57,0.05) 44%, transparent 76%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-0 h-64 w-96 rounded-full blur-[140px] opacity-50 hidden md:block"
        style={{
          background:
            "radial-gradient(circle, rgba(239,178,21,0.12) 0%, rgba(239,178,21,0.04) 44%, transparent 74%)",
        }}
      />

      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        {/* Stats row */}
        <div className="flex flex-wrap justify-center gap-6 sm:gap-10 mb-10">
          {stats.map((stat, index) => (
            <div key={stat.label} className="flex items-center gap-3">
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  bgVariants[index]
                )}
              >
                <span className={colorVariants[index]}>{stat.icon}</span>
              </div>
              <div>
                <div className="text-lg sm:text-xl font-extrabold text-brand-navy dark:text-white">
                  {stat.value}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Main CTA content */}
        <div className="flex flex-col items-center">
          <div className="text-center max-w-2xl mb-8">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 leading-tight">
              <span className="text-brand-gold">Ready to make smarter</span>
              <br />
              <span className="text-brand-navy dark:text-white">
                course decisions?
              </span>
            </h2>
            <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300">
              Join Queen&apos;s students who are using Coursify to plan their
              academic journey with real data.
            </p>
          </div>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <Link
              href="/schools/queens"
              className="liquid-btn-gold inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-brand-navy text-sm sm:text-base w-full sm:w-auto justify-center"
              aria-label="Start exploring courses"
            >
              <BookOpen className="h-4 w-4" />
              Start Exploring Courses
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm sm:text-base w-full sm:w-auto justify-center glass-btn text-brand-navy dark:text-white border border-brand-navy/20 dark:border-white/20 hover:border-brand-red/40 dark:hover:border-brand-red/40"
              aria-label="Upload your grade distribution"
            >
              <Upload className="h-4 w-4" />
              Upload Your Grade Distribution
            </Link>
          </div>

          {/* Secondary link */}
          <div className="mt-6 text-center">
            <Link
              href="/queens-answers"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-navy/60 dark:text-white/50 hover:text-brand-red dark:hover:text-brand-red transition-colors duration-200"
            >
              Or try the AI Course Advisor
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
