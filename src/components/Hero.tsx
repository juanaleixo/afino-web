import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Image from "next/image"

export default function Hero() {
  return (
    <section className="relative overflow-hidden py-20 sm:py-32">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/10" />
      
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-32 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-32 w-80 h-80 bg-secondary/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-pulse delay-500" />
      </div>

      <div className="container relative z-10 mx-auto px-4">
        <div className="mx-auto max-w-4xl text-center">
          {/* Logo with enhanced styling */}
          <div className="flex justify-center mb-8 animate-fade-in-up">
            <div className="relative p-4 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 backdrop-blur-sm border border-primary/20 shadow-lg">
              <Image
                src="/icon.svg"
                alt="Afino Finance"
                width={80}
                height={80}
                className="h-20 w-20 drop-shadow-lg"
              />
            </div>
          </div>

          {/* Enhanced Title with Gradient */}
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl sm:leading-tight animate-fade-in-up delay-150">
            Hub financeiro{" "}
            <span className="bg-gradient-to-r from-primary via-blue-600 to-purple-600 bg-clip-text text-transparent animate-pulse">
              inteligente
            </span>{" "}
            para sua vida
          </h1>

          {/* Enhanced Description */}
          <p className="mt-6 text-lg text-muted-foreground sm:text-xl leading-relaxed animate-fade-in-up delay-300 max-w-3xl mx-auto">
            Centralize contas bancárias, cripto e investimentos com simplicidade e automação. 
            Conecte via Open Finance e APIs externas para uma visão consolidada do seu patrimônio.
          </p>
          
          {/* Enhanced CTA Buttons */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row animate-fade-in-up delay-450">
            <Button size="lg" className="btn-gradient shadow-lg hover:shadow-xl transition-all duration-300 group" asChild>
              <Link href="/signup">
                <span className="flex items-center">
                  Começar Grátis
                  <svg className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="border-2 hover:bg-primary/5 hover:border-primary/50 transition-all duration-300" asChild>
              <Link href="/demo">Ver Demonstração</Link>
            </Button>
          </div>
        </div>

        {/* Enhanced Features Grid */}
        <div className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 animate-fade-in-up delay-600">
          <Card className="card-hover border-0 bg-gradient-to-br from-card/50 to-card backdrop-blur-sm shadow-lg">
            <CardContent className="p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 shadow-inner">
                <svg className="h-6 w-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold">Open Finance</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Conecte suas contas bancárias via Pluggy automaticamente
              </p>
            </CardContent>
          </Card>

          <Card className="card-hover border-0 bg-gradient-to-br from-card/50 to-card backdrop-blur-sm shadow-lg">
            <CardContent className="p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-secondary/20 to-secondary/10 shadow-inner">
                <svg className="h-6 w-6 text-secondary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold">Histórico Diário</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Acompanhe a evolução dos seus saldos dia a dia
              </p>
            </CardContent>
          </Card>

          <Card className="card-hover border-0 bg-gradient-to-br from-card/50 to-card backdrop-blur-sm shadow-lg">
            <CardContent className="p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-accent/20 to-accent/10 shadow-inner">
                <svg className="h-6 w-6 text-accent-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold">Linha do Tempo</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Visualize a evolução consolidada do seu patrimônio
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced CTA Section */}
        <div className="mt-20 text-center animate-fade-in-up delay-700">
          <div className="relative p-8 rounded-2xl bg-gradient-to-r from-primary/5 via-secondary/5 to-accent/5 backdrop-blur-sm border border-primary/10 shadow-xl">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-2xl blur-xl" />
            <div className="relative">
              <p className="text-lg text-muted-foreground mb-6 font-medium">
                <span className="text-primary font-semibold">Plano Free</span> para começar • <span className="text-secondary font-semibold">Premium R$ 19,90/mês</span>
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="border-2 hover:bg-primary/10 hover:border-primary/50 transition-all duration-300 shadow-md hover:shadow-lg" 
                  asChild
                >
                  <Link href="/features">Ver Recursos</Link>
                </Button>
                <Button 
                  size="lg" 
                  className="btn-gradient shadow-lg hover:shadow-xl transition-all duration-300" 
                  asChild
                >
                  <Link href="/pricing">Ver Planos</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
