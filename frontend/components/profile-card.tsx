"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { getInitials } from "@/components/auth/user-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function ProfileCard() {
  const { user, status, openAuthDialog } = useAuth();

  if (status === "loading") {
    return <div className="h-72 animate-pulse rounded-xl bg-muted" />;
  }

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>You&apos;re not logged in</CardTitle>
          <CardDescription>
            Log in to view your student profile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => openAuthDialog("login")}>Log in</Button>
        </CardContent>
      </Card>
    );
  }

  const rows = [
    { label: "Full name", value: user.fullName },
    { label: "Student ID", value: user.studentId },
    { label: "Email", value: user.email },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-4">
        <Avatar className="size-12">
          <AvatarFallback>{getInitials(user.fullName)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-1">
          <CardTitle className="truncate">{user.fullName}</CardTitle>
          <CardDescription className="truncate">{user.email}</CardDescription>
        </div>
        <Badge variant="secondary" className="ml-auto capitalize">
          {user.role}
        </Badge>
      </CardHeader>
      <Separator />
      <CardContent>
        <dl className="grid gap-4">
          {rows.map((row) => (
            <div key={row.label} className="grid gap-1 sm:grid-cols-3">
              <dt className="text-sm text-muted-foreground">{row.label}</dt>
              <dd className="break-all text-sm font-medium sm:col-span-2">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
