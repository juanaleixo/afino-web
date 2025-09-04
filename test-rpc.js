// Teste rápido da função RPC
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Configuração do Supabase não encontrada')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testRPC() {
  console.log('Testando função RPC api_portfolio_daily_detailed...')
  
  const { data, error } = await supabase.rpc('api_portfolio_daily_detailed', {
    p_from: '2024-08-01',
    p_to: '2024-09-01'
  })
  
  if (error) {
    console.error('Erro na RPC:', error)
  } else {
    console.log('Dados retornados (primeiros 2):', data?.slice(0, 2))
    console.log('Campos disponíveis:', data?.[0] ? Object.keys(data[0]) : 'Nenhum dado')
  }
}

testRPC()