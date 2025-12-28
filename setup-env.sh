#!/bin/bash

# ============================================================================
# Environment Setup Script
# ============================================================================
# This script helps set up the .env file for the Task Management System
# ============================================================================

set -e

echo "=========================================="
echo "Task Management System - Environment Setup"
echo "=========================================="
echo ""

# Check if .env already exists
if [ -f .env ]; then
    echo "⚠️  .env file already exists!"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Setup cancelled."
        exit 0
    fi
fi

# Copy from example
if [ ! -f .env.example ]; then
    echo "❌ Error: .env.example not found!"
    exit 1
fi

echo "📋 Copying .env.example to .env..."
cp .env.example .env

echo ""
echo "✅ .env file created!"
echo ""
echo "⚠️  IMPORTANT: Update the following in .env:"
echo "   - DB_PASSWORD (change from default)"
echo "   - DB_ROOT_PASSWORD (change from default)"
echo "   - KEYCLOAK_ADMIN_PASSWORD (change from default)"
echo "   - SMTP_USER (your SMTP username)"
echo "   - SMTP_PASS (your SMTP password)"
echo "   - SMTP_FROM (your from email address)"
echo ""
echo "📝 Edit .env with your preferred editor:"
echo "   nano .env"
echo "   vim .env"
echo "   code .env"
echo ""
echo "🚀 After updating .env, start the application:"
echo "   docker-compose up -d"
echo ""
