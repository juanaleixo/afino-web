# Stripe Integration Documentation

## Visão Geral

A integração com o Stripe foi estruturada usando o schema `pay` no banco de dados para separar as preocupações de pagamento do resto da aplicação. O status premium dos usuários é mantido na tabela `public.user_profiles` através de triggers automáticos.

## Arquitetura do Banco de Dados

### Schema `pay`

#### Tabelas:

1. **`pay.subscription_plans`** - Planos de assinatura disponíveis
2. **`pay.subscriptions`** - Assinaturas dos usuários  
3. **`pay.customers`** - Informações dos clientes Stripe
4. **`pay.webhook_events`** - Eventos de webhook para auditoria

### Schema `public`

#### Campos adicionados em `user_profiles`:
- `is_premium: boolean` - Status premium do usuário
- `premium_expires_at: timestamp` - Data de expiração do premium
- `stripe_customer_id: text` - ID do cliente no Stripe
- `current_subscription_id: uuid` - Referência à assinatura atual

## Configuração

### Variáveis de Ambiente

```env
# Stripe Keys
STRIPE_PUBLISHABLE_KEY=pk_test_... # ou pk_live_...
STRIPE_SECRET_KEY=sk_test_... # ou sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Configuração dos Planos

Os planos são configurados em `src/lib/stripe.ts`:

```typescript
export const SUBSCRIPTION_PLANS = {
  FREE: { /* configuração do plano gratuito */ },
  PREMIUM: { /* configuração do plano premium */ }
}
```

## Fluxo de Assinatura

### 1. Checkout Session

```typescript
// Criar sessão de checkout
const response = await fetch('/api/stripe/create-checkout-session', {
  method: 'POST',
  body: JSON.stringify({
    priceId: 'price_xxx',
    userId: 'user_id',
    successUrl: 'https://app.com/success',
    cancelUrl: 'https://app.com/canceled'
  })
})
```

### 2. Webhooks

Os seguintes eventos são tratados:

- `customer.subscription.created` - Nova assinatura criada
- `customer.subscription.updated` - Assinatura atualizada
- `customer.subscription.deleted` - Assinatura cancelada  
- `invoice.payment_succeeded` - Pagamento bem-sucedido
- `invoice.payment_failed` - Falha no pagamento

### 3. Atualização Automática do Status Premium

Um trigger no banco atualiza automaticamente o `user_profiles`:

```sql
CREATE TRIGGER trigger_update_user_premium_status
  AFTER INSERT OR UPDATE OR DELETE ON pay.subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_user_premium_status();
```

## API Routes

### `/api/stripe/create-checkout-session`
- **POST** - Cria uma sessão de checkout do Stripe
- Parâmetros: `priceId`, `userId`, `successUrl`, `cancelUrl`

### `/api/stripe/webhook`
- **POST** - Endpoint para webhooks do Stripe
- Processa eventos de assinatura automaticamente

### `/api/stripe/create-portal-session`
- **POST** - Cria sessão do Customer Portal
- Permite que usuários gerenciem suas assinaturas

## Hooks e Utilitários

### `useSubscription`

Hook React para gerenciar assinaturas:

```typescript
const {
  subscription,
  isPremium,
  isLoading,
  error,
  createCheckoutSession,
  createPortalSession,
  cancelSubscription,
  refetch
} = useSubscription()
```

### `subscriptionService`

Serviço para operações de assinatura:

```typescript
import { subscriptionService } from '@/lib/services/subscription-service'

// Verificar se usuário é premium
const isPremium = await subscriptionService.isPremiumUser(userId)

// Obter assinatura atual
const subscription = await subscriptionService.getUserSubscription(userId)

// Obter planos disponíveis
const plans = await subscriptionService.getAvailablePlans()
```

## Configuração do Stripe Dashboard

### 1. Produtos e Preços

Crie os produtos no Stripe Dashboard:

1. **Free Plan**: Produto gratuito (R$ 0,00/mês)
2. **Premium Plan**: Produto premium (R$ 19,90/mês)

### 2. Webhooks

Configure o endpoint webhook:
- **URL**: `https://yourdomain.com/api/stripe/webhook`
- **Eventos**:
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`

### 3. Customer Portal

Configure o Customer Portal no Stripe Dashboard para permitir que clientes:
- Atualizem métodos de pagamento
- Visualizem faturas
- Cancelem assinaturas
- Baixem recibos

## Migrações Necessárias

Execute as migrações na seguinte ordem:

1. `database/schemas/pay_schema.sql` - Criar schema pay
2. `database/tables/pay/subscription_plans.sql` - Tabela de planos
3. `database/tables/pay/customers.sql` - Tabela de clientes
4. `database/tables/pay/subscriptions.sql` - Tabela de assinaturas
5. `database/tables/pay/webhook_events.sql` - Tabela de eventos
6. `database/migrations/add_premium_fields_to_user_profiles.sql` - Campos premium

## Segurança

### RLS (Row Level Security)

Todas as tabelas do schema `pay` possuem RLS habilitado:

- **Usuários** podem visualizar apenas seus próprios dados
- **Service Role** tem acesso completo para webhooks
- **Anon** pode visualizar planos públicos

### Validações

- Validação de assinatura existente antes de criar checkout
- Verificação de webhooks com assinatura do Stripe
- Validação de Price IDs contra planos configurados

## Monitoramento

### Logs

Todos os eventos importantes são logados:
- Criação/atualização de assinaturas
- Processamento de webhooks
- Erros de integração

### Webhook Events

Todos os webhooks são armazenados em `pay.webhook_events` para auditoria:
- ID do evento Stripe
- Tipo de evento
- Status de processamento
- Dados completos do evento

## Tratamento de Erros

### Webhooks

- Eventos duplicados são ignorados (idempotência)
- Falhas são logadas mas não interrompem o fluxo
- Retry automático para webhooks falhados

### Checkout

- Validações de usuário e planos
- Tratamento de assinaturas existentes  
- Redirecionamento adequado em caso de erro

## Testing

### Stripe Test Mode

Use as chaves de teste do Stripe para desenvolvimento:

```env
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
```

### Webhooks Testing

Use o Stripe CLI para testar webhooks localmente:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

### Cards de Teste

Use os cartões de teste do Stripe:
- **Sucesso**: `4242 4242 4242 4242`
- **Falha**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0000 0000 3220`