#!/bin/bash
cd "d:\Namith\HTML\Healthly"
echo "Current directory: $(pwd)"
echo "Git status:"
git status --short | head -5
echo ""
echo "Adding all files..."
git add .
echo "Added. Now committing..."
git commit -m "Initial commit: mental-wellness-platform with PHQ-9, chat, community, dashboard"
echo ""
echo "Pushing to GitHub..."
git push -u origin master --verbose
echo "Push completed with status: $?"
