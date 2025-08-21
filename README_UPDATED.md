# Afino - Hub Financeiro Inteligente

> **Registre e acompanhe seu patrimônio de forma simples e visual**

## 🎯 Visão do Produto

O Afino foca em **registrar fotos do patrimônio** ao invés de gerenciar transações financeiras complexas. É ideal para quem quer:

- 📸 **Inventariar** o patrimônio atual
- 📊 **Acompanhar** evolução ao longo do tempo  
- 💰 **Avaliar** posições manualmente
- 🔍 **Visualizar** dados de forma clara e intuitiva

## ✨ Funcionalidades Principais

### 💫 Foco em Simplicidade
- **Adicionar Posição**: Registre ativos que você já possui (sem afetar caixa)
- **Avaliação**: Defina preços manuais para seus ativos
- **Depósitos/Saques**: Controle entrada e saída de dinheiro
- **Compra** (opcional): Para quem quer controle financeiro completo

### 📈 Visualizações
- **Timeline Interativa**: Evolução do patrimônio ao longo do tempo
- **Holdings**: Visão atual de todas as posições
- **Gráficos**: Análise visual da performance

### 🏆 Recursos Premium
- **Dados Diários**: Granularidade de dados por dia
- **Múltiplas Contas**: Organize por corretoras/bancos
- **Análise Avançada**: Métricas de performance detalhadas

## 🚀 Tipos de Eventos Suportados

| Tipo | Descrição | Afeta Caixa | Uso Principal |
|------|-----------|-------------|---------------|
| **📥 Depósito** | Adicionar dinheiro/ativos | ✅ Sim | Entrada de recursos |
| **📤 Saque** | Retirar dinheiro/ativos | ✅ Sim | Saída de recursos |
| **➕ Adicionar Posição** | Registrar ativos existentes | ❌ Não | Inventário inicial |
| **🛒 Compra** | Comprar com impacto no caixa | ✅ Sim | Transação completa |
| **💰 Avaliação** | Definir preço manual | ❌ Não | Precificação |

## 📊 Casos de Uso

### Cenário 1: Inventário Inicial
```
🎯 Objetivo: "Quero registrar tudo que tenho hoje"

1. Adicionar Posição: 100 ações PETR4
2. Adicionar Posição: 0.5 BTC  
3. Adicionar Posição: 200g Ouro
4. Avaliação: Definir preços atuais

✅ Resultado: Patrimônio mapeado sem afetar caixa
```

### Cenário 2: Acompanhamento Financeiro
```
🎯 Objetivo: "Quero controlar minhas transações"

1. Depósito: R$ 10.000 na conta
2. Compra: 400 ações VALE3 por R$ 25
3. Avaliação: Atualizar preço para R$ 27

✅ Resultado: Controle completo de caixa + posições
```

## 🏗️ Arquitetura

### Frontend (Next.js 15)
- **React 18** com Server Components
- **TypeScript** para type safety  
- **Tailwind CSS** para styling
- **Supabase Client** para dados em tempo real

### Backend (Supabase)
- **PostgreSQL** para dados estruturados
- **Row Level Security** para isolamento de usuários
- **Functions** para business logic complexa
- **Real-time** para atualizações instantâneas

### Performance
- **Sistema de Cache** inteligente
- **Singleton Pattern** para services
- **Promise Pooling** para evitar chamadas duplicadas

## 🛠️ Desenvolvimento

### Requisitos
```bash
Node.js 18+
npm ou yarn
Supabase CLI (opcional)
```

### Setup Local
```bash
# Clone e install
git clone https://github.com/your-org/afino-web
cd afino-web
npm install

# Configure environment
cp .env.example .env.local
# Adicione suas chaves do Supabase

# Run development
npm run dev
```

### Scripts Disponíveis
```bash
npm run dev        # Desenvolvimento
npm run build      # Build produção
npm run start      # Servidor produção
npm run lint       # ESLint
npm run test       # Jest tests
```

## 🗄️ Banco de Dados

### Aplicar Migrations
```sql
-- No Supabase SQL Editor:
\i database/functions/api_user_context.sql
\i database/functions/api_holdings_with_assets.sql
\i database/indexes/performance_optimizations.sql
\i database/migrations/2025-08-21_position_add_feature.sql
```

### Schema Principal
- **events**: Todos os eventos financeiros
- **accounts**: Contas/carteiras do usuário  
- **global_assets**: Catálogo de ativos
- **daily_positions_acct**: Snapshots diários das posições

## 🚦 Status do Projeto

### ✅ Implementado
- [x] Sistema de cache avançado
- [x] Context global para user plan
- [x] Singleton pattern para services
- [x] Interface para eventos básicos
- [x] Timeline interativa
- [x] Performance otimizada (60-80% mais rápido)

### 🚧 Em Desenvolvimento
- [ ] Funcionalidade "Adicionar Posição"
- [ ] Migração assistida para usuários
- [ ] Onboarding melhorado
- [ ] Análise de performance avançada

### 📋 Planejado
- [ ] App mobile (React Native)
- [ ] Integração com corretoras
- [ ] Importação via CSV/Excel
- [ ] Relatórios PDF
- [ ] API pública

## 🤝 Contribuição

### Reportar Issues
Use o [GitHub Issues](https://github.com/your-org/afino-web/issues) para:
- 🐛 Bugs encontrados  
- 💡 Sugestões de features
- 📖 Melhorias na documentação

### Development Guidelines
1. **Foque na simplicidade** - o app deve ser fácil de usar
2. **Performance first** - cada feature deve ser otimizada
3. **Teste antes de comitar** - garanta que tudo funciona
4. **Documente mudanças** - atualize README e documentação

## 📄 Licença

MIT License - veja [LICENSE](LICENSE) para detalhes.

## 🔗 Links Úteis

- [Documentação Completa](docs/)
- [API Reference](docs/api/)
- [Supabase Dashboard](https://supabase.com/dashboard)
- [Feedback & Suporte](mailto:support@afino.com.br)