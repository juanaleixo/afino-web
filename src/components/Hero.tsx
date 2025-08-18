import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Image from "next/image"

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-background py-20 sm:py-32">
      <div className="container relative z-10 mx-auto px-4">
        <div className="mx-auto max-w-4xl text-center">
          <div className="flex justify-center mb-8">
            <Image
              src="/icon.svg"
              alt="Afino Finance"
              width={120}
              height={120}
              className="h-30 w-30"
            />
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl sm:leading-tight">
            Hub financeiro{" "}
            <span className="text-primary">
              inteligente
            </span>{" "}
            para sua vida
          </h1>
          <p className="mt-6 text-lg text-muted-foreground sm:text-xl">
            Centralize contas bancárias, cripto e investimentos com simplicidade e automação. 
            Conecte via Open Finance e APIs externas para uma visão consolidada do seu patrimônio.
          </p>
          
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/signup">
                Começar Grátis
                <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/demo">Ver Demonstração</Link>
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardContent className="p-6">
              <div className="mb-4">
                <svg className="h-8 w-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold">Open Finance</h3>
              <p className="text-sm text-muted-foreground">
                Conecte suas contas bancárias via Pluggy automaticamente
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="mb-4">
                <svg className="h-8 w-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold">Histórico Diário</h3>
              <p className="text-sm text-muted-foreground">
                Acompanhe a evolução dos seus saldos dia a dia
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="mb-4">
                <svg className="h-8 w-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold">Linha do Tempo</h3>
              <p className="text-sm text-muted-foreground">
                Visualize a evolução consolidada do seu patrimônio
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Simple CTA */}
        <div className="mt-20 text-center">
          <p className="text-lg text-muted-foreground mb-6">
            Plano Free para começar • Premium R$ 19,90/mês
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="outline" asChild>
              <Link href="/features">Ver Recursos</Link>
            </Button>
            <Button size="lg" asChild>
              <Link href="/pricing">Ver Planos</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
