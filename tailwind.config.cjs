module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        glow: '0 0 20px rgba(45, 212, 191, 0.25)',
        'glow-lg': '0 0 40px rgba(45, 212, 191, 0.3)',
        card: '0 8px 32px rgba(0, 0, 0, 0.4)',
        modal: '0 24px 64px rgba(0, 0, 0, 0.6)',
      },
    },
  },
  plugins: [],
}
