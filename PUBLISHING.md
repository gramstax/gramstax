# Publishing Guide

This guide explains how to build and publish the Gramstax packages to NPM.

## Prerequisites

1. **NPM Account**: You need an NPM account with publish permissions
2. **NPM Login**: Run `npm login` to authenticate
3. **Git**: Ensure all changes are committed

## Version Management

### Update Version

Use the following commands to bump versions across all packages:

```bash
# Patch version (0.0.1 -> 0.0.2)
npm run version:patch

# Minor version (0.0.1 -> 0.1.0)
npm run version:minor

# Major version (0.0.1 -> 1.0.0)
npm run version:major
```

Or manually update versions in:
- `packages/gramstax/package.json`
- `packages/create-gramstax/package.json`

## Building

### Build All Packages

```bash
npm run build
```

This builds both `gramstax` and `create-gramstax` using Nx.

### Build Individual Packages

```bash
# Build gramstax only
npm run build:gramstax

# Build create-gramstax only
npm run build:create-gramstax
```

## Publishing

### Publish All Packages

```bash
npm run publish:all
```

This will:
1. Build all packages
2. Publish gramstax
3. Publish create-gramstax

### Publish Individual Packages

```bash
# Publish gramstax only
npm run publish:gramstax

# Publish create-gramstax only
npm run publish:create-gramstax
```

## Publishing Workflow

### 1. Prepare Release

```bash
# Ensure you're on main branch
git checkout main

# Pull latest changes
git pull origin main

# Install dependencies
bun install
```

### 2. Update Version

```bash
# Example: bump patch version
npm run version:patch
```

### 3. Update Changelog (Optional)

Edit `CHANGELOG.md` to document changes.

### 4. Commit Version Changes

```bash
git add .
git commit -m "chore: bump version to 0.0.2"
git push origin main
```

### 5. Build and Test

```bash
# Build packages
npm run build

# Test the build locally
cd packages/create-gramstax/dist
node index.js test-project
```

### 6. Publish to NPM

```bash
npm run publish:all
```

### 7. Create Git Tag

```bash
git tag v0.0.2
git push origin v0.0.2
```

## Package Structure

### gramstax

**Location**: `packages/gramstax/`

**What gets published**:
- `dist/` - Compiled JavaScript and type declarations
- `src/` - Source TypeScript files
- `package.json`
- `README.md`

**Main entry**: `dist/index.js`

### create-gramstax

**Location**: `packages/create-gramstax/`

**What gets published**:
- `dist/` - Compiled JavaScript and type declarations
- `templates/` - Template files for project generation
- `package.json`
- `README.md`

**Binary**: `create-gramstax` → `dist/index.js`

## Testing After Publishing

### Test gramstax

```bash
# Create a test project
mkdir test-gramstax
cd test-gramstax
npm init -y
npm install gramstax

# Test import
node -e "import('gramstax').then(m => console.log(Object.keys(m)))"
```

### Test create-gramstax

```bash
# Test with npx
npx create-gramstax test-bot

# Or with bun
bun create gramstax test-bot
```

## Troubleshooting

### Package Not Found

- Ensure you're logged into NPM: `npm whoami`
- Check package name availability: `npm view gramstax`
- Verify organization access if using scoped packages

### Build Errors

```bash
# Clean Nx cache
nx reset

# Clean and rebuild
rm -rf packages/*/dist
npm run build
```

### Template Files Missing

Ensure `project.json` includes template assets:

```json
"assets": [
  {
    "input": "packages/create-gramstax/src",
    "glob": "templates/**/*.ts",
    "output": "."
  },
  {
    "input": "packages/create-gramstax/src",
    "glob": "templates/**/*.html",
    "output": "."
  },
  {
    "input": "packages/create-gramstax/src/templates/config",
    "glob": "*",
    "output": "templates/config"
  }
]
```

## NPM Scripts Reference

| Script | Description |
|--------|-------------|
| `build` | Build all packages |
| `build:gramstax` | Build gramstax only |
| `build:create-gramstax` | Build create-gramstax only |
| `publish:gramstax` | Publish gramstax to NPM |
| `publish:create-gramstax` | Publish create-gramstax to NPM |
| `publish:all` | Build and publish all packages |
| `version:patch` | Bump patch version (0.0.x) |
| `version:minor` | Bump minor version (0.x.0) |
| `version:major` | Bump major version (x.0.0) |

## Best Practices

1. **Always test locally** before publishing
2. **Update README** and documentation
3. **Tag releases** in Git
4. **Keep versions in sync** between packages
5. **Document breaking changes** in CHANGELOG
6. **Test the published packages** immediately after publishing

## Release Checklist

- [ ] All tests passing
- [ ] Version bumped
- [ ] CHANGELOG updated
- [ ] Changes committed and pushed
- [ ] Build successful
- [ ] Packages published
- [ ] Git tag created
- [ ] Packages tested from NPM
- [ ] Documentation updated
