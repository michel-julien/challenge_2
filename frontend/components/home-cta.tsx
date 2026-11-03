"use client";

import Link from "next/link";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";

export function HomeCta() {
  const { user, status, openAuthDialog } = useAuth();

  if (status === "loading") {
    return <div className="h-9 w-64 animate-pulse rounded-md bg-muted" />;
  }

  if (user) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild>
          <Link href="/profile">View your profile</Link>
        </Button>
        <span className="text-sm text-muted-foreground">
          Logged in as {user.fullName}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button onClick={() => openAuthDialog("login")}>Log in</Button>
      <Button variant="outline" onClick={() => openAuthDialog("register")}>
        Create an account
      </Button>
    </div>
  );
}
