import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "@/styles/globals.css"
import { ThemeProvider } from "next-themes"
import { AuthProvider } from "@/lib/auth"
import { UserPlanProvider } from "@/contexts/UserPlanContext"
import { Toaster } from "sonner"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Afino - Hub Financeiro Inteligente",
  description: "Centralize contas bancárias, cripto e investimentos com simplicidade e automação",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.png",
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
            <UserPlanProvider>
              {children}
              <Toaster />
            </UserPlanProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
