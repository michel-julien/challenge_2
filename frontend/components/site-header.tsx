"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCapIcon } from "lucide-react";

import { AuthDialog } from "@/components/auth/auth-dialog";
import { useAuth } from "@/components/auth/auth-provider";
import { UserMenu } from "@/components/auth/user-menu";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const { user, status } = useAuth();
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Home" },
    ...(user ? [{ href: "/profile", label: "Profile" }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <GraduationCapIcon className="size-5" />
          <span>KMU</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-md px-2 py-1 text-muted-foreground transition-colors hover:text-foreground",
                pathname === link.href && "text-foreground font-medium",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {status === "loading" ? (
            <div className="size-8 animate-pulse rounded-full bg-muted" />
          ) : user ? (
            <UserMenu user={user} />
          ) : (
            <AuthDialog />
          )}
        </div>
      </div>
    </header>
  );
}
