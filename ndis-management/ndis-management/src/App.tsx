import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { CompanyBrandingProvider } from "@/context/CompanyBrandingContext";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import SignupSuccess from "@/pages/SignupSuccess";
import Dashboard from "@/pages/Dashboard";
import Participants from "@/pages/Participants";
import ParticipantDetail from "@/pages/ParticipantDetail";
import Staff from "@/pages/Staff";
import StaffDetail from "@/pages/StaffDetail";
import Roster from "@/pages/Roster";
import ServiceAgreements from "@/pages/ServiceAgreements";
import Incidents from "@/pages/Incidents";
import CaseNotes from "@/pages/CaseNotes";
import Invoices from "@/pages/Invoices";
import Messages from "@/pages/Messages";
import Facilities from "@/pages/Facilities";
import Tasks from "@/pages/Tasks";
import Timesheet from "@/pages/Timesheet";
import Forms from "@/pages/Forms";
import Quotes from "@/pages/Quotes";
import Reports from "@/pages/Reports";
import Account from "@/pages/Account";
import Migration from "@/pages/Migration";
import ImportEngine from "@/pages/ImportEngine";
import SubscriptionModal from "@/components/SubscriptionModal";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import Impersonate from "@/pages/Impersonate";
import AcceptInvite from "@/pages/AcceptInvite";
import Compliance from "@/pages/Compliance";
import AIActions from "@/pages/AIActions";
import AIAutomationSettings from "@/pages/AIAutomationSettings";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/signup/success" component={SignupSuccess} />
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/participants" component={() => <ProtectedRoute component={Participants} />} />
      <Route path="/participants/:id" component={() => <ProtectedRoute component={ParticipantDetail} />} />
      <Route path="/staff" component={() => <ProtectedRoute component={Staff} />} />
      <Route path="/staff/:id" component={() => <ProtectedRoute component={StaffDetail} />} />
      <Route path="/roster" component={() => <ProtectedRoute component={Roster} />} />
      <Route path="/service-agreements" component={() => <ProtectedRoute component={ServiceAgreements} />} />
      <Route path="/incidents" component={() => <ProtectedRoute component={Incidents} />} />
      <Route path="/case-notes" component={() => <ProtectedRoute component={CaseNotes} />} />
      <Route path="/invoices" component={() => <ProtectedRoute component={Invoices} />} />
      <Route path="/messages" component={() => <ProtectedRoute component={Messages} />} />
      <Route path="/facilities" component={() => <ProtectedRoute component={Facilities} />} />
      <Route path="/tasks" component={() => <ProtectedRoute component={Tasks} />} />
      <Route path="/timesheet" component={() => <ProtectedRoute component={Timesheet} />} />
      <Route path="/forms" component={() => <ProtectedRoute component={Forms} />} />
      <Route path="/quotes" component={() => <ProtectedRoute component={Quotes} />} />
      <Route path="/reports" component={() => <ProtectedRoute component={Reports} />} />
      <Route path="/account" component={() => <ProtectedRoute component={Account} />} />
      <Route path="/quotes/new" component={() => <ProtectedRoute component={Quotes} />} />
      <Route path="/billing" component={() => <Redirect to="/account" />} />
      <Route path="/forms/responses" component={() => <ProtectedRoute component={Forms} />} />
      <Route path="/incidents/new" component={() => <ProtectedRoute component={Incidents} />} />
      <Route path="/invoices/new" component={() => <ProtectedRoute component={Invoices} />} />
      <Route path="/invoices/claiming" component={() => <ProtectedRoute component={Invoices} />} />
      <Route path="/participants/documents" component={() => <ProtectedRoute component={Participants} />} />
      <Route path="/participants/goals" component={() => <ProtectedRoute component={Participants} />} />
      <Route path="/staff/new" component={() => <ProtectedRoute component={Staff} />} />
      <Route path="/staff/availability" component={() => <ProtectedRoute component={Staff} />} />
      <Route path="/staff/compliance" component={() => <ProtectedRoute component={Staff} />} />
      <Route path="/timesheet/approval" component={() => <ProtectedRoute component={Timesheet} />} />
      <Route path="/migration" component={() => <ProtectedRoute component={Migration} />} />
      <Route path="/import-engine" component={() => <ProtectedRoute component={ImportEngine} />} />
      <Route path="/compliance" component={() => <ProtectedRoute component={Compliance} />} />
      <Route path="/ai-actions" component={() => <ProtectedRoute component={AIActions} />} />
      <Route path="/ai-automation" component={() => <ProtectedRoute component={AIAutomationSettings} />} />
      <Route path="/impersonate" component={Impersonate} />
      <Route path="/invite" component={AcceptInvite} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <CompanyBrandingProvider>
              <Router />
              <SubscriptionModal />
              <ImpersonationBanner />
            </CompanyBrandingProvider>
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
