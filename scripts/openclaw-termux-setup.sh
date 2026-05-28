#!/data/data/com.termux/files/usr/bin/bash
# DSG OpenClaw — Termux setup script
# Usage: curl -fsSL https://raw.githubusercontent.com/tdealer01-crypto/dsg-one-v1/main/scripts/openclaw-termux-setup.sh | bash

set -euo pipefail

OPENCLAW_DIR="$HOME/openclaw"
CONFIG_BASE="https://raw.githubusercontent.com/tdealer01-crypto/dsg-one-v1/main/openclaw-config"

echo "╔══════════════════════════════════════╗"
echo "║   DSG OpenClaw Setup for Termux      ║"
echo "╚══════════════════════════════════════╝"
echo ""

# Update packages
echo "[1/5] Updating packages..."
pkg update -y -q && pkg upgrade -y -q

# Install runtime dependencies
echo "[2/5] Installing Node.js, git, python..."
pkg install -y nodejs-lts git python3

# Install pnpm
npm install -g pnpm --silent

# Clone openclaw
echo "[3/5] Downloading OpenClaw..."
if [ -d "$OPENCLAW_DIR/.git" ]; then
  echo "  Updating existing installation..."
  git -C "$OPENCLAW_DIR" pull --ff-only
else
  git clone --depth 1 https://github.com/openclaw/openclaw.git "$OPENCLAW_DIR"
fi

cd "$OPENCLAW_DIR"

# Install dependencies
echo "  Installing dependencies (may take a few minutes)..."
pnpm install --frozen-lockfile --silent

# Download DSG config
echo "[4/5] Applying DSG integration config..."
mkdir -p extensions/dsg-gate
curl -fsSL "$CONFIG_BASE/extensions/dsg-gate/index.ts" -o extensions/dsg-gate/index.ts
curl -fsSL "$CONFIG_BASE/openclaw.config.ts" -o openclaw.config.ts

# Create .env
if [ ! -f .env ]; then
  curl -fsSL "$CONFIG_BASE/.env.example" -o .env
  echo ""
  echo "  ⚠️  Fill in your API keys:"
  echo "      nano $OPENCLAW_DIR/.env"
fi

# Build
pnpm build --silent

# Setup Termux:Boot autostart
echo "[5/5] Setting up auto-start (Termux:Boot)..."
mkdir -p ~/.termux/boot
cat > ~/.termux/boot/openclaw.sh << 'BOOT'
#!/data/data/com.termux/files/usr/bin/bash
cd ~/openclaw && pnpm start >> ~/openclaw/openclaw.log 2>&1 &
BOOT
chmod +x ~/.termux/boot/openclaw.sh

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   Setup Complete! ✓                  ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "  1. Fill API keys:  nano $OPENCLAW_DIR/.env"
echo "  2. Start server:   cd ~/openclaw && pnpm start"
echo "  3. Install APK:    https://github.com/tdealer01-crypto/dsg-one-v1/releases/latest"
echo ""
echo "OpenClaw will auto-start on every Termux reboot via Termux:Boot"
