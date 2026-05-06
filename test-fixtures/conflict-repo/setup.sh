#!/usr/bin/env bash
# Creates a git repo with merge conflicts across 3 file types.
# Run once: bash test-fixtures/conflict-repo/setup.sh
set -e

REPO_DIR="$(dirname "$0")/repo"
rm -rf "$REPO_DIR"
mkdir "$REPO_DIR"
cd "$REPO_DIR"

git init
git config user.email "test@test.com"
git config user.name "Test"

# Initial commit on main
cat > src.ts << 'EOF'
export function greet(name: string): string {
  return `Hello, ${name}`;
}
const TIMEOUT = 5000;
EOF

cat > config.json << 'EOF'
{
  "version": "1.0",
  "timeout": 5000
}
EOF

cat > README.md << 'EOF'
# Project
Initial readme.
EOF

git add .
git commit -m "initial"

# Feature branch
git checkout -b feature
cat > src.ts << 'EOF'
export function greet(name: string): string {
  return `Hi, ${name}!`;
}
const TIMEOUT = 3000;
EOF

cat > config.json << 'EOF'
{
  "version": "1.1",
  "timeout": 3000
}
EOF
git add .
git commit -m "feature changes"

# Main branch changes
git checkout main
cat > src.ts << 'EOF'
export function greet(name: string): string {
  return `Hello, ${name}`;
}
const TIMEOUT = 10000;
const RETRIES = 3;
EOF

cat > config.json << 'EOF'
{
  "version": "2.0",
  "timeout": 10000,
  "retries": 3
}
EOF

cat > README.md << 'EOF'
# Project v2
Updated readme with more details.
EOF
git add .
git commit -m "main changes"

# Trigger merge conflict
git merge feature || true

echo "Repo created at $REPO_DIR with merge conflicts in src.ts, config.json"
echo "README.md has a non-conflicting change only."
