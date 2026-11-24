import type { Metadata } from "next";

import { AccountDeletion } from "@/components/account/account-deletion";

export const metadata: Metadata = {
  title: "Account deletion",
};

export default function AccountDeletionPage() {
  return <AccountDeletion />;
}
