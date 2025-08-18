import Header from "@/components/Header"
import Link from "next/link"

export default function FeaturesPage() {
  const features = [
    {
      title: "Dashboard Inteligente",
      description: "Visualize todas as suas finanças em um só lugar com gráficos interativos e métricas em tempo real.",
      icon: "📊",
      benefits: ["Visão geral completa", "Métricas personalizadas", "Alertas inteligentes"]
    },
    {
      title: "Controle de Receitas e Despesas",
      description: "Categorize automaticamente suas transações e acompanhe seus gastos com facilidade.",
      icon: "💰",
      benefits: ["Categorização automática", "Relatórios detalhados", "Histórico completo"]
    },
    {
      title: "Orçamento Inteligente",
      description: "Crie orçamentos personalizados e receba alertas quando estiver próximo do limite.",
      icon: "🎯",
      benefits: ["Orçamentos flexíveis", "Alertas automáticos", "Acompanhamento em tempo real"]
    },
    {
      title: "Metas Financeiras",
      description: "Defina e acompanhe suas metas de economia, investimento e objetivos financeiros.",
      icon: "🏆",
      benefits: ["Metas personalizadas", "Progresso visual", "Celebração de conquistas"]
    },
    {
      title: "Sincronização Bancária",
      description: "Conecte suas contas bancárias e cartões para sincronização automática de transações.",
      icon: "🔗",
      benefits: ["Sincronização automática", "Múltiplas contas", "Segurança total"]
    },
    {
      title: "Relatórios Avançados",
      description: "Gere relatórios detalhados e exporte seus dados para análise externa.",
      icon: "📈",
      benefits: ["Relatórios personalizados", "Exportação de dados", "Análise temporal"]
    }
  ]

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4">
            Recursos que transformam sua{" "}
            <span className="text-primary">gestão financeira</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Descubra como nossa plataforma pode ajudar você a tomar melhores decisões financeiras 
            e alcançar seus objetivos com ferramentas inteligentes e interface intuitiva.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 mb-16">
          {features.map((feature, index) => (
            <div key={index} className="rounded-lg border bg-card p-6 hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
              <p className="text-muted-foreground mb-4">{feature.description}</p>
              <ul className="space-y-2">
                {feature.benefits.map((benefit, benefitIndex) => (
                  <li key={benefitIndex} className="flex items-center text-sm">
                    <span className="text-primary mr-2">✓</span>
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>


      </main>
    </div>
  )
} 