import Header from "@/components/Header"
import Link from "next/link"
import { StripePricingTable } from "@/components/stripe/StripePricingTable"

export default function PricingPage() {

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

        {/* Stripe Pricing Table */}
        <div className="max-w-5xl mx-auto mb-16">
          <StripePricingTable className="w-full" />
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