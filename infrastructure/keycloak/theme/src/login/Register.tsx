import React, { useState } from "react";
import { Template } from "./Template";
import { InputField } from "../components/InputField";

export interface RegisterProps {
  kcContext?: {
    url?: {
      registrationAction?: string;
      loginUrl?: string;
    };
    register?: {
      formData?: Record<string, string>;
    };
    messagesPerField?: {
      get?: (field: string) => string | undefined;
    };
    message?: {
      type: "success" | "warning" | "error" | "info";
      summary: string;
    };
  };
}

export function Register({ kcContext }: RegisterProps) {
  const url = kcContext?.url || {};
  const formData = kcContext?.register?.formData || {};
  const [passwordsMatch, setPasswordsMatch] = useState<boolean>(true);
  const [passVal, setPassVal] = useState<string>("");
  const [confirmVal, setConfirmVal] = useState<string>("");

  const handleConfirmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setConfirmVal(val);
    setPasswordsMatch(val === passVal);
  };

  return (
    <Template headerNode="Create Alfheim Account" message={kcContext?.message}>
      <form
        action={url.registrationAction || "#"}
        method="post"
        className="space-y-3.5"
      >
        <div className="grid grid-cols-2 gap-3">
          <InputField
            label="First Name"
            name="firstName"
            defaultValue={formData.firstName || ""}
            placeholder="Jane"
            required
          />
          <InputField
            label="Last Name"
            name="lastName"
            defaultValue={formData.lastName || ""}
            placeholder="Doe"
            required
          />
        </div>

        <InputField
          label="Username"
          name="username"
          defaultValue={formData.username || ""}
          placeholder="janedoe"
          required
        />

        <InputField
          label="Email Address"
          name="email"
          type="email"
          defaultValue={formData.email || ""}
          placeholder="jane@example.com"
          required
        />

        <InputField
          label="Password"
          name="password"
          type="password"
          placeholder="••••••••"
          value={passVal}
          onChange={(e) => {
            setPassVal(e.target.value);
            if (confirmVal) setPasswordsMatch(confirmVal === e.target.value);
          }}
          required
        />

        <InputField
          label="Confirm Password"
          name="password-confirm"
          type="password"
          placeholder="••••••••"
          value={confirmVal}
          onChange={handleConfirmChange}
          error={!passwordsMatch ? "Passwords do not match" : undefined}
          required
        />

        <button
          type="submit"
          disabled={!passwordsMatch}
          className="w-full py-2.5 px-4 rounded-xl bg-primary-main hover:bg-primary-hover disabled:bg-surface-elevated disabled:text-text-muted text-white text-sm font-semibold shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary-main cursor-pointer"
        >
          Register
        </button>
      </form>

      <div className="pt-3 text-center text-xs text-text-muted">
        Already have an account?{" "}
        <a
          href={url.loginUrl || "#login"}
          className="text-primary-main hover:underline font-semibold"
        >
          Sign in
        </a>
      </div>
    </Template>
  );
}
