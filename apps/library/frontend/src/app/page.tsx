import { redirect } from "@/navigation";

export default function RootPage() {
  redirect({ href: "/catalog", locale: "en" });
}
