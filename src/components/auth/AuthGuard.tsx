import { Center, Loader } from "@mantine/core";

import { useSession } from "@/lib/auth";
import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !session) {
      router.navigate({ to: "/login" });
    }
  }, [session, isPending, router]);

  if (isPending) {
    return (
      <Center h="100svh" style={{ overflow: 'hidden' }}>
        <Loader size="md" />
      </Center>
    );
  }

  if (!session) return null;

  return <>{children}</>;
}
