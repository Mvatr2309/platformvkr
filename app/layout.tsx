import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import Providers from "./providers";
import Header from "@/components/layout/Header";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Платформа ВКР(С)",
  description: "Платформа сопровождения выпускных квалификационных работ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={montserrat.className}>
        <Providers>
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  );
}
