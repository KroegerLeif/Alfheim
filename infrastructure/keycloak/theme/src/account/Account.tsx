import { useState } from "react";
import { User, Key } from "lucide-react";
import { CardLayout } from "../components/CardLayout";
import { InputField } from "../components/InputField";

export interface AccountProps {
  kcContext?: {
    url?: {
      accountUrl?: string;
      passwordUrl?: string;
      referrerUrl?: string;
    };
    account?: {
      username?: string;
      email?: string;
      firstName?: string;
      lastName?: string;
    };
    message?: {
      type: "success" | "warning" | "error" | "info";
      summary: string;
    };
  };
}

export function Account({ kcContext }: AccountProps) {
  const account = kcContext?.account || {};
  const url = kcContext?.url || {};
  const [activeTab, setActiveTab] = useState<"profile" | "password">("profile");

  return (
    <CardLayout title="Account Management" subtitle="Manage your profile and credentials">
      {kcContext?.message && (
        <div className="p-3 rounded-xl text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          {kcContext.message.summary}
        </div>
      )}

      <div className="flex border-b border-subtle mb-4">
        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={`flex items-center space-x-2 py-2 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === "profile"
              ? "border-primary-main text-primary-main"
              : "border-transparent text-text-muted hover:text-text-main"
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Profile Info</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("password")}
          className={`flex items-center space-x-2 py-2 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === "password"
              ? "border-primary-main text-primary-main"
              : "border-transparent text-text-muted hover:text-text-main"
          }`}
        >
          <Key className="w-3.5 h-3.5" />
          <span>Security & Password</span>
        </button>
      </div>

      {activeTab === "profile" ? (
        <form action={url.accountUrl || "#"} method="post" className="space-y-3.5">
          <InputField label="Username" name="username" defaultValue={account.username || ""} disabled />

          <div className="grid grid-cols-2 gap-3">
            <InputField label="First Name" name="firstName" defaultValue={account.firstName || ""} required />
            <InputField label="Last Name" name="lastName" defaultValue={account.lastName || ""} required />
          </div>

          <InputField label="Email Address" name="email" type="email" defaultValue={account.email || ""} required />

          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-xl bg-primary-main hover:bg-primary-hover text-white text-sm font-semibold shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary-main cursor-pointer"
          >
            Save Profile Changes
          </button>
        </form>
      ) : (
        <form action={url.passwordUrl || "#"} method="post" className="space-y-3.5">
          <InputField label="Current Password" name="password" type="password" required />
          <InputField label="New Password" name="password-new" type="password" required />
          <InputField label="Confirm New Password" name="password-confirm" type="password" required />

          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-xl bg-primary-main hover:bg-primary-hover text-white text-sm font-semibold shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary-main cursor-pointer"
          >
            Update Password
          </button>
        </form>
      )}

      {url.referrerUrl && (
        <div className="pt-3 text-center text-xs text-text-muted">
          <a href={url.referrerUrl} className="text-primary-main hover:underline font-semibold">
            &laquo; Back to application
          </a>
        </div>
      )}
    </CardLayout>
  );
}
