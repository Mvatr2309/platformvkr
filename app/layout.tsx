import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import Providers from "./providers";
import AppSidebar from "@/components/layout/AppSidebar";
import FeedbackButton from "@/components/FeedbackButton";
import OnboardingTour from "@/components/OnboardingTour";
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
          <AppSidebar>{children}</AppSidebar>
          <OnboardingTour />
          <FeedbackButton />
        </Providers>
      </body>
    </html>
  );
}
