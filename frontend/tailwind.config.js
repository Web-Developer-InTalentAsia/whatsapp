/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg:      "#0f1117",
        bg2:     "#161922",
        bg3:     "#1e2230",
        bg4:     "#252a3a",
        border:  "#2a3048",
        border2: "#3a4260",
        txt:     "#e8eaf2",
        txt2:    "#8b92b0",
        txt3:    "#5a6280",
        accent:  "#4f7bff",
        accent2: "#6b95ff",
        success: "#22c984",
        warn:    "#f5a623",
        danger:  "#e8425a",
      },
      fontFamily: {
        sans: ["DM Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["DM Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
