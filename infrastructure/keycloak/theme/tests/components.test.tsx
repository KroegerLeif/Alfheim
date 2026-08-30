import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ThemeToggle } from "../src/components/ThemeToggle";
import { PasskeyButton } from "../src/components/PasskeyButton";
import { SocialProviders } from "../src/components/SocialProviders";
import { InputField } from "../src/components/InputField";
import { Header } from "../src/components/Header";

describe("ThemeToggle", () => {
  it("renders theme toggle button and toggles dark mode state", () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole("button", { name: /switch to/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});

describe("PasskeyButton", () => {
  it("renders Passkey button in disabled state when HTTPS is false", () => {
    render(<PasskeyButton isHttps={false} />);
    expect(screen.getByText("Sign in with Passkey")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Passkey HTTPS requirement info/i })).toBeInTheDocument();
  });

  it("shows tooltip when info button is hovered", () => {
    render(<PasskeyButton isHttps={false} />);
    const infoBtn = screen.getByRole("button", { name: /Passkey HTTPS requirement info/i });
    fireEvent.mouseEnter(infoBtn);
    expect(screen.getByText(/Available via HTTPS only/i)).toBeInTheDocument();
  });
});

describe("SocialProviders", () => {
  it("renders default social provider buttons for Google, GitHub, and Apple", () => {
    render(<SocialProviders />);
    expect(screen.getByText("Google")).toBeInTheDocument();
    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.getByText("Apple")).toBeInTheDocument();
  });
});

describe("InputField", () => {
  it("renders input field with label and handles input value", () => {
    render(<InputField label="Test Field" name="testField" placeholder="Enter text" />);
    expect(screen.getByLabelText("Test Field")).toBeInTheDocument();
    const input = screen.getByPlaceholderText("Enter text");
    fireEvent.change(input, { target: { value: "hello" } });
    expect(input).toHaveValue("hello");
  });

  it("renders error message when error prop is provided", () => {
    render(<InputField label="Test Field" name="testField" error="Required field" />);
    expect(screen.getByText("Required field")).toBeInTheDocument();
  });
});

describe("Header", () => {
  it("renders Alfheim Identity title and branding", () => {
    render(<Header title="Sign In" subtitle="Welcome back" />);
    expect(screen.getByText("Sign In")).toBeInTheDocument();
    expect(screen.getByText("Welcome back")).toBeInTheDocument();
    expect(screen.getByText("ALFHEIM")).toBeInTheDocument();
  });
});
