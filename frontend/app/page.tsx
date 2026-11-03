import { BookOpenIcon, CalendarDaysIcon, IdCardIcon } from "lucide-react";

import { HomeCta } from "@/components/home-cta";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const services = [
  {
    icon: IdCardIcon,
    title: "Student profile",
    description: "View your personal details, student ID and account role.",
  },
  {
    icon: BookOpenIcon,
    title: "Courses & grades",
    description: "Keep track of your enrolments and academic results.",
  },
  {
    icon: CalendarDaysIcon,
    title: "Campus services",
    description: "Access timetables, bookings and other student services.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-4 py-6 sm:py-12">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Your student services
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          KMU gives students secure access to their campus account. Log
          in to see your profile, or register with your student ID to get
          started.
        </p>
        <HomeCta />
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {services.map(({ icon: Icon, title, description }) => (
          <Card key={title}>
            <CardHeader>
              <Icon className="mb-2 size-5 text-muted-foreground" />
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
    </div>
  );
}
