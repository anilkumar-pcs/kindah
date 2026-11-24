import type { Metadata } from "next";

import { MySpace } from "@/components/me/my-space";

export const metadata: Metadata = {
  title: "My Kindness",
};

export default function MePage() {
  return <MySpace />;
}
