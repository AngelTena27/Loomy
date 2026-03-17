import { createRootRoute, Outlet, HeadContent, Scripts } from '@tanstack/react-router'
import { LanguageProvider } from '../lib/i18n'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    ],
    scripts: [
      {
        src: 'https://cdn.tailwindcss.com',
      },
      {
        children: `
          tailwind.config = {
            theme: {
              extend: {
                colors: {
                  brand: { DEFAULT: '#2dd4bf', dark: '#0d9488' },
                },
                boxShadow: {
                  glow: '0 0 20px rgba(45,212,191,0.25)',
                  'glow-lg': '0 0 40px rgba(45,212,191,0.3)',
                  card: '0 8px 32px rgba(0,0,0,0.4)',
                  modal: '0 24px 64px rgba(0,0,0,0.6)',
                },
              },
            },
          }
        `,
      },
      {
        children: `
          (function() {
            const style = document.createElement('style');
            style.textContent = \`
              *, *::before, *::after { box-sizing: border-box; }
              body { margin: 0; background-color: #07070f; color: #f0f0ff; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif; -webkit-font-smoothing: antialiased; }
              ::-webkit-scrollbar { width: 4px; height: 4px; }
              ::-webkit-scrollbar-track { background: transparent; }
              ::-webkit-scrollbar-thumb { background: #1e1e38; border-radius: 4px; }
              ::-webkit-scrollbar-thumb:hover { background: #2a2a4a; }
              ::selection { background: rgba(45,212,191,0.2); color: #f0f0ff; }
              .bg-grid-teal { background-image: linear-gradient(rgba(45,212,191,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(45,212,191,0.03) 1px, transparent 1px); background-size: 44px 44px; }
              .text-gradient-teal { background: linear-gradient(135deg, #2dd4bf, #5eead4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
              .react-flow__attribution { display: none !important; }
              .react-flow__controls button { background: #0e0e1c !important; border: 1px solid #1e1e38 !important; fill: #6b7a99 !important; }
              .react-flow__controls button:hover { background: #151528 !important; fill: #2dd4bf !important; }
              .react-flow__minimap { border: 1px solid #1e1e38 !important; border-radius: 8px !important; overflow: hidden !important; }
              .react-flow__handle { background: #2dd4bf !important; border: 2px solid #07070f !important; width: 10px !important; height: 10px !important; }
              @keyframes float-a { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }
              @keyframes float-b { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
              @keyframes float-c { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-16px)} }
              @keyframes shimmer { 0%{opacity:0.4} 50%{opacity:1} 100%{opacity:0.4} }
              .float-a { animation: float-a 5s ease-in-out infinite; }
              .float-b { animation: float-b 5s ease-in-out infinite 1.8s; }
              .float-c { animation: float-c 5s ease-in-out infinite 3.4s; }
              .shimmer { animation: shimmer 3s ease-in-out infinite; }
            \`;
            document.head.appendChild(style);
          })();
        `,
      },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <LanguageProvider>
          <Outlet />
        </LanguageProvider>
        <Scripts />
      </body>
    </html>
  )
}
