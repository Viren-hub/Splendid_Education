#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════
#  Splendid Education — EC2 First-Time Setup Script
#  Run this ONCE on a fresh Ubuntu 22.04 / 24.04 EC2 instance.
#
#  Usage:
#    chmod +x setup-ec2.sh
#    ./setup-ec2.sh
# ══════════════════════════════════════════════════════════════════

set -e

REPO_URL="https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME.git"
APP_DIR="$HOME/splendid_education"
LOG_DIR="$HOME/logs"
NODE_VERSION="18"
PG_VERSION="15"

echo ""
echo "══════════════════════════════════════════════"
echo "  Splendid Education — EC2 Setup"
echo "══════════════════════════════════════════════"
echo ""

# ── 1. System update ──────────────────────────────────────────
echo "[1/9] Updating system packages..."
sudo apt-get update -y && sudo apt-get upgrade -y

# ── 2. Install essentials ─────────────────────────────────────
echo "[2/9] Installing essential packages..."
sudo apt-get install -y curl git build-essential nginx

# ── 3. Install Node.js 18 via nvm ────────────────────────────
echo "[3/9] Installing Node.js ${NODE_VERSION} via nvm..."
if [ ! -d "$HOME/.nvm" ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi

export NVM_DIR="$HOME/.nvm"
# shellcheck source=/dev/null
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

nvm install "${NODE_VERSION}"
nvm use "${NODE_VERSION}"
nvm alias default "${NODE_VERSION}"

# Make node/npm available to all users and to Nginx/PM2 boot scripts
NODE_PATH="$NVM_DIR/versions/node/$(nvm version)/bin"
echo "export NVM_DIR=\"$NVM_DIR\"" >> ~/.bashrc
echo "[ -s \"\$NVM_DIR/nvm.sh\" ] && \\. \"\$NVM_DIR/nvm.sh\"" >> ~/.bashrc

# Symlink so non-interactive shells (SSH deploys) can find node/npm
sudo ln -sf "$(which node)" /usr/local/bin/node
sudo ln -sf "$(which npm)"  /usr/local/bin/npm
sudo ln -sf "$(which npx)"  /usr/local/bin/npx

echo "  Node.js: $(node -v)"
echo "  npm:     $(npm -v)"

# ── 4. Install PM2 ───────────────────────────────────────────
echo "[4/9] Installing PM2..."
npm install -g pm2
sudo ln -sf "$(which pm2)" /usr/local/bin/pm2

# Auto-start PM2 on boot
pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -1 | sudo bash

# ── 5. Install PostgreSQL 15 ──────────────────────────────────
echo "[5/9] Installing PostgreSQL ${PG_VERSION}..."
sudo apt-get install -y gnupg
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
  | sudo tee /etc/apt/sources.list.d/pgdg.list
sudo apt-get update -y
sudo apt-get install -y "postgresql-${PG_VERSION}" "postgresql-client-${PG_VERSION}"
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Create DB user + database
echo "  Creating database user and database..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='splendid'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE USER splendid WITH PASSWORD 'ChangeMe_DB_Password_123';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='splendid_education'" | grep -q 1 \
  || sudo -u postgres createdb -O splendid splendid_education
echo "  Database ready."

# ── 6. Clone repository ───────────────────────────────────────
echo "[6/9] Cloning repository..."
if [ ! -d "${APP_DIR}" ]; then
  git clone "${REPO_URL}" "${APP_DIR}"
else
  echo "  Directory already exists — pulling latest code..."
  cd "${APP_DIR}" && git pull origin main
fi

# ── 7. Configure .env ─────────────────────────────────────────
echo "[7/9] Configuring backend .env..."
cd "${APP_DIR}/backend"

if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "  ╔══════════════════════════════════════════════════════╗"
  echo "  ║  ACTION REQUIRED: fill in backend/.env              ║"
  echo "  ║                                                      ║"
  echo "  ║  Key values to set:                                  ║"
  echo "  ║    DB_USER=splendid                                  ║"
  echo "  ║    DB_PASSWORD=ChangeMe_DB_Password_123              ║"
  echo "  ║    FRONTEND_URL=https://<YOUR_CLOUDFRONT_DOMAIN>     ║"
  echo "  ║    JWT_SECRET=$(node -e \"require('crypto').randomBytes(32).toString('hex')\") ║"
  echo "  ╚══════════════════════════════════════════════════════╝"
  echo ""
  echo "  Press ENTER after you have edited .env to continue..."
  read -r
fi

# ── 8. Install dependencies and seed ─────────────────────────
echo "[8/9] Installing backend dependencies..."
npm ci --omit=dev

mkdir -p "${LOG_DIR}"

echo "  Seeding admin account..."
node scripts/seed.js

# ── 9. Configure Nginx ────────────────────────────────────────
echo "[9/9] Configuring Nginx..."
sudo cp "${APP_DIR}/backend/nginx.conf" /etc/nginx/sites-available/splendid
sudo ln -sf /etc/nginx/sites-available/splendid /etc/nginx/sites-enabled/splendid
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx

# ── Start backend ─────────────────────────────────────────────
echo ""
echo "Starting backend with PM2..."
cd "${APP_DIR}/backend"
pm2 start ecosystem.config.js --env production
pm2 save

echo ""
echo "══════════════════════════════════════════════════════════"
echo "  Setup complete!"
echo ""
echo "  Backend  : http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)/api/health"
echo "  PM2 logs : pm2 logs splendid-backend"
echo "  Nginx    : sudo nginx -t && sudo systemctl reload nginx"
echo "══════════════════════════════════════════════════════════"
