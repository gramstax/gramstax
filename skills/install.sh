#!/bin/bash

# Docs Finder Skill Installer for Claude Code
# Usage: ./install.sh [personal|project]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}📚 Docs Finder Skill Installer${NC}"
echo ""

# Determine installation type
INSTALL_TYPE=${1:-personal}

# Name skill
NAME="gramstax"

if [ "$INSTALL_TYPE" = "personal" ]; then
    SKILL_DIR="$HOME/.claude/skills/$NAME"
    SKILL_DIR_ANTIGRAVITY="$HOME/.gemini/antigravity/skills/$NAME"
    SKILL_DIR_TRAE="$HOME/.trae/skills/$NAME"

    echo -e "${GREEN}Installing as PERSONAL skill (available in all projects)${NC}"
elif [ "$INSTALL_TYPE" = "project" ]; then
    SKILL_DIR="./.claude/skills/$NAME"
    SKILL_DIR_ANTIGRAVITY="./.agent/skills/$NAME"
    SKILL_DIR_TRAE="./.trae/skills/$NAME"

    echo -e "${GREEN}Installing as PROJECT skill (only this project)${NC}"
else
    echo -e "${RED}❌ Invalid install type. Use 'personal' or 'project'${NC}"
    exit 1
fi

# Create skill directory
echo "📁 Creating skill directory: $SKILL_DIR and $SKILL_DIR_ANTIGRAVITY and $SKILL_DIR_TRAE"
mkdir -p "$SKILL_DIR"
mkdir -p "$SKILL_DIR_ANTIGRAVITY"
mkdir -p "$SKILL_DIR_TRAE"

mkdir -p "$SKILL_DIR/scripts"
mkdir -p "$SKILL_DIR_ANTIGRAVITY/scripts"
mkdir -p "$SKILL_DIR_TRAE/scripts"

# Copy files
echo "📋 Copying skill files..."
cp SKILL.md "$SKILL_DIR/"
cp SKILL.md "$SKILL_DIR_ANTIGRAVITY/"
cp SKILL.md "$SKILL_DIR_TRAE/"

cp docs-finder.ts "$SKILL_DIR/scripts/"
cp docs-finder.ts "$SKILL_DIR_ANTIGRAVITY/scripts/"
cp docs-finder.ts "$SKILL_DIR_TRAE/scripts/"

cp best-practice.md "$SKILL_DIR/"
cp best-practice.md "$SKILL_DIR_ANTIGRAVITY/"
cp best-practice.md "$SKILL_DIR_TRAE/"

echo ""
echo -e "${GREEN}✅ Installation complete!${NC}"
echo ""
echo "📍 Installed at: $SKILL_DIR and $SKILL_DIR_ANTIGRAVITY and $SKILL_DIR_TRAE"
echo ""
echo "🧪 Test the skill:"
echo "  cd $SKILL_DIR"
echo "  bun docs-finder.ts"
echo ""