import type { Metadata } from "next";

import { SignInFlow } from "@/components/auth/sign-in-flow";

export const metadata: Metadata = {
  title: "Re-authenticate",
};

export default function ReauthPage() {
  return <SignInFlow forceReauth />;
}
