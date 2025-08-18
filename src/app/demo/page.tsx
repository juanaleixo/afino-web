import Header from "@/components/Header"
import Link from "next/link"

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-6">
            Demonstração da Plataforma
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8">
            Veja como a Afino Finance pode transformar sua gestão financeira
          </p>
          
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-8 mb-12">
            <h2 className="text-2xl font-bold mb-4">
              🎥 Demonstração Interativa
            </h2>
            <p className="text-muted-foreground mb-6">
              Em breve você poderá experimentar nossa plataforma em primeira mão. 
              Estamos preparando uma demonstração completa para você.
            </p>
            
            <div className="bg-muted rounded-lg p-8 mb-6">
              <div className="text-6xl mb-4">📱</div>
              <h3 className="text-lg font-semibold mb-2">Dashboard Interativo</h3>
              <p className="text-muted-foreground">
                Explore gráficos, relatórios e métricas em tempo real
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="bg-background rounded-lg p-4 border">
                <div className="text-2xl mb-2">📊</div>
                <h4 className="font-semibold">Análise de Gastos</h4>
                <p className="text-sm text-muted-foreground">Visualize seus gastos por categoria</p>
              </div>
              <div className="bg-background rounded-lg p-4 border">
                <div className="text-2xl mb-2">🎯</div>
                <h4 className="font-semibold">Metas Financeiras</h4>
                <p className="text-sm text-muted-foreground">Acompanhe o progresso das suas metas</p>
              </div>
              <div className="bg-background rounded-lg p-4 border">
                <div className="text-2xl mb-2">📈</div>
                <h4 className="font-semibold">Relatórios</h4>
                <p className="text-sm text-muted-foreground">Relatórios detalhados e personalizados</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">
              Pronto para começar?
            </h2>
            <p className="text-muted-foreground">
              Crie sua conta gratuita e comece a transformar suas finanças hoje mesmo
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Criar Conta Grátis
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              >
                Falar com Especialista
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 