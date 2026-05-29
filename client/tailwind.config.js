/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        surface: "hsl(var(--surface))",
        "surface-2": "hsl(var(--surface-2))",
        border: "hsl(var(--border))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        accent: "hsl(var(--accent))",
        "accent-foreground": "hsl(var(--accent-foreground))",
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        danger: "hsl(var(--danger))",
      },
      fontFamily: {
        sans: ["Manrope", "sans-serif"],
        display: ["Space Grotesk", "sans-serif"],
      },
      boxShadow: {
        soft: "0 20px 60px rgba(15, 23, 42, 0.08)",
        glow: "0 0 0 1px rgba(15, 23, 42, 0.06), 0 20px 40px rgba(15, 23, 42, 0.08)",
      },
      backgroundImage: {
        "grid-fade":
          "linear-gradient(to bottom right, rgba(15, 23, 42, 0.04), rgba(15, 118, 110, 0.02)), radial-gradient(circle at top right, rgba(15, 118, 110, 0.10), transparent 42%), radial-gradient(circle at bottom left, rgba(15, 23, 42, 0.08), transparent 38%)",
      },
    },
  },
  plugins: [],
};

