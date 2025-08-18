# 🚀 Configuração do Projeto Afino

## 📋 Pré-requisitos

- Node.js 18+ 
- npm ou yarn
- Conta no Supabase

## 🔧 Configuração

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar Supabase

1. Crie um projeto no [Supabase](https://supabase.com)
2. Vá para Settings > API
3. Copie a URL e anon key
4. Crie um arquivo `.env.local` na raiz do projeto:

```env
NEXT_PUBLIC_SUPABASE_URL=sua_url_do_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anonima_do_supabase
```

### 3. Configurar Banco de Dados

Execute o seguinte SQL no SQL Editor do Supabase:

```sql
-- Habilitar extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de contas
CREATE TABLE public.accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  label text NOT NULL,
  currency text NOT NULL DEFAULT 'BRL'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT accounts_pkey PRIMARY KEY (id),
  CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Tabela de ativos
CREATE TABLE public.assets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  symbol text NOT NULL UNIQUE,
  class text NOT NULL,
  manual_price numeric,
  currency text NOT NULL DEFAULT 'BRL'::text,
  meta jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  connector text,
  external_account_id text,
  CONSTRAINT assets_pkey PRIMARY KEY (id)
);

-- Tabela de eventos
CREATE TABLE public.events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  asset_id uuid NOT NULL,
  account_id uuid,
  tstamp timestamp with time zone NOT NULL DEFAULT now(),
  kind text NOT NULL CHECK (kind = ANY (ARRAY['qty_change'::text, 'valuation'::text, 'price_cache'::text])),
  units_delta numeric,
  price_override numeric,
  price_close numeric,
  CONSTRAINT events_pkey PRIMARY KEY (id),
  CONSTRAINT events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT events_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id),
  CONSTRAINT events_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id)
);

-- Tabela de itens externos
CREATE TABLE public.external_items (
  id uuid NOT NULL,
  user_id uuid,
  provider text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT external_items_pkey PRIMARY KEY (id),
  CONSTRAINT external_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Políticas de segurança RLS
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_items ENABLE ROW LEVEL SECURITY;

-- Políticas para contas
CREATE POLICY "Users can view own accounts" ON public.accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own accounts" ON public.accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts" ON public.accounts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounts" ON public.accounts
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas para ativos (todos podem ver, mas só admins podem modificar)
CREATE POLICY "Anyone can view assets" ON public.assets
  FOR SELECT USING (true);

-- Políticas para eventos
CREATE POLICY "Users can view own events" ON public.events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own events" ON public.events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own events" ON public.events
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own events" ON public.events
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas para itens externos
CREATE POLICY "Users can view own external items" ON public.external_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own external items" ON public.external_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### 4. Configurar Autenticação

1. No Supabase, vá para Authentication > Settings
2. Configure os provedores de email que deseja usar
3. Configure as URLs de redirecionamento se necessário

## 🏃‍♂️ Executar o Projeto

```bash
npm run dev
```

Acesse: http://localhost:3000

## 📁 Estrutura do Projeto

```
Afino-web/
├── app/                    # App Router do Next.js
│   ├── dashboard/         # Páginas do dashboard
│   ├── login/            # Página de login
│   ├── signup/           # Página de cadastro
│   └── layout.tsx        # Layout principal
├── components/           # Componentes React
│   ├── ui/              # Componentes shadcn/ui
│   └── ProtectedRoute.tsx
├── lib/                 # Utilitários e configurações
│   ├── auth.tsx         # Contexto de autenticação
│   └── supabase.ts      # Cliente Supabase
└── styles/              # Estilos globais
```

## 🔐 Funcionalidades Implementadas

- ✅ Autenticação com Supabase
- ✅ Proteção de rotas
- ✅ CRUD de contas bancárias
- ✅ Dashboard com gráficos
- ✅ Tema escuro/claro
- ✅ Validação de formulários
- ✅ Notificações toast
- ✅ Interface responsiva

## 🎨 Temas

O projeto usa shadcn/ui com tema customizado. Para trocar temas:

1. **Via CLI:**
```bash
npx shadcn@latest init
```

2. **Manual:** Edite `styles/globals.css` e `tailwind.config.js`

## 📊 Próximos Passos

- [ ] CRUD de ativos
- [ ] CRUD de transações
- [ ] Relatórios avançados
- [ ] Integração com APIs externas
- [ ] Testes automatizados
- [ ] Deploy em produção

## 🐛 Solução de Problemas

### Erro de autenticação
- Verifique se as variáveis de ambiente estão corretas
- Confirme se o banco de dados foi configurado
- Verifique as políticas RLS no Supabase

### Erro de build
- Limpe o cache: `npm run build -- --clean`
- Verifique se todas as dependências estão instaladas

### Problemas de tema
- Verifique se o `next-themes` está configurado
- Confirme se o `ThemeProvider` está no layout 