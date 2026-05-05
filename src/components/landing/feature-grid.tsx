"use client";

import Link from "next/link";
import {
  Search,
  Upload,
  BarChart3,
  Brain,
  Users,
  Smartphone,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FeatureCard {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  linkText: string;
  gradient: string;
  darkGradient: string;
  iconBg: string;
  darkIconBg: string;
  iconColor: string;
  darkIconColor: string;
}

const features: FeatureCard[] = [
  {
    icon: <Search className="h-6 w-6" />,
    title: "Course Search",
    description:
      "Find any Queen's course by code or name. Filter by department, level, and keyword to discover exactly what you need.",
    href: "/schools/queens",
    linkText: "Search courses",
    gradient: "from-brand-navy/20 to-brand-navy/5",
    darkGradient: "from-blue-400/15 to-blue-400/5",
    iconBg: "bg-brand-navy/10",
    darkIconBg: "dark:bg-blue-400/15",
    iconColor: "text-brand-navy",
    darkIconColor: "dark:text-blue-400",
  },
  {
    icon: <Upload className="h-6 w-6" />,
    title: "Upload Distributions",
    description:
      "Contribute grade distribution data to help fellow students. Your uploads make the platform better for everyone.",
    href: "/upload",
    linkText: "Upload data",
    gradient: "from-brand-red/20 to-brand-red/5",
    darkGradient: "from-brand-red/15 to-brand-red/5",
    iconBg: "bg-brand-red/10",
    darkIconBg: "dark:bg-brand-red/15",
    iconColor: "text-brand-red",
    darkIconColor: "dark:text-brand-red",
  },
  {
    icon: <BarChart3 className="h-6 w-6" />,
    title: "Analytics & Trends",
    description:
      "Visualize grade trends across semesters. See how course difficulty and enrollment numbers change over time.",
    href: "/schools/queens",
    linkText: "View analytics",
    gradient: "from-brand-gold/20 to-brand-gold/5",
    darkGradient: "from-brand-gold/15 to-brand-gold/5",
    iconBg: "bg-brand-gold/10",
    darkIconBg: "dark:bg-brand-gold/15",
    iconColor: "text-brand-gold",
    darkIconColor: "dark:text-brand-gold",
  },
  {
    icon: <Brain className="h-6 w-6" />,
    title: "AI Course Advisor",
    description:
      "Get personalized course recommendations from our AI assistant. Ask about professors, workload, and more.",
    href: "/queens-answers",
    linkText: "Ask the AI",
    gradient: "from-brand-red/20 to-brand-navy/5",
    darkGradient: "from-brand-red/15 to-blue-400/5",
    iconBg: "bg-brand-red/10",
    darkIconBg: "dark:bg-brand-red/15",
    iconColor: "text-brand-red",
    darkIconColor: "dark:text-brand-red",
  },
  {
    icon: <Users className="h-6 w-6" />,
    title: "Community Reviews",
    description:
      "Read aggregated student reviews from Reddit and RateMyProfessors. Get the real student perspective on courses.",
    href: "/schools/queens",
    linkText: "Read reviews",
    gradient: "from-brand-navy/20 to-brand-gold/5",
    darkGradient: "from-blue-400/15 to-brand-gold/5",
    iconBg: "bg-brand-navy/10",
    darkIconBg: "dark:bg-blue-400/15",
    iconColor: "text-brand-navy",
    darkIconColor: "dark:text-blue-400",
  },
  {
    icon: <Smartphone className="h-6 w-6" />,
    title: "Mobile Friendly",
    description:
      "Access Coursify on any device. Our responsive design works great on phones, tablets, and desktops.",
    href: "/schools/queens",
    linkText: "Explore on mobile",
    gradient: "from-brand-gold/20 to-brand-red/5",
    darkGradient: "from-brand-gold/15 to-brand-red/5",
    iconBg: "bg-brand-gold/10",
    darkIconBg: "dark:bg-brand-gold/15",
    iconColor: "text-brand-gold",
    darkIconColor: "dark:text-brand-gold",
  },
];

export function FeatureGrid() {
  return (
    <section
      className="section-glass py-16 sm:py-20 px-4 relative overflow-hidden"
      aria-label="Platform features"
    >
      {/* Background glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-[5%] top-16 h-80 w-80 rounded-full blur-[155px] opacity-60 hidden md:block"
        style={{
          background:
            "radial-gradient(circle, rgba(214,40,57,0.10) 0%, rgba(214,40,57,0.04) 44%, transparent 74%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[5%] bottom-8 h-72 w-72 rounded-full blur-[145px] opacity-55 hidden md:block"
        style={{
          background:
            "radial-gradient(circle, rgba(0,48,95,0.10) 0%, rgba(0,48,95,0.04) 46%, transparent 74%)",
        }}
      />

      <div className="container mx-auto relative z-10">
        {/* Section header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center gap-2 rounded-full glass-pill px-4 py-2 mb-3">
            <span className="text-brand-red text-xs font-semibold">
              Features
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold mb-2 text-brand-navy dark:text-white">
            Everything you need to{" "}
            <span className="text-brand-red">choose smarter</span>
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            From course search to AI-powered recommendations, Coursify gives you
            the tools to make informed academic decisions.
          </p>
        </div>

        {/* Feature cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className={cn(
                "group relative rounded-2xl p-6 overflow-hidden",
                "static-glass-card transition-all duration-300",
                "hover:scale-[1.02] hover:shadow-lg"
              )}
            >
              {/* Gradient overlay on hover */}
              <div
                aria-hidden
                className={cn(
                  "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                  feature.gradient,
                  feature.darkGradient
                )}
              />

              <div className="relative z-10">
                {/* Icon */}
                <div
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors duration-300",
                    feature.iconBg,
                    feature.darkIconBg
                  )}
                >
                  <span
                    className={cn(
                      "transition-colors duration-300",
                      feature.iconColor,
                      feature.darkIconColor
                    )}
                  >
                    {feature.icon}
                  </span>
                </div>

                {/* Content */}
                <h3 className="font-bold text-base mb-2 text-brand-navy dark:text-white">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                  {feature.description}
                </p>

                {/* Link */}
                <Link
                  href={feature.href}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-red hover:text-brand-red/80 transition-colors"
                  aria-label={`${feature.linkText} - ${feature.title}`}
                >
                  {feature.linkText}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
