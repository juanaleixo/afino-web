import * as React from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { useState } from "react"

const assetTypeLabels: Record<string, string> = {
  'real_estate': 'Imóvel',
  'vehicle': 'Veículo',
  'bond': 'Renda Fixa',
  'commodity': 'Commodity/Outros'
}

interface CreateCustomAssetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  assetType: string
  onSuccess: () => void
}

export function CreateCustomAssetDialog({
  open,
  onOpenChange,
  assetType,
  onSuccess
}: CreateCustomAssetDialogProps) {
  const { user } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    label: '',
    currency: 'BRL'
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !formData.label) return

    setIsSubmitting(true)
    try {
      // Verificar se já existe um ativo global com esse nome
      const { data: existingAssets } = await supabase
        .from('global_assets')
        .select('symbol')
        .ilike('symbol', formData.label)
        .limit(1)

      if (existingAssets && existingAssets.length > 0) {
        toast.error('Já existe um ativo com esse nome. Use a busca para encontrá-lo.')
        return
      }

      // Criar ativo customizado
      const { error } = await supabase
        .from('custom_assets')
        .insert([{
          user_id: user.id,
          label: formData.label,
          currency: formData.currency,
          meta: {
            is_custom: true,
            asset_class: assetType,
            created_at: new Date().toISOString()
          }
        }])

      if (error) throw error

      toast.success('Ativo criado com sucesso!')
      setFormData({ label: '', currency: 'BRL' })
      onSuccess()
    } catch (error: any) {
      console.error('Erro ao criar ativo:', error)
      toast.error(error.message || 'Erro ao criar ativo')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Criar {assetTypeLabels[assetType] || 'Ativo'}</DialogTitle>
            <DialogDescription>
              Adicione um novo {(assetTypeLabels[assetType] || 'ativo').toLowerCase()} ao seu patrimônio
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="label">Nome do Ativo</Label>
              <Input
                id="label"
                placeholder={
                  assetType === 'real_estate' ? "Ex: Apartamento Centro" :
                  assetType === 'vehicle' ? "Ex: Honda Civic 2020" :
                  assetType === 'bond' ? "Ex: CDB Banco X" :
                  "Ex: Coleção de Moedas"
                }
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground">
                Use um nome descritivo para identificar facilmente
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Moeda</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => setFormData({ ...formData, currency: value })}
              >
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">BRL - Real Brasileiro</SelectItem>
                  <SelectItem value="USD">USD - Dólar Americano</SelectItem>
                  <SelectItem value="EUR">EUR - Euro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || !formData.label}>
              {isSubmitting ? "Criando..." : "Criar Ativo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}