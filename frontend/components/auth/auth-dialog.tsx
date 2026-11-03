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
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
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
        >
          <TabsList className="w-full">
            <TabsTrigger value="login">Log in</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>
          <TabsContent value="login" className="pt-2">
            <LoginForm onSuccess={close} />
            {isMockApi && (
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Mock API demo login: demo@campus.edu / password123
              </p>
            )}
          </TabsContent>
          <TabsContent value="register" className="pt-2">
            <RegisterForm onSuccess={close} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
