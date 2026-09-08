import { ProfileShell } from "@/components/profile/shell";

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <ProfileShell>{children}</ProfileShell>;
}
