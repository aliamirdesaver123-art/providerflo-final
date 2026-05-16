import { useState } from "react";
import { CheckCircle2, Star, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

const API = "";

const PLANS = [
  {
    key: "starter",
    name: "Starter",
    price: "$89",
    period: "/mo",
    description: "Perfect for growing providers",
    features: [
      "Up to 20 participants",
      "Basic rostering",
      "NDIS bulk claiming",
      "Mobile app",
      "Email support",
    ],
    popular: false,
  },
  {
    key: "growth",
    name: "Growth",
    price: "$199",
    period: "/mo",
    description: "Everything you need to scale",
    features: [
      "Up to 100 participants",
      "Advanced rostering & compliance",
      "Xero, MYOB & KeyPay integrations",
      "Custom incident workflows",
      "Priority phone support",
    ],
    popular: true,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "Tailored for large organisations",
    features: [
      "Unlimited participants",
      "Custom integrations (API)",
      "Dedicated success manager",
      "Custom reporting dashboards",
      "On-premise deployment option",
    ],
    popular: false,
  },
];

export default function SubscriptionModal() {
  const { isAuthenticated, isTrialExpired, user, logout } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState("growth");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isAuthenticated || !isTrialExpired) return null;

  const handleSubscribe = async () => {
    if (selectedPlan === "enterprise") {
      window.open("mailto:hello@providerflo.com.au?subject=Enterprise Plan Enquiry", "_blank");
      return;
    }

    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/create-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user?.email, planKey: selectedPlan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start checkout");
      if (data.url) window.location.href = data.url;
    } catch (err: any) {
      setError(err.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="px-8 pt-8 pb-6 text-center border-b border-gray-100">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">
            Your free trial has ended
          </h2>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            Thanks for trying ProviderFlo! Choose a plan below to keep your data and continue managing your NDIS business without interruption.
          </p>
        </div>

        {/* Plans */}
        <div className="px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {PLANS.map((plan) => (
              <button
                key={plan.key}
                onClick={() => setSelectedPlan(plan.key)}
                className={cn(
                  "relative text-left rounded-xl border-2 p-5 transition-all focus:outline-none",
                  selectedPlan === plan.key
                    ? "border-blue-600 bg-blue-50 shadow-md"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                )}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                    <Star className="w-3 h-3" /> Most Popular
                  </span>
                )}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">{plan.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{plan.description}</p>
                  </div>
                  <div className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5",
                    selectedPlan === plan.key ? "border-blue-600 bg-blue-600" : "border-gray-300"
                  )}>
                    {selectedPlan === plan.key && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                </div>

                <div className="mb-3">
                  <span className="text-2xl font-extrabold text-gray-900">{plan.price}</span>
                  <span className="text-gray-500 text-xs">{plan.period}</span>
                </div>

                <ul className="space-y-1.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-gray-600">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              </button>
            ))}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
              {error}
            </p>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Button
              size="lg"
              className="w-full sm:w-auto h-12 px-10 rounded-full font-bold text-base"
              style={{ backgroundColor: "#2563EB" }}
              onClick={handleSubscribe}
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Redirecting to checkout...</>
              ) : selectedPlan === "enterprise" ? (
                "Contact Sales →"
              ) : (
                `Subscribe to ${PLANS.find(p => p.key === selectedPlan)?.name} →`
              )}
            </Button>
            <button
              onClick={logout}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Sign out instead
            </button>
          </div>

          <p className="text-xs text-gray-400 mt-4 flex items-center gap-1.5">
            <span>🔒</span> Secure payment via Stripe · Cancel anytime · Your data is preserved
          </p>
        </div>
      </div>
    </div>
  );
}
