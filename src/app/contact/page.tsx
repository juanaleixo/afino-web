"use client"

import Header from "@/components/Header"

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-center mb-8">
            Entre em Contato
          </h1>
          
          <div className="grid md:grid-cols-2 gap-12">
            {/* Contact Form */}
            <div>
              <h2 className="text-2xl font-bold mb-6">Envie uma mensagem</h2>
              <form className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-2">
                    Nome
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Seu nome completo"
                  />
                </div>
                
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="seu@email.com"
                  />
                </div>
                
                <div>
                  <label htmlFor="subject" className="block text-sm font-medium mb-2">
                    Assunto
                  </label>
                  <select
                    id="subject"
                    name="subject"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Selecione um assunto</option>
                    <option value="suporte">Suporte Técnico</option>
                    <option value="vendas">Vendas</option>
                    <option value="parceria">Parceria</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="message" className="block text-sm font-medium mb-2">
                    Mensagem
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={6}
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Conte-nos como podemos ajudar..."
                  />
                </div>
                
                <button
                  type="submit"
                  className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                  Enviar Mensagem
                </button>
              </form>
            </div>
            
            {/* Contact Info */}
            <div>
              <h2 className="text-2xl font-bold mb-6">Informações de Contato</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Email</h3>
                  <p className="text-muted-foreground">contato@Afino-finance.com</p>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-2">Suporte</h3>
                  <p className="text-muted-foreground">suporte@Afino-finance.com</p>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-2">Horário de Atendimento</h3>
                  <p className="text-muted-foreground">
                    Segunda a Sexta: 9h às 18h<br />
                    Sábado: 9h às 12h
                  </p>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-2">Endereço</h3>
                  <p className="text-muted-foreground">
                    Rua das Finanças, 123<br />
                    São Paulo - SP<br />
                    CEP: 01234-567
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 