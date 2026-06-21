"use client";

import { useRouter } from "next/navigation";
import { Button } from "./ui";

export function LogoutButton({
  className,
  onLoggedOut,
}: {
  className?: string;
  onLoggedOut?: () => void;
}) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    onLoggedOut?.();
    router.push("/login");
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={logout} type="button" className={className}>
      Sign out
    </Button>
  );
}
