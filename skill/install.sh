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

if [ "$INSTALL_TYPE" = "personal" ]; then
    SKILL_DIR="$HOME/.claude/skills/gramstax"
    echo -e "${GREEN}Installing as PERSONAL skill (available in all projects)${NC}"
elif [ "$INSTALL_TYPE" = "project" ]; then
    SKILL_DIR="./.claude/skills/gramstax"
    echo -e "${GREEN}Installing as PROJECT skill (only this project)${NC}"
else
    echo -e "${RED}❌ Invalid install type. Use 'personal' or 'project'${NC}"
    exit 1
fi

# Create skill directory
echo "📁 Creating skill directory: $SKILL_DIR"
mkdir -p "$SKILL_DIR"
mkdir -p "$SKILL_DIR/scripts"

# Copy files
echo "📋 Copying skill files..."
cp SKILL.md "$SKILL_DIR/"
cp docs-finder.ts "$SKILL_DIR/scripts/"
cp best-practice.md "$SKILL_DIR/"

echo ""
echo -e "${GREEN}✅ Installation complete!${NC}"
echo ""
echo "📍 Installed at: $SKILL_DIR"
echo ""
echo "🧪 Test the skill:"
echo "  cd $SKILL_DIR"
echo "  bun docs-finder.ts"
echo ""
echo "📚 Usage in Claude Code:"
echo "  Just ask Claude about your documentation!"
echo "  Example: 'What members does ctx have?'"
echo "  Example: 'Show me ctx reply documentation'"
echo ""
echo "⚙️  Set custom configuration (optional):"
echo "  export DOCS_DIR=/path/to/your/docs"
echo "  export DOCS_PREFIX=gramstax  # default"
echo ""
echo -e "${YELLOW}💡 File format: prefix.className.memberName.md${NC}"
echo -e "${YELLOW}   Example: gramstax.ctx.reply.md${NC}"
echo ""