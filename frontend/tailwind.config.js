/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Light Editorial Palette
        "bg-light":     "#F7F8F5",
        "bg-light-sec": "#EEF1EC",
        "surface-white":"#FFFFFF",
        "text-ink":     "#151716",
        "text-ink-sec": "#666C68",
        "border-light": "#E1E4DF",
        
        // Brand & Accents
        brand: {
          DEFAULT: "#1D6B5F",
          dark:    "#155247",
          light:   "#DCEDE8",
        },
        citron: {
          DEFAULT: "#D9F36A",
          dark:    "#BDD94B",
          dim:     "rgba(217, 243, 106, 0.16)",
        },
        
        // Dark Section & Clinical Base
        "bg-dark":      "#111312",
        "surface-dark": "#181B19",
        "border-dark":  "rgba(255, 255, 255, 0.08)",

        // Existing Clinical & Telemetry Tokens
        base:     "#0B1120",
        surface:  "#111827",
        elevated: "#161B26",
        overlay:  "#1C2333",
        teal:  { DEFAULT:"#5EEAD4", dim:"rgba(94,234,212,0.12)", glow:"rgba(94,234,212,0.30)", dark:"#2DD4BF" },
        lav:   { DEFAULT:"#A78BFA", dim:"rgba(167,139,250,0.12)", glow:"rgba(167,139,250,0.30)", dark:"#7C3AED" },
        amber: { DEFAULT:"#FCD34D", dim:"rgba(252,211,77,0.12)",  glow:"rgba(252,211,77,0.30)",  dark:"#F59E0B" },
        rose:  { DEFAULT:"#F43F5E", dim:"rgba(244,63,94,0.12)" },
        cyan:  "#06B6D4", 
        emerald:"#10B981", 
        violet:"#7C3AED", 
        blue:"#3B82F6",
      },
      fontFamily: {
        display: ["'Fraunces'","Georgia","serif"],
        sans:    ["'Inter'","'IBM Plex Sans'","system-ui","sans-serif"],
        mono:    ["'IBM Plex Mono'","monospace"],
      },
      letterSpacing: {
        editorial: "-0.04em",
        tightest:  "-0.05em",
        eyebrow:   "0.14em",
      },
      animation: {
        breathe:    "breathe 4s ease-in-out infinite",
        float:      "float 8s ease-in-out infinite",
        pulseSoft:  "pulseSoft 2.5s ease-in-out infinite",
        fadeUp:     "fadeUp 0.8s cubic-bezier(0.16,1,0.3,1) both",
      },
      keyframes: {
        breathe:    {"0%,100%":{opacity:"0.8",transform:"scale(1)"},"50%":{opacity:"1",transform:"scale(1.02)"}},
        float:      {"0%,100%":{transform:"translateY(0px)"},"50%":{transform:"translateY(-10px)"}},
        pulseSoft:  {"0%,100%":{boxShadow:"0 0 0 0 rgba(29,107,95,0)"},"50%":{boxShadow:"0 0 0 10px rgba(29,107,95,0.12)"}},
        fadeUp:     {from:{opacity:"0",transform:"translateY(24px)"},to:{opacity:"1",transform:"translateY(0)"}},
      },
      boxShadow: {
        "subtle":       "0 2px 12px rgba(0,0,0,0.04)",
        "card-light":   "0 4px 24px rgba(21,23,22,0.06)",
        "card-dark":    "0 12px 40px rgba(0,0,0,0.4)",
        "brand-glow":   "0 8px 30px rgba(29,107,95,0.22)",
      },
    },
  },
  plugins: [],
};

