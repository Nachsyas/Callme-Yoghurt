/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          canvas: "#f2f0eb",
          ceramic: "#edebe9",
          house: "#1E3932",
          accent: "#00754A",
          textMain: "rgba(0, 0, 0, 0.87)",
          textSoft: "rgba(0, 0, 0, 0.58)",
          strawberry: "#D81E5B",
          mango: "#F9A03F",
          melon: "#A1C349",
          grape: "#7A3B69",
        },
        secondary: {
          DEFAULT: "#00754A",
          container: "#d4e9e2",
        }
      },
      letterSpacing: {
        tightest: '-0.01em',
      },
      boxShadow: {
        'card': '0 0 0.5px rgba(0,0,0,0.14), 0 1px 1px rgba(0,0,0,0.24)',
        'frap': '0 0 6px rgba(0,0,0,0.24), 0 8px 12px rgba(0,0,0,0.14)',
        'whisper-shadow': '0 0 0.5px rgba(0,0,0,0.14), 0 1px 1px rgba(0,0,0,0.24)',
        'frap-shadow': '0 0 6px rgba(0,0,0,0.24), 0 8px 12px rgba(0,0,0,0.14)',
      }
    },
  },
  plugins: [],
};