/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        passion: {
          bg:      "#0f0b0c",
          card:    "#21161a",
          border:  "#352f31",
          red:     "#dc2625",
          muted:   "#5d585c",
          label:   "#888485",
          text:    "#e5e3e4",
          sub:     "#868283",
          input:   "#2a2024",
          iborder: "#352c2f",
        }
      }
    }
  },
  plugins: []
}
