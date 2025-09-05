"use client"

import * as React from "react"
import { Edit } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { Home, ArrowDownCircle, ShoppingCart, RefreshCw, Settings, List } from "lucide-react"

export function PatrimonyFAB() {
  const [isOpen, setIsOpen] = React.useState(false)

  const menuItems = [
    {
      href: "/dashboard/patrimony/new?operation=add_existing",
      icon: Home,
      label: "Adicionar Patrimônio Existente",
      description: "Imóvel, veículo, investimentos",
      color: "text-purple-600"
    },
    {
      href: "/dashboard/patrimony/new?operation=money_in",
      icon: ArrowDownCircle,
      label: "Entrada de Dinheiro",
      description: "Salário, rendimentos",
      color: "text-green-600"
    },
    {
      href: "/dashboard/patrimony/new?operation=purchase",
      icon: ShoppingCart,
      label: "Comprar Ativo",
      description: "Ações, crypto, fundos",
      color: "text-blue-600"
    },
    {
      href: "/dashboard/patrimony/new?operation=update_value",
      icon: RefreshCw,
      label: "Atualizar Valor",
      description: "Corrigir preços",
      color: "text-yellow-600"
    }
  ]

  const managementItems = [
    {
      href: "/dashboard/events",
      icon: List,
      label: "Gerenciar Eventos",
      description: "Ver e editar histórico",
      color: "text-orange-600"
    },
    {
      href: "/dashboard/accounts",
      icon: Settings,
      label: "Gerenciar Contas",
      description: "Configurar carteiras",
      color: "text-gray-600"
    }
  ]

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            size="lg"
            className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow"
          >
            <Edit className="h-6 w-6" />
            <span className="sr-only">Gerenciar patrimônio</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Criar Eventos</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {menuItems.map((item) => (
            <DropdownMenuItem key={item.href} asChild>
              <Link
                href={item.href}
                className="flex items-start gap-3 px-2 py-3 cursor-pointer"
              >
                <div className={`mt-0.5 ${item.color}`}>
                  <item.icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{item.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.description}
                  </div>
                </div>
              </Link>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Gerenciar</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {managementItems.map((item) => (
            <DropdownMenuItem key={item.href} asChild>
              <Link
                href={item.href}
                className="flex items-start gap-3 px-2 py-3 cursor-pointer"
              >
                <div className={`mt-0.5 ${item.color}`}>
                  <item.icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{item.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.description}
                  </div>
                </div>
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}