#!/bin/bash
# Shell runner to verify the entire Pantry stack (Backend + Frontend)

# Fail immediately if any command fails
set -e

echo "========================================="
echo "=== Running Pantry Backend Test Suite ==="
echo "========================================="
./run-tests.sh

echo ""
echo "=========================================="
echo "=== Running Pantry Frontend Test Suite ==="
echo "=========================================="
./run-frontend-tests.sh

echo ""
echo "========================================="
echo "===  ALL PANTRY TEST SUITES PASSED !  ==="
echo "========================================="
