/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1rem",
    },
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      colors: {
        ink: "#0A0A0A",
        paper: "#FFFFFF",
        accent: {
          DEFAULT: "#15803D",
          fg: "#FFFFFF",
        },
      },
      borderRadius: {
        lg: "12px",
        md: "10px",
        sm: "6px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
