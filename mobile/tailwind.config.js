/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#0A0F1E",
        surface: "#111827",
        card: "#1A2236",
        primary: "#2563EB",
        border: "#1E293B",
      },
      fontFamily: {
        sans: ["System"],
      },
    },
  },
  plugins: [],
};
