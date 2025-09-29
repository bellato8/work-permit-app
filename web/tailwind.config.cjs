/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          gold: "#D4AF37",
          glass: "rgba(255,255,255,0.08)"
        }
      },
      backdropBlur: { xl: "18px" }
    }
  },
  plugins: []
};
