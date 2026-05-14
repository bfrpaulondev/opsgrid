#!/bin/bash
# OpsGrid - Database Setup Script for Vercel Deployment
# Run this script after adding a Neon PostgreSQL database via Vercel Dashboard
#
# Usage: ./scripts/setup-vercel-db.sh <DATABASE_URL>
#
# Example:
#   ./scripts/setup-vercel-db.sh "postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/opsdb?sslmode=require"

set -e

if [ -z "$1" ]; then
  echo "❌ Usage: $0 <DATABASE_URL>"
  echo ""
  echo "To get your DATABASE_URL:"
  echo "  1. Go to https://vercel.com/dashboard"
  echo "  2. Select your OpsGrid project"
  echo "  3. Go to Storage → Create Database → Neon Postgres"
  echo "  4. Copy the connection string"
  exit 1
fi

DATABASE_URL="$1"

echo "🔧 Setting up OpsGrid database..."
echo "📌 DATABASE_URL: ${DATABASE_URL:0:30}..."

export DATABASE_URL

echo "📦 Generating Prisma client..."
npx prisma generate

echo "🗄️  Pushing schema to database..."
npx prisma db push

echo "🌱 Seeding database..."
npx prisma db seed

echo ""
echo "✅ Database setup complete!"
echo ""
echo "Next steps:"
echo "  1. Update DATABASE_URL in Vercel Dashboard → Settings → Environment Variables"
echo "  2. Redeploy: vercel deploy --prod"
echo "  3. Login with: leader@opsgrid.local / Ops123!"
