import type { Metadata } from "next";

import { ProfileCard } from "@/components/profile-card";

export const metadata: Metadata = {
  title: "Profile",
};

export default function ProfilePage() {
  return (
    <div className="mx-auto w-full max-w-xl">
      <ProfileCard />
    </div>
  );
}
