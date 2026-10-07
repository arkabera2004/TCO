import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Michroma } from "next/font/google";

import { AuthGate } from "@/components/auth/AuthGate";
import { THEME_STORAGE_KEY, ThemeProvider, type ThemeMode } from "@/context/theme-context";
import "./globals.css";

/* Functional UI face, the default for the whole interface. */
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

/* Display face: identity, page titles, telemetry figures only. */
const michroma = Michroma({
  variable: "--font-michroma",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SAHAY | Wayam AI",
    template: "%s | SAHAY",
  },
  description:
    "Lifecycle cost intelligence for locomotive fleets — TCO simulation, Weibull reliability, Monte Carlo risk, forecasting and tender decision support.",
  applicationName: "SAHAY",
  authors: [{ name: "Wayam AI" }],
  icons: {
    icon: "/favicon.svg",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    title: "SAHAY",
  },
  openGraph: {
    siteName: "SAHAY",
    title: "SAHAY — Fleet Lifecycle Intelligence",
    description:
      "Fleet lifecycle simulation, forecasting and risk intelligence for locomotive tenders.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SAHAY — Fleet Lifecycle Intelligence",
  },
};

function themeFromCookie(value: string | undefined): ThemeMode {
  return value === "dark" ? "dark" : "light";
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const cookieStore = await cookies();
  const theme = themeFromCookie(cookieStore.get(THEME_STORAGE_KEY)?.value);

  return (
    <html
      lang="en"
      data-theme={theme}
      style={{ colorScheme: theme }}
      suppressHydrationWarning
      className={`${geist.variable} ${michroma.variable} h-full antialiased`}
    >
      <body className="h-full overflow-hidden">
        <ThemeProvider initialTheme={theme}>
          <AuthGate>{children}</AuthGate>
        </ThemeProvider>
      </body>
    </html>
  );
}
