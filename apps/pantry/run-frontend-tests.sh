#!/bin/bash
# Shell runner for Pantry Frontend Test Suite (Vitest + Playwright)

# Navigate to frontend directory where package.json is located
cd "$(dirname "$0")/frontend"

# 1. Run Vitest Component & Hook tests
echo ""
echo "=== Running Vitest Unit & Component Tests ==="
pnpm test

# 2. Ensure Playwright Chromium is installed
echo ""
echo "=== Checking Playwright Chromium Installation ==="
pnpm exec playwright install chromium

# 3. Run Playwright E2E tests
echo ""
echo "=== Running Playwright E2E Integration Tests ==="
pnpm exec playwright test "$@"
