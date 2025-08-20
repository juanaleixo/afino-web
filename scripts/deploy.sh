#!/bin/bash

# Script de Deploy para Cloudflare Pages
# Uso: ./scripts/deploy.sh [staging|production]

set -e

ENVIRONMENT=${1:-preview}

echo "🚀 Iniciando deploy para $ENVIRONMENT..."

# Verificar se Wrangler está instalado
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler não está instalado. Instale com: npm install -g wrangler"
    exit 1
fi

# Verificar se está logado
if ! wrangler whoami &> /dev/null; then
    echo "❌ Não está logado no Cloudflare. Execute: wrangler login"
    exit 1
fi

# Build do projeto
echo "📦 Fazendo build do projeto..."
npm run build:cf

# Deploy baseado no ambiente
if [ "$ENVIRONMENT" = "production" ]; then
    echo "🌐 Deployando para produção..."
    wrangler pages deploy .vercel/output/static --project-name afino-web
    echo "✅ Deploy para produção concluído!"
    echo "🔗 URL: https://afino-web.pages.dev"
elif [ "$ENVIRONMENT" = "preview" ]; then
    echo "🧪 Deployando para preview..."
    wrangler pages deploy .vercel/output/static --project-name afino-web-preview
    echo "✅ Deploy para preview concluído!"
    echo "🔗 URL: https://afino-web-preview.pages.dev"
else
    echo "❌ Ambiente inválido. Use 'preview' ou 'production'"
    exit 1
fi

echo "🎉 Deploy concluído com sucesso!"
