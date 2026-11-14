import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IIEST EE'30 | Your department, in sync",
  description: "One calm place for notes, lectures, announcements and assignments."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
