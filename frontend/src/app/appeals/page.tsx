import type { Metadata } from "next";

import { AppealsCenter } from "@/components/appeals/appeals-center";

export const metadata: Metadata = {
  title: "Appeals",
};

export default function AppealsPage() {
  return <AppealsCenter />;
}
