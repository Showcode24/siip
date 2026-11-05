"use client";

import { useQuery } from "@tanstack/react-query";
import { graduateApi } from "@/client/api/graduate";
import { ChangePasswordCard } from "@/components/change-password";
import { NotificationSettingsCard, PrivacyCard } from "@/components/account-privacy";
import {
  CvSection,
  EducationSection,
  NyscSection,
  PersonalSection,
  SkillsSection,
  profileKey,
} from "@/components/graduate/profile-sections";
import { QueryState } from "@/components/query-state";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/display";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/overlays";

export default function GraduateSettingsPage() {
  const profile = useQuery({ queryKey: profileKey, queryFn: graduateApi.getProfile });
  const placement = useQuery({ queryKey: ["graduate", "placement"], queryFn: graduateApi.getPlacement });
  const activeInternship = placement.data?.placement?.status === "ACTIVE";
  return (
    <>
      <PageHeader
        title="Profile and settings"
        description="Keep your profile up to date. Companies see it when you're matched."
      />
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="account">Account and privacy</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <QueryState query={profile}>
            {(p) => (
              <div className="grid gap-6">
                {[
                  ["Personal details", <PersonalSection key="p" profile={p} />],
                  ["Education", <EducationSection key="e" profile={p} />],
                  ["NYSC and availability", <NyscSection key="n" profile={p} />],
                  ["Skills", <SkillsSection key="s" profile={p} />],
                  ["CV", <CvSection key="c" profile={p} />],
                ].map(([title, node]) => (
                  <Card key={title as string}>
                    <CardHeader title={title} />
                    <CardBody>{node}</CardBody>
                  </Card>
                ))}
              </div>
            )}
          </QueryState>
        </TabsContent>
        <TabsContent value="notifications">
          <NotificationSettingsCard
            options={[
              {
                key: "application",
                label: "Application updates",
                hint: "When your application moves to a new stage.",
              },
              {
                key: "training",
                label: "Training reminders",
                hint: "A weekly nudge if you have lessons left.",
              },
              { key: "internship", label: "Internship reminders", hint: "Monthly check-in reminders." },
            ]}
          />
        </TabsContent>
        <TabsContent value="account" className="grid gap-6">
          <ChangePasswordCard />
          <PrivacyCard
            canDelete={!activeInternship}
            cannotDeleteReason="You have an active internship. Contact SIIP to end it before deleting your account."
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
