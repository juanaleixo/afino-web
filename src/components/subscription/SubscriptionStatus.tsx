"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useUserContextFromProvider } from "@/contexts/UserContextProvider";
import {
  getPlanName,
  isTrialActive,
  getTrialDaysRemaining,
} from "@/lib/utils/subscription-helpers";
import { useAuth } from "@/lib/auth";
import { SUBSCRIPTION_PLANS } from "@/lib/stripe";
import { formatDate } from "@/lib/utils/formatters";
import {
  Loader2,
  Crown,
  Settings,
  CreditCard,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import { useRouter } from "next/navigation";

const translateStatus = (status: string): string => {
  const translations: Record<string, string> = {
    'active': 'Ativo',
    'canceled': 'Cancelado',
    'incomplete': 'Incompleto',
    'incomplete_expired': 'Expirado Incompleto',
    'past_due': 'Vencido',
    'trialing': 'Período de Teste',
    'unpaid': 'Não Pago'
  };
  return translations[status] || status;
};

export function SubscriptionStatus() {
  const { userContext, isLoading } = useUserContextFromProvider();
  const subscription = userContext.subscription;
  const isPremium = userContext.is_premium;
  const { user } = useAuth();
  const router = useRouter();

  const handleUpgradeClick = () => {
    if (user) {
      router.push("/dashboard/pricing");
    } else {
      window.location.href = "/pricing";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const planName = getPlanName(subscription);
  const isOnTrial = isTrialActive(subscription);
  const trialDays = getTrialDaysRemaining(subscription);

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {isPremium ? (
                <>
                  <Crown className="h-5 w-5 text-yellow-500" />
                  Plano {planName}
                </>
              ) : (
                <>
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  Plano {planName}
                </>
              )}
            </CardTitle>
            <CardDescription>
              {isPremium
                ? "Você tem acesso a todas as funcionalidades premium"
                : "Faça upgrade para acessar funcionalidades avançadas"}
            </CardDescription>
          </div>
          <Badge
            variant={isPremium ? "default" : "secondary"}
            className={isPremium ? "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200" : ""}
          >
            {isPremium ? "Premium" : "Free"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Trial Information */}
        {isOnTrial && (
          <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/50 rounded-lg border border-blue-200 dark:border-blue-800">
            <AlertTriangle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Período de Teste Ativo
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {trialDays > 0
                  ? `${trialDays} dia${trialDays !== 1 ? "s" : ""} restante${
                      trialDays !== 1 ? "s" : ""
                    }`
                  : "Último dia de teste"}
              </p>
            </div>
          </div>
        )}

        {/* Subscription Details */}
        {subscription && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                Status:{" "}
                <strong className="text-foreground">{translateStatus(subscription.status)}</strong>
              </span>
            </div>

            {subscription.current_period_end && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>
                  {subscription.cancel_at_period_end
                    ? "Expira em: "
                    : "Próxima cobrança: "}
                  <strong className="text-foreground">
                    {formatDate(subscription.current_period_end)}
                  </strong>
                </span>
              </div>
            )}

            {subscription.cancel_at_period_end && (
              <div className="flex items-start gap-3 p-3 bg-orange-50 dark:bg-orange-950/50 rounded-lg border border-orange-200 dark:border-orange-800">
                <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                    Assinatura Cancelada
                  </p>
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    Você manterá o acesso premium até a data de expiração.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Current Plan Features */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-2">
            Recursos do seu plano:
          </h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            {(isPremium
              ? SUBSCRIPTION_PLANS.PREMIUM
              : SUBSCRIPTION_PLANS.FREE
            ).features.map((feature, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-2">
          {!isPremium && (
            <Button onClick={handleUpgradeClick} className="w-full">
              <Crown className="h-4 w-4 mr-2" />
              Fazer Upgrade para Premium
            </Button>
          )}

          {subscription && (
            <Button
              variant="outline"
              onClick={() =>
                window.open(
                  process.env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL,
                  "_blank"
                )
              }
              className="w-full"
            >
              <Settings className="h-4 w-4 mr-2" />
              Gerenciar Assinatura
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
