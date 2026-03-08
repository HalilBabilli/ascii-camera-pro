#!/bin/bash
set -e

echo "=== Client Portal - EC2 Deployment Script ==="
echo ""

# -----------------------------------------------
# Run this on a fresh Ubuntu EC2 instance (t3.micro)
# Security group should allow: 22, 80, 443
# -----------------------------------------------

# 1. System updates
echo "[1/7] Updating system..."
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 20.x
echo "[2/7] Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Install PostgreSQL
echo "[3/7] Installing PostgreSQL..."
sudo apt install -y postgresql postgresql-contrib

# 4. Setup database
echo "[4/7] Setting up database..."
sudo -u postgres psql <<EOF
CREATE USER portal_user WITH PASSWORD 'CHANGE_THIS_PASSWORD';
CREATE DATABASE client_portal OWNER portal_user;
GRANT ALL PRIVILEGES ON DATABASE client_portal TO portal_user;
EOF

# 5. Install Nginx
echo "[5/7] Installing Nginx..."
sudo apt install -y nginx

# Configure Nginx as reverse proxy
sudo tee /etc/nginx/sites-available/client-portal > /dev/null <<'NGINX'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/client-portal /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

# 6. Setup application
echo "[6/7] Setting up application..."
cd /home/ubuntu/client-portal  # Adjust path as needed

# Copy .env.example to .env and edit
cp .env.example .env
echo ""
echo ">>> IMPORTANT: Edit /home/ubuntu/client-portal/.env with your actual values!"
echo ">>>   nano .env"
echo ""

# Install dependencies
npm install --production

# Initialize database
npm run db:init

# 7. Setup systemd service for auto-start
echo "[7/7] Creating systemd service..."
sudo tee /etc/systemd/system/client-portal.service > /dev/null <<SERVICE
[Unit]
Description=Client Portal
After=network.target postgresql.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/client-portal
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
SERVICE

sudo systemctl daemon-reload
sudo systemctl enable client-portal
sudo systemctl start client-portal

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Next steps:"
echo "  1. Edit .env with real credentials: nano /home/ubuntu/client-portal/.env"
echo "  2. Point your domain to this server's IP"
echo "  3. Install SSL with: sudo apt install certbot python3-certbot-nginx && sudo certbot --nginx"
echo "  4. Restart: sudo systemctl restart client-portal"
echo ""
echo "Client form:     http://YOUR_DOMAIN/"
echo "Admin dashboard: http://YOUR_DOMAIN/admin"
