import { SignIn } from "@clerk/react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 gap-8">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-primary uppercase">
          AI Podcast Digest
        </h1>
        <p className="text-xs text-muted-foreground tracking-widest uppercase">
          Operations Dashboard
        </p>
        <p className="text-xs text-muted-foreground/60 tracking-wide pt-1">
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
