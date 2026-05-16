import { useLocation } from "wouter";
import { CheckCircle2, CalendarDays, Users, Clock, Infinity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

export default function SignupSuccess() {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const isLifetime = user?.subscriptionStatus === "lifetime";

  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 14);
  const formatted = trialEnd.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <a href="/" className="flex items-center w-fit">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="ProviderFlo" style={{ height: 56, width: "auto", objectFit: "contain" }} />
          </a>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="text-center max-w-md">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${isLifetime ? "bg-blue-100" : "bg-green-100"}`}>
            {isLifetime
              ? <Infinity className="w-10 h-10 text-blue-600" />
              : <CheckCircle2 className="w-10 h-10 text-green-600" />
            }
          </div>

          {isLifetime ? (
            <>
              <h1 className="text-3xl font-bold text-gray-900 mb-3">Welcome, {user?.fullName?.split(" ")[0]}!</h1>
              <p className="text-gray-500 mb-8">
                Your account has been set up with <strong>lifetime full access</strong> to ProviderFlo — no subscription required, ever.
              </p>

              <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-8 text-left space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                    <Infinity className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Lifetime access — no expiry</p>
                    <p className="text-xs text-gray-500">Your account never expires and you'll never be asked to choose a plan.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Full access to every feature</p>
                    <p className="text-xs text-gray-500">Participants, rostering, claims, incidents, documents and more.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">No credit card required</p>
                    <p className="text-xs text-gray-500">Your access is complimentary. No billing, no invoices, no surprises.</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-gray-900 mb-3">Your trial has started!</h1>
              <p className="text-gray-500 mb-8">
                You have full access to ProviderFlo for 14 days — no credit card needed.
              </p>

              <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-8 text-left space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                    <CalendarDays className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Trial ends {formatted}</p>
                    <p className="text-xs text-gray-500">You'll be reminded before it expires. No charge until you choose a plan.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Full access included</p>
                    <p className="text-xs text-gray-500">Add participants, roster staff, submit NDIS claims and more.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Choose a plan when you're ready</p>
                    <p className="text-xs text-gray-500">At the end of your trial you'll pick a plan that suits your organisation.</p>
                  </div>
                </div>
              </div>
            </>
          )}

          <Button
            size="lg"
            className="rounded-full h-12 px-8 font-semibold"
            style={{ backgroundColor: "hsl(214, 80%, 45%)" }}
            onClick={() => navigate("/")}
          >
            Go to Dashboard →
          </Button>
        </div>
      </main>
    </div>
  );
}
