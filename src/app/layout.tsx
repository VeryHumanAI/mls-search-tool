import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

// Initialize the Inter font
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MLS Property Search Tool",
  description: "Find properties based on drive time and budget constraints",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link
          href="https://cdn.jsdelivr.net/npm/tailwindcss@latest/dist/tailwind.min.css"
          rel="stylesheet"
        />
        {/* Add Leaflet CSS */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body className={`${inter.className} min-h-screen bg-gray-50`} suppressHydrationWarning>
        <div className="mx-auto max-w-7xl">
          <header className="bg-white shadow-sm">
            <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
              <h1 className="text-lg font-semibold leading-7 text-gray-900">MLS Property Search</h1>
            </div>
          </header>
          <main>{children}</main>
          <footer className="bg-white mt-12 py-6 border-t">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <p className="text-center text-sm text-gray-500">
                © {new Date().getFullYear()} MLS Property Search Tool
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
