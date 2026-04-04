import "./globals.css";

export const metadata = {
  title: "Storage Books",
  description: "Financial management for self-storage operations",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-white text-slate-900 antialiased">{children}</body>
    </html>
  );
}
