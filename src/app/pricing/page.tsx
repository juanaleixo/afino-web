import Header from "@/components/Header"
import Link from "next/link"

export default function PricingPage() {
  const plans = [
    {
      name: "Free",
      price: "R$ 0",
      period: "/mês",
      description: "Plano básico para começar",
      features: [
        // "Conexão Open Finance básica",
        "Dashboard consolidado",
        "Timeline de dados mensal",
        "Relatórios básicos",
        "Suporte por email"
      ],
      popular: false,
      cta: "Começar Grátis",
      href: "/signup"
    },
    {
      name: "Premium",
      price: "R$ 19,90",
      period: "/mês",
      description: "Histórico completo, automações e insights",
      features: [
        "Histórico diário completo e ilimitado",
        // "Automações avançadas",
        "Insights personalizados",
        // "Pagamentos inteligentes",
        // "APIs de cripto e investimentos",
        "Relatórios premium",
        "Suporte prioritário",
        // "Exportação de dados"
      ],
      popular: true,
      cta: "Começar Premium",
      href: "/signup?plan=premium"
    }
  ]

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4">
            Planos simples para{" "}
            <span className="text-primary">centralizar tudo</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Free para começar, Premium para aproveitar todo o potencial do hub financeiro. 
            Foco em simplicidade e automação.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid gap-8 md:grid-cols-3 max-w-6xl mx-auto mb-16">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative rounded-lg border bg-card p-8 ${
                plan.popular 
                  ? 'border-primary shadow-lg scale-105' 
                  : 'hover:shadow-lg transition-shadow'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                    Mais Popular
                  </span>
                </div>
              )}
              
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <p className="text-muted-foreground">{plan.description}</p>
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-center">
                    <span className="text-primary mr-3">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={`w-full inline-flex items-center justify-center rounded-md px-6 py-3 text-sm font-medium transition-colors ${
                  plan.popular
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'border border-input bg-background hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">
            Perguntas Frequentes
          </h2>
          <div className="space-y-6">
            <div className="border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">
                Posso cancelar a qualquer momento?
              </h3>
              <p className="text-muted-foreground">
                Sim! Você pode cancelar sua assinatura a qualquer momento sem taxas adicionais. 
                Seus dados permanecerão seguros e você pode reativar quando quiser.
              </p>
            </div>
            <div className="border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">
                Há um período de teste gratuito?
              </h3>
              <p className="text-muted-foreground">
                Oferecemos 14 dias de teste gratuito em todos os planos pagos. 
                Você pode testar todas as funcionalidades antes de decidir.
              </p>
            </div>
            <div className="border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">
                Meus dados estão seguros?
              </h3>
              <p className="text-muted-foreground">
                Absolutamente! Utilizamos criptografia de ponta a ponta e seguimos 
                as melhores práticas de segurança para proteger seus dados financeiros.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 