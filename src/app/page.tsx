"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth"
import Header from "@/components/Header"
import Hero from "@/components/Hero"

import Footer from "@/components/Footer"
import { Loader2 } from "lucide-react"

export default function HomePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard")
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span>Carregando...</span>
        </div>
      </div>
    )
  }

  if (user) {
    return null // Será redirecionado pelo useEffect
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
      </main>
      <Footer />
    </div>
  )
}
