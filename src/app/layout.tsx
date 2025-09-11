import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "@/styles/globals.css"
import { ThemeProvider } from "next-themes"
import { AuthProvider } from "@/lib/auth"
import { UserContextProvider } from "@/contexts/UserContextProvider"
import { Toaster } from "sonner"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Afino - Hub Financeiro Inteligente",
  description: "Centralize contas bancárias, cripto e investimentos com simplicidade e automação. Conecte via Open Finance e APIs externas para uma visão consolidada do seu patrimônio.",
  keywords: "gestão financeira, open finance, investimentos, cripto, contas bancárias, dashboard financeiro, automação financeira, brasil",
  authors: [{ name: "Afino" }],
  creator: "Afino",
  publisher: "Afino",
  robots: "index, follow",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.png",
  },
  openGraph: {
    title: "Afino - Hub Financeiro Inteligente",
    description: "Centralize contas bancárias, cripto e investimentos com simplicidade e automação",
    type: "website",
    locale: "pt_BR",
    images: [
      {
        url: "/icon.png",
        width: 512,
        height: 512,
        alt: "Afino Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Afino - Hub Financeiro Inteligente",
    description: "Centralize contas bancárias, cripto e investimentos com simplicidade e automação",
    images: ["/icon.png"],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <UserContextProvider>
              {children}
              <Toaster />
            </UserContextProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
