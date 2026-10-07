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
  title: "SAHAY | Wayam AI",
  description:
    "Locomotive fleet lifecycle cost simulation, forecasting, and risk intelligence platform.",
  icons: {
    icon: "/favicon.svg",
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
