"use client";

import { useState } from "react";
import OrganisationForm from "../organisation-form";
import ProductionAccessManager from "../../admin/production-access-manager";
import SsoSetupForm from "../../admin/sso/sso-setup-form";

type OrganisationSettingsTabsProps = {
  isAdmin: boolean;
  organisation: {
    name: string;
    primaryLocation: string | null;
    contactEmail: string | null;
    description: string | null;
  };
  productionRoles: string[];
  users: {
    userId: string;
    name: string;
    email: string;
    productions: { productionId: string; productionName: string; role: string }[];
  }[];
};

type TabKey = "profile" | "access" | "sso";

export default function OrganisationSettingsTabs({
  isAdmin,
  organisation,
  productionRoles,
  users,
}: OrganisationSettingsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("profile");

  const tabs: { key: TabKey; label: string; adminOnly?: boolean }[] = [
    { key: "profile", label: "Profile" },
    { key: "access", label: "Production access", adminOnly: true },
    { key: "sso", label: "SSO & domains", adminOnly: true },
  ];

  const visibleTabs = tabs.filter((tab) => !tab.adminOnly || isAdmin);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 shadow-sm">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeTab === tab.key
                ? "bg-amber-300 text-slate-950"
                : "text-slate-300 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "profile" ? (
        <OrganisationForm
          initialValues={{
            name: organisation.name,
            primaryLocation: organisation.primaryLocation ?? "",
            contactEmail: organisation.contactEmail ?? "",
            description: organisation.description ?? "",
          }}
        />
      ) : null}

      {activeTab === "access" ? (
        isAdmin ? (
          <ProductionAccessManager
            productionRoles={productionRoles}
            users={users}
          />
        ) : null
      ) : null}

      {activeTab === "sso" ? (isAdmin ? <SsoSetupForm /> : null) : null}
    </div>
  );
}
