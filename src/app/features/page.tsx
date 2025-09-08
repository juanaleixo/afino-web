import Header from "@/components/Header"
import Link from "next/link"

export default function FeaturesPage() {
  const features = [
    {
      title: "Registro Manual de Patrimônio",
      description: "Registre manualmente seus investimentos, contas e cripto para ter uma visão consolidada.",
      icon: "📝",
      benefits: ["Entrada manual de dados", "Múltiplos tipos de ativo", "Organização centralizada"]
    },
    {
      title: "Acompanhamento Histórico",
      description: "Registre a evolução do seu patrimônio ao longo do tempo para visualizar tendências.",
      icon: "📈",
      benefits: ["Histórico personalizado", "Gráficos de evolução", "Comparação temporal"]
    },
    {
      title: "Timeline de Investimentos",
      description: "Visualize a linha do tempo dos seus investimentos com dados que você mesmo registra.",
      icon: "⏱️",
      benefits: ["Visualização temporal", "Marcos importantes", "Histórico organizado"]
    },
    {
      title: "Gestão de Ativos Personalizados",
      description: "Cadastre e gerencie seus próprios ativos, incluindo investimentos únicos ou personalizados.",
      icon: "🏗️",
      benefits: ["Ativos customizados", "Flexibilidade total", "Controle manual"]
    },
    {
      title: "Dashboard Consolidado",
      description: "Visualize todos seus dados registrados em um dashboard limpo e organizado.",
      icon: "📊",
      benefits: ["Visão unificada", "Métricas básicas", "Interface limpa"]
    },
    {
      title: "Planos Free e Premium",
      description: "Comece gratuitamente com funcionalidades básicas, upgrade para recursos avançados.",
      icon: "⭐",
      benefits: ["Versão gratuita", "Upgrade opcional", "Sem obrigatoriedade"]
    }
  ]

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4">
            Ferramenta simples para{" "}
            <span className="text-primary">organizar seus investimentos</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Registre manualmente seus investimentos e acompanhe a evolução do seu patrimônio 
            com gráficos e relatórios organizados. Controle total dos seus dados.
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

        {/* Seção de transparência */}
        <div className="bg-muted/50 rounded-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-center">
            ℹ️ Como funciona atualmente
          </h2>
          <div className="max-w-3xl mx-auto space-y-4 text-muted-foreground">
            <p>
              <strong>Entrada manual:</strong> Você precisa registrar manualmente seus investimentos, 
              valores e atualizações. Não há conexão automática com bancos ou corretoras.
            </p>
            <p>
              <strong>Dados próprios:</strong> Todas as informações são inseridas por você. 
              A plataforma organiza e visualiza os dados que você fornece.
            </p>
            <p>
              <strong>Gráficos e análises:</strong> Com base nos dados que você registra, 
              geramos gráficos de evolução e métricas básicas de performance.
            </p>
            <p>
              <strong>Plano gratuito:</strong> Funcionalidades básicas disponíveis sem custo. 
              Premium oferece histórico diário e funcionalidades extras.
            </p>
          </div>
        </div>

        {/* Seção sobre evolução */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-8 mb-8 border border-blue-200/50 dark:border-blue-800/50">
          <h2 className="text-2xl font-semibold mb-4 text-center flex items-center justify-center gap-2">
            🚀 Em Constante Evolução
          </h2>
          <div className="max-w-3xl mx-auto space-y-4 text-muted-foreground">
            <p>
              <strong>Desenvolvimento contínuo:</strong> Estamos constantemente trabalhando em novos recursos, 
              automações e simulações para melhorar sua experiência de gestão financeira.
            </p>
            <p>
              <strong>Roadmap transparente:</strong> Novas funcionalidades são desenvolvidas com base no 
              feedback dos usuários e necessidades identificadas pela comunidade.
            </p>
            <p>
              <strong>Atualizações regulares:</strong> A plataforma recebe melhorias frequentes, 
              tanto em funcionalidades quanto em interface e performance.
            </p>
            <p>
              <strong>Visão de longo prazo:</strong> Nossa missão é evoluir para ser a ferramenta 
              mais completa e intuitiva para gestão patrimonial pessoal.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">
            Pronto para organizar seus investimentos?
          </h2>
          <p className="text-muted-foreground mb-6">
            Comece gratuitamente e veja se a ferramenta atende suas necessidades
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Começar Grátis
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              Ver Demonstração
            </Link>
          </div>
        </div>

      </main>
    </div>
  )
} 