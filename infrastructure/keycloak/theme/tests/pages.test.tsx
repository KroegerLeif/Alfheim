import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Login } from "../src/login/Login";
import { Register } from "../src/login/Register";
import { Account } from "../src/account/Account";

describe("Login Page", () => {
  it("renders login form fields and submit button", () => {
    render(<Login />);
    expect(screen.getByLabelText(/Username or Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
    expect(screen.getByText("Sign in with Passkey")).toBeInTheDocument();
  });
});

describe("Register Page", () => {
  it("renders registration form fields and validates password match", () => {
    render(<Register />);
    expect(screen.getByLabelText(/First Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Last Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();

    const pass = screen.getByLabelText(/^Password/i);
    const confirm = screen.getByLabelText(/Confirm Password/i);

    fireEvent.change(pass, { target: { value: "secret123" } });
    fireEvent.change(confirm, { target: { value: "different" } });

    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
  });
});

describe("Account Page", () => {
  it("renders profile and security tabs in account console", () => {
    render(<Account />);
    expect(screen.getByText("Account Management")).toBeInTheDocument();
    expect(screen.getByText("Profile Info")).toBeInTheDocument();
    expect(screen.getByText("Security & Password")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Security & Password"));
    expect(screen.getByLabelText(/Current Password/i)).toBeInTheDocument();
  });
});
