# Deploy no Cloudflare Pages

## Pré-requisitos

1. **Instalar Wrangler CLI**:
```bash
npm install -g wrangler
```

2. **Fazer login no Cloudflare**:
```bash
wrangler login
```

## Configuração

### 1. Variáveis de Ambiente

Crie um arquivo `.env.local` com suas variáveis:
```env
NEXT_PUBLIC_SUPABASE_URL=sua_url_do_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anonima
```

### 2. Configurar no Cloudflare Pages

No dashboard do Cloudflare Pages, configure as variáveis de ambiente:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Deploy

### Deploy Manual

#### Opção 1: Script Automatizado (Recomendado)

1. **Deploy para staging**:
```bash
npm run deploy:staging:script
# ou
./scripts/deploy.sh staging
```

2. **Deploy para produção**:
```bash
npm run deploy:production:script
# ou
./scripts/deploy.sh Afino
```

#### Opção 2: Comandos Manuais

1. **Build estático**:
```bash
npm run build
```

2. **Deploy para staging**:
```bash
npm run deploy:staging
```

3. **Deploy para produção**:
```bash
npm run deploy:production
```

### Deploy Automático (GitHub)

1. Conecte seu repositório no Cloudflare Pages
2. Configure o build command: `npm run build`
3. Configure o output directory: `out`
4. Configure as variáveis de ambiente

## Estrutura de Arquivos

```
afino-web/
├── wrangler.toml          # Configuração do Wrangler
├── next.config.ts         # Configuração Next.js para export estático
├── .cloudflare/
│   └── static/
│       └── _redirects     # Redirecionamentos
└── docs/
    └── DEPLOY.md          # Esta documentação
```

## Troubleshooting

### Erro de Build
- Verifique se todas as variáveis de ambiente estão configuradas
- Execute `npm run build` localmente para testar

### Erro de Deploy
- Verifique se está logado no Wrangler: `wrangler whoami`
- Verifique as permissões do projeto no Cloudflare

### Problemas de Roteamento
- O arquivo `_redirects` garante que rotas SPA funcionem
- Verifique se `next.config.ts` tem `output: 'export'`

## URLs de Deploy

- **Staging**: `https://afino-web-staging.pages.dev`
- **Produção**: `https://afino-web-production.pages.dev`

## Monitoramento

- Use o dashboard do Cloudflare Pages para monitorar deploys
- Configure alertas para falhas de build
- Monitore performance com Cloudflare Analytics
