import Header from "@/components/Header"
import Link from "next/link"
import { StripePricingTable } from "@/components/stripe/StripePricingTable"

export default function PricingPage() {
  const plans = [
    {
      name: "Free",
      price: "R$0",
      period: "/mês",
      description: "Para começar a organizar seus investimentos",
      features: [
        "Registro ilimitado de ativos",
        "Timeline histórica mensal", 
        "Análises básicas de performance",
        "Suporte por email"
      ],
      limitations: [],
      href: "/signup",
      cta: "Começar Grátis",
      popular: false
    },
    {
      name: "Premium",
      price: "R$19,90",
      period: "/mês",
      description: "Para análises avançadas e recursos exclusivos",
      features: [
        "Tudo do Free, mais:",
        "Timeline histórica diária",
        "Análises avançadas de performance", 
        "Suporte prioritário",
        "Acesso antecipado a novas funcionalidades"
      ],
      limitations: [],
      href: "/signup",
      cta: "Começar Teste Grátis",
      popular: true
    }
  ]

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4">
            Planos transparentes para{" "}
            <span className="text-primary">organizar seus investimentos</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Comece gratuitamente e faça upgrade apenas se precisar de funcionalidades avançadas. 
            Sem pegadinhas, cancele quando quiser.
          </p>
          
          {/* Badge de garantia */}
          <div className="mt-6 inline-flex items-center gap-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-4 py-2 rounded-full text-sm font-medium">
            ✅ 14 dias de teste gratuito no Premium
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid gap-8 md:grid-cols-2 max-w-5xl mx-auto mb-16">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative rounded-xl border bg-card p-8 ${
                plan.popular 
                  ? 'border-primary shadow-xl scale-105 bg-gradient-to-b from-card to-primary/5' 
                  : 'hover:shadow-lg transition-shadow'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-primary to-blue-600 text-white px-4 py-1 rounded-full text-sm font-medium shadow-lg">
                    ⭐ Recomendado
                  </span>
                </div>
              )}
              
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-5xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground text-lg">{plan.period}</span>
                </div>
                <p className="text-muted-foreground text-lg">{plan.description}</p>
              </div>

              {/* Features */}
              <div className="mb-6">
                <h4 className="font-semibold mb-3 text-sm uppercase tracking-wide text-muted-foreground">
                  O que está incluído:
                </h4>
                <ul className="space-y-3">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start">
                      <span className="text-green-500 mr-3 mt-0.5 flex-shrink-0">✓</span>
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

          {/* Limitations for Free plan */}
              {plan.limitations && plan.limitations.length > 0 && (
                <div className="mb-6 p-3 bg-muted/50 rounded-lg">
                  <h4 className="font-semibold mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                    Limitações:
                  </h4>
                  <ul className="space-y-2">
                    {plan.limitations.map((limitation, limitIndex) => (
                      <li key={limitIndex} className="flex items-start text-xs text-muted-foreground">
                        <span className="mr-2 mt-0.5 flex-shrink-0">•</span>
                        <span>{limitation}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Link
                href={plan.href}
                className={`w-full inline-flex items-center justify-center rounded-lg px-6 py-4 text-base font-semibold transition-all duration-200 ${
                  plan.popular
                    ? 'bg-gradient-to-r from-primary to-blue-600 text-white hover:from-primary/90 hover:to-blue-600/90 shadow-lg hover:shadow-xl'
                    : 'border-2 border-primary text-primary hover:bg-primary hover:text-white'
                }`}
              >
                {plan.cta}
                {plan.popular && <span className="ml-2">→</span>}
              </Link>

              {plan.popular && (
                <p className="text-center mt-3 text-xs text-muted-foreground">
                  Cancele quando quiser • Sem compromisso
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Comparison Table */}
        <div className="max-w-4xl mx-auto mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">
            Comparação Detalhada
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border rounded-lg">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 font-semibold">Funcionalidade</th>
                  <th className="text-center p-4 font-semibold">Free</th>
                  <th className="text-center p-4 font-semibold">Premium</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-4">Registro de ativos</td>
                  <td className="p-4 text-center">✅ Ilimitado</td>
                  <td className="p-4 text-center">✅ Ilimitado</td>
                </tr>
                <tr className="border-b bg-muted/20">
                  <td className="p-4">Timeline histórica</td>
                  <td className="p-4 text-center">📅 Mensal</td>
                  <td className="p-4 text-center">📈 Diária</td>
                </tr>
                <tr className="border-b">
                  <td className="p-4">Análises de performance</td>
                  <td className="p-4 text-center">📊 Básicas</td>
                  <td className="p-4 text-center">🚀 Avançadas</td>
                </tr>
                <tr className="border-b bg-muted/20">
                  <td className="p-4">Suporte</td>
                  <td className="p-4 text-center">📧 Email</td>
                  <td className="p-4 text-center">⚡ Prioritário</td>
                </tr>
                <tr className="border-b">
                  <td className="p-4">Novas funcionalidades</td>
                  <td className="p-4 text-center">🕐 Padrão</td>
                  <td className="p-4 text-center">🎯 Acesso antecipado</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">
            Perguntas Frequentes
          </h2>
          <div className="space-y-4">
            <div className="border rounded-xl p-6 hover:shadow-md transition-shadow">
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                🆓 O plano Free é realmente gratuito?
              </h3>
              <p className="text-muted-foreground">
                Sim! Completamente gratuito, sem limite de tempo. Você pode registrar quantos 
                investimentos quiser e usar todas as funcionalidades básicas para sempre.
              </p>
            </div>
            
            <div className="border rounded-xl p-6 hover:shadow-md transition-shadow">
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                🔄 Posso cancelar a qualquer momento?
              </h3>
              <p className="text-muted-foreground">
                Sim! Cancele quando quiser, sem taxas ou burocracia. Seus dados ficam salvos 
                e você pode reativar o Premium sempre que desejar.
              </p>
            </div>
            
            <div className="border rounded-xl p-6 hover:shadow-md transition-shadow">
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                🎯 Como funciona o teste gratuito?
              </h3>
              <p className="text-muted-foreground">
                14 dias completos de Premium gratuito, sem cobrança antecipada. 
                Teste todas as funcionalidades avançadas antes de decidir.
              </p>
            </div>
            
            <div className="border rounded-xl p-6 hover:shadow-md transition-shadow">
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                🔒 Meus dados estão seguros?
              </h3>
              <p className="text-muted-foreground">
                Todos os dados são criptografados e armazenados com segurança. 
                Não compartilhamos informações com terceiros e você tem controle total dos seus dados.
              </p>
            </div>
            
            <div className="border rounded-xl p-6 hover:shadow-md transition-shadow">
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                📱 Preciso conectar minhas contas bancárias?
              </h3>
              <p className="text-muted-foreground">
                Não! Todo registro é manual. Você insere apenas as informações que desejar, 
                mantendo total controle sobre quais dados compartilhar.
              </p>
            </div>
            
            <div className="border rounded-xl p-6 hover:shadow-md transition-shadow">
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                💳 Quais formas de pagamento aceitem?
              </h3>
              <p className="text-muted-foreground">
                Cartão de crédito, débito e PIX. O pagamento é processado de forma segura 
                e você pode alterar a forma de pagamento a qualquer momento.
              </p>
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="max-w-2xl mx-auto mt-16 text-center">
          <div className="bg-gradient-to-r from-primary/10 to-blue-600/10 rounded-xl p-8 border border-primary/20">
            <h3 className="text-2xl font-bold mb-4">
              Pronto para organizar seus investimentos?
            </h3>
            <p className="text-muted-foreground mb-6">
              Comece gratuitamente hoje mesmo. Sem compromisso, sem pegadinhas.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-6 py-3 font-semibold hover:bg-primary/90 transition-colors"
              >
                Começar Grátis Agora
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center justify-center rounded-lg border border-primary text-primary px-6 py-3 font-semibold hover:bg-primary hover:text-white transition-colors"
              >
                Ver Demonstração
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 