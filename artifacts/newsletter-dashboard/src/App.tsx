import { useEffect, useRef } from "react";
import {
  ClerkProvider,
  SignIn,
  Show,
  useClerk,
  useUser,
  useAuth,
} from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { dark } from "@clerk/themes";
import { Switch, Route, Redirect, useLocation, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  baseTheme: dark,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    socialButtonsPlacement: "bottom" as const,
    socialButtonsVariant: "blockButton" as const,
  },
  variables: {
    colorPrimary: "#00ffff",
    colorForeground: "#fafafa",
    colorMutedForeground: "#9fa1a8",
    colorDanger: "#ef4444",
    colorBackground: "#090911",
    colorInput: "#131318",
    colorInputForeground: "#fafafa",
    colorNeutral: "#232630",
    fontFamily: "'Space Mono', ui-monospace, monospace",
    borderRadius: "0px",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#0e0e12] border border-[#232630] w-[420px] max-w-full overflow-hidden",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[#fafafa] font-mono uppercase tracking-widest text-sm",
    headerSubtitle: "text-[#9fa1a8] font-mono text-xs",
    socialButtonsBlockButtonText: "text-[#fafafa] font-mono text-xs uppercase tracking-wider",
    formFieldLabel: "text-[#9fa1a8] font-mono text-xs uppercase tracking-wider",
    footerActionLink: "text-[#00ffff] font-mono text-xs",
    footerActionText: "text-[#9fa1a8] font-mono text-xs",
    dividerText: "text-[#9fa1a8] font-mono text-xs",
    identityPreviewEditButton: "text-[#00ffff]",
    formFieldSuccessText: "text-[#00ffff] font-mono text-xs",
    alertText: "text-[#fafafa] font-mono text-xs",
    logoBox: "justify-center",
    logoImage: "w-10 h-10",
    socialButtonsBlockButton: "border border-[#232630] bg-[#131318] hover:bg-[#1a1a22] transition-colors",
    formButtonPrimary: "bg-[#00ffff] text-[#090911] font-mono uppercase tracking-widest text-xs hover:bg-[#00cccc] transition-colors",
    formFieldInput: "bg-[#131318] border border-[#232630] text-[#fafafa] font-mono text-sm",
    footerAction: "border-t border-[#232630]",
    dividerLine: "bg-[#232630]",
    alert: "border border-[#232630] bg-[#131318]",
    otpCodeFieldInput: "bg-[#131318] border border-[#232630] text-[#fafafa]",
    formFieldRow: "",
    main: "",
  },
};

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function AccessDenied() {
  const { signOut } = useClerk();
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? "your account";

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 gap-6 text-center">
      <div className="w-12 h-12 border border-destructive flex items-center justify-center">
        <span className="text-destructive text-lg font-mono">✕</span>
      </div>
      <div className="space-y-2">
        <h1 className="text-sm font-bold tracking-widest text-destructive uppercase">
          ACCESS_DENIED
        </h1>
        <p className="text-xs text-muted-foreground font-mono max-w-sm">
          <span className="text-foreground">{email}</span> is not authorised.
          <br />
          Only <span className="text-primary">@together.fund</span> accounts can access this dashboard.
        </p>
      </div>
      <button
        type="button"
        onClick={() => signOut({ redirectUrl: basePath || "/" })}
        className="px-4 py-2 text-xs font-mono uppercase tracking-widest border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
      >
        Sign Out
      </button>
    </div>
  );
}

function DomainGuard({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();

  if (!isLoaded) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <span className="text-xs font-mono text-muted-foreground tracking-widest animate-pulse uppercase">
          Authenticating…
        </span>
      </div>
    );
  }

  if (!isSignedIn) return <Redirect to="/sign-in" />;

  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  if (!email.endsWith("@together.fund")) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 gap-8">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-primary uppercase">
          MISSION_CONTROL
        </h1>
        <p className="text-xs text-muted-foreground tracking-widest uppercase">
          AI Podcast Digest · Operations Dashboard
        </p>
        <p className="text-xs text-muted-foreground/60 pt-1">
          @together.fund accounts only
        </p>
      </div>
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-in`}
      />
    </div>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-in`}
      localization={{
        signIn: {
          start: {
            title: "MISSION_CONTROL",
            subtitle: "Sign in with your @together.fund account",
          },
        },
        signUp: {
          start: {
            title: "MISSION_CONTROL",
            subtitle: "Access restricted to @together.fund",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <div className="dark min-h-[100dvh] bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
            <Switch>
              <Route path="/" component={HomeRedirect} />
              <Route path="/sign-in/*?" component={SignInPage} />
              <Route path="/dashboard">
                <DomainGuard>
                  <Dashboard />
                </DomainGuard>
              </Route>
              <Route component={NotFound} />
            </Switch>
          </div>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
