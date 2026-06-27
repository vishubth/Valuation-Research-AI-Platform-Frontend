import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./lib/providers";
import { AppShell } from "./components/AppShell";

export const metadata: Metadata = {
  title: "VRAIP",
  description: "Valuation platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" style={{ colorScheme: "dark" }}>
      <body className="flex h-full min-h-screen bg-[#0d1117] text-[#e6edf3] antialiased">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
