import type { Metadata, Viewport } from "next";
import RegisterServiceWorker from "@/components/RegisterServiceWorker";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Style Me",
  description: "Your AI wardrobe assistant: catalog your clothes and get outfits for any occasion.",
  applicationName: "Style Me",
  icons: { icon: "/icons/192.png", apple: "/icons/180.png" },
  appleWebApp: { capable: true, title: "Style Me", statusBarStyle: "default" },
};

// Colours the phone's status bar to match the app when it is installed.
export const viewport: Viewport = {
  themeColor: "#fff7ec",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${jakarta.variable} antialiased`}>
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
