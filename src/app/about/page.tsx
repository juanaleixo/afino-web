import Header from "@/components/Header"

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-center mb-8">
            Sobre o Afino
          </h1>
          <div className="prose prose-lg mx-auto">
            <p className="text-lg text-muted-foreground text-center mb-8">
              O Afino é um hub financeiro inteligente que centraliza contas bancárias, cripto e investimentos, 
              com foco em simplicidade e automação.
            </p>
            
            <div className="grid gap-8 md:grid-cols-2 mt-12">
              <div>
                <h2 className="text-2xl font-bold mb-4">Nossa Missão</h2>
                <p className="text-muted-foreground">
                  Simplificar a gestão financeira através de automação inteligente e visão consolidada 
                  do patrimônio, permitindo que você foque no que realmente importa.
                </p>
              </div>
              
              <div>
                <h2 className="text-2xl font-bold mb-4">Nossa Visão</h2>
                <p className="text-muted-foreground">
                  Ser o hub financeiro mais intuitivo e automatizado do Brasil, conectando todas as 
                  suas fontes de riqueza em uma única plataforma.
                </p>
              </div>
            </div>
            
            <div className="mt-12">
              <h2 className="text-2xl font-bold mb-4 text-center">Stack Tecnológico</h2>
              <div className="grid gap-4 md:grid-cols-3 text-center">
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-2">Backend</h3>
                  <p className="text-sm text-muted-foreground">Supabase (PostgreSQL + Auth)</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-2">Frontend</h3>
                  <p className="text-sm text-muted-foreground">Next.js / Astro</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-2">Integrações</h3>
                  <p className="text-sm text-muted-foreground">Pluggy (Open Finance) + APIs diretas</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 