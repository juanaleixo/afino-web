"use client"

import Link from "next/link"
import ThemeSwitch from "./ThemeSwitch"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import Image from "next/image"

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <div className="mr-4 flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <Image
              src="/icon.svg"
              alt="Afino Finance"
              width={32}
              height={32}
              className="h-8 w-8"
            />
            <span className="hidden font-bold sm:inline-block">
              Afino
            </span>
          </Link>
        </div>
        
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <nav className="flex items-center space-x-6 text-sm font-medium">
            <Link
              href="/features"
              className="transition-colors hover:text-foreground/80 text-foreground/60"
            >
              Recursos
            </Link>
            <Link
              href="/pricing"
              className="transition-colors hover:text-foreground/80 text-foreground/60"
            >
              Preços
            </Link>
          </nav>
          
          <div className="flex items-center space-x-2">
            <ThemeSwitch />
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Entrar</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/signup">Começar Grátis</Link>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </Button>
          </div>
        </div>
        
        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden absolute top-16 left-0 right-0 bg-background border-b">
            <div className="space-y-1 px-2 pb-3 pt-2">
              <Link
                href="/features"
                className="block px-3 py-2 text-base font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setIsMenuOpen(false)}
              >
                Recursos
              </Link>
              <Link
                href="/pricing"
                className="block px-3 py-2 text-base font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setIsMenuOpen(false)}
              >
                Preços
              </Link>
              <div className="pt-4 pb-3 border-t">
                <Link
                  href="/login"
                  className="block px-3 py-2 text-base font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Entrar
                </Link>
                <Link
                  href="/signup"
                  className="block px-3 py-2 text-base font-medium text-primary hover:text-primary/80"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Começar Grátis
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
