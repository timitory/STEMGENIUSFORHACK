#!/bin/bash

# STEM-GENIUS Database Deployment Script
# This script deploys all database migrations and sets up the live quiz system
# Run this in your project root directory

set -e  # Exit on error

echo "🚀 STEM-GENIUS Database Deployment Script"
echo "=========================================="
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "⚠️  Supabase CLI not found"
    echo "Install it with: npm install -g @supabase/cli"
    echo ""
    echo "Alternatively, use the MANUAL deployment method:"
    echo "1. Go to supabase.com/dashboard"
    echo "2. Select your project"
    echo "3. Go to SQL Editor"
    echo "4. Create new query"
    echo "5. Copy-paste content from supabase/migrations/20260527_create_live_quiz_tables.sql"
    echo "6. Click Run"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "supabase/migrations/20260527_create_live_quiz_tables.sql" ]; then
    echo "❌ Error: Migration file not found"
    echo "Make sure you're in the project root directory"
    exit 1
fi

echo "✅ Supabase CLI found"
echo ""

# Check for .env.local or .env
if [ ! -f ".env.local" ] && [ ! -f ".env" ]; then
    echo "⚠️  No .env file found"
    echo "Make sure your Supabase connection is configured"
fi

echo "📦 Deploying database migrations..."
echo ""

# Run migration
supabase db push

echo ""
echo "✅ Database deployment complete!"
echo ""
echo "Next steps:"
echo "1. Verify tables were created:"
echo "   - Go to supabase.com/dashboard"
echo "   - Select your project"
echo "   - Go to Table Editor"
echo "   - You should see 5 new tables"
echo ""
echo "2. Run the application:"
echo "   npm run dev"
echo ""
echo "3. Test the features:"
echo "   - Create a quiz"
echo "   - Generate with AI"
echo "   - Upload Excel"
echo ""
echo "✨ Deployment complete!"
