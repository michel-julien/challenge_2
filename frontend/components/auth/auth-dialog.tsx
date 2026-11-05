"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isMockApi } from "@/lib/api";
import { useAuth, type AuthTab } from "./auth-provider";
import { LoginForm } from "./login-form";
import { RegisterForm } from "./register-form";

export function AuthDialog() {
  const { dialogOpen, setDialogOpen, dialogTab, setDialogTab } = useAuth();
  const close = () => setDialogOpen(false);

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button size="sm" onClick={() => setDialogTab("login")}>
          Log in
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-1.5rem)] overflow-y-auto p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border/70 px-6 pb-5 pt-6 pr-14">
          <DialogTitle>
            {dialogTab === "login" ? "Log in to CampusAPI" : "Create an account"}
          </DialogTitle>
          <DialogDescription>
            {dialogTab === "login"
              ? "Use your email and password."
              : "Register with your student details."}
          </DialogDescription>
        </DialogHeader>
        <Tabs
          value={dialogTab}
          onValueChange={(v) => setDialogTab(v as AuthTab)}
          className="gap-5 p-6 pt-5"
        >
          <TabsList className="grid h-11 w-full grid-cols-2 bg-muted/70 p-1">
            <TabsTrigger value="login">Log in</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <LoginForm onSuccess={close} />
          </TabsContent>
          <TabsContent value="register">
            <RegisterForm onSuccess={close} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
