# 🚀 Local Server & PostgreSQL Deployment Guide
## Enterprise IT Service Desk & Device Asset Management System

This document provides complete instructions for exporting, installing, and running this application on your own **local server** (on-premise, internal intranet, or private VPS) connected to a **PostgreSQL** database.

---

## 📋 System Requirements

| Component | Minimum | Recommended |
|---|---|---|
| **OS** | Ubuntu 22.04 / 24.04 LTS, Debian 12, RHEL 9, or Windows Server | Ubuntu 24.04 LTS / Docker Host |
| **CPU / RAM** | 2 vCPU / 2 GB RAM | 4 vCPU / 4 GB RAM |
| **Node.js** | Node.js v20.x or v22.x LTS | Node.js v20.18 LTS |
| **Database** | PostgreSQL 14+ | PostgreSQL 16 |
| **Docker (Option 1)**| Docker Engine 24+ & Docker Compose v2+ | Latest Docker Compose |

---

## ⚡ Option 1: Quick Docker Compose Deployment (Recommended)

This is the fastest, cleanest, and most isolated way to run the entire stack (PostgreSQL + App) in a single command.

### Step 1: Copy Application to Server
Transfer the project folder or the archive (`itsm_app_export_*.tar.gz`) to your server:
```bash
# Extract if you transferred the tar.gz archive
tar -xzf itsm_app_export_*.tar.gz
cd export_bundle # or cd project_directory
```

### Step 2: Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Open `.env` and set a strong `JWT_SECRET`:
```env
JWT_SECRET="replace-with-a-random-32-character-secret-string"
```

### Step 3: Launch with Docker Compose
Run the following command to build the image, start PostgreSQL, run the initial schema migrations, and launch the service:
```bash
docker compose up -d --build
```

### Step 4: Verify Health
```bash
docker compose ps
docker compose logs -f app
```
You can now access the system in your web browser:
👉 **`http://<YOUR_SERVER_IP>:3000`**

---

## 🛠️ Option 2: Native Bare-Metal / Local Server Deployment

Follow this guide if you are deploying directly onto an operating system without Docker.

### 1. Install PostgreSQL 16 and Node.js 20

#### On Ubuntu / Debian:
```bash
# 1. Update package list
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 20 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs build-essential

# 3. Install PostgreSQL 16
sudo apt install -y postgresql postgresql-contrib

# 4. Verify installations
node -v    # Should show v20.x
npm -v
psql --version
```

---

### 2. Configure PostgreSQL Database & User

Log into PostgreSQL and create the dedicated database and user:
```bash
sudo -u postgres psql
```

Inside the PostgreSQL prompt (`psql`), execute:
```sql
-- 1. Create a secure user
CREATE USER itsm_user WITH ENCRYPTED PASSWORD 'YourSecurePassword2026!';

-- 2. Create the production database
CREATE DATABASE itsm_db OWNER itsm_user;

-- 3. Grant full permissions
GRANT ALL PRIVILEGES ON DATABASE itsm_db TO itsm_user;

-- 4. Connect to the database and grant schema privileges
\c itsm_db
GRANT ALL ON SCHEMA public TO itsm_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO itsm_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO itsm_user;

\q
```

---

### 3. Initialize Schema & Initial Seed Data

You have two convenient ways to initialize the database:

#### Method A: Direct SQL Import (Fastest)
Run the provided `init-db.sql` directly into your PostgreSQL database:
```bash
psql -U itsm_user -d itsm_db -h localhost -f init-db.sql
```

#### Method B: Automated Application Startup
The application automatically checks and creates missing tables (`initTicketTables.ts`) and seeds initial administrative users on startup.

---

### 4. Configure Application Environment

1. Navigate to the project root directory:
```bash
cd /opt/itsm-app  # or your installation path
```

2. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

3. Edit `.env` with your PostgreSQL credentials:
```env
PORT=3000
NODE_ENV=production

# Strong JWT Secret
JWT_SECRET="e9834b92c4b8109d94f275e7a932d01e4a781b29"

# PostgreSQL Connection String
DATABASE_URL="postgres://itsm_user:YourSecurePassword2026!@localhost:5432/itsm_db"

# Or Discrete Parameters:
SQL_HOST="localhost"
SQL_PORT="5432"
SQL_USER="itsm_user"
SQL_PASSWORD="YourSecurePassword2026!"
SQL_DB_NAME="itsm_db"
DATABASE_SSL="false"
```

---

### 5. Install Dependencies & Build

```bash
# Install dependencies
npm install

# Test PostgreSQL connection
npm run db:test

# Build production assets (Vite Frontend + Node.js bundle)
npm run build
```

---

### 6. Run as a Background Service with PM2 (Recommended)

To ensure the application stays online, restarts on server reboot, and manages logs, use **PM2**:

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start the application
pm2 start dist/server.cjs --name "itsm-desk"

# Configure PM2 to start on system boot
pm2 startup
pm2 save

# Check status and logs
pm2 status
pm2 logs itsm-desk
```

#### Alternative: Linux `systemd` Service
If you prefer standard systemd:
Create `/etc/systemd/system/itsm-desk.service`:
```ini
[Unit]
Description=Enterprise IT Service Desk
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/itsm-app
ExecStart=/usr/bin/node /opt/itsm-app/dist/server.cjs
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```
Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable itsm-desk
sudo systemctl start itsm-desk
sudo systemctl status itsm-desk
```

---

## 🌐 Nginx Reverse Proxy Setup (Port 80 / 443 HTTPS)

To access the system on standard web ports (`80` or `443`) and use custom domain names with SSL:

1. Install Nginx:
```bash
sudo apt install -y nginx
```

2. Create `/etc/nginx/sites-available/itsm.conf`:
```nginx
server {
    listen 80;
    server_name itsm.yourdomain.local; # or your server IP

    # Increase maximum upload size for ticket attachments
    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

3. Enable site and test configuration:
```bash
sudo ln -s /etc/nginx/sites-available/itsm.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🪟 Option 3: Windows Environment Deployment (PowerShell / Command Prompt / Windows Server)

If you are deploying directly onto a Windows machine or Windows Server:

### 1. Prerequisites on Windows
1. **Node.js 20 LTS for Windows:** Download the `.msi` installer from [nodejs.org](https://nodejs.org) and install it. Ensure the option *"Add to PATH"* is checked.
2. **PostgreSQL 16 for Windows:** Download the installer from [EnterpriseDB PostgreSQL](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads).
   - During setup, choose your superuser (`postgres`) password (e.g., `YourSecurePassword2026!`).
   - Default port is `5432`.
   - The PostgreSQL service will start automatically as a Windows Service (`postgresql-x64-16`).
3. Open **pgAdmin 4** or **SQL Shell (psql)** to create your target database:
   ```sql
   CREATE DATABASE itsm_db;
   ```

---

### 2. Quick One-Click Setup on Windows
You can simply double-click:
👉 **`windows-setup.bat`**  
This script will automatically:
1. Copy `.env.example` to `.env` (if not already present).
2. Run `npm install`.
3. Run `npm run db:push` to apply all database tables to PostgreSQL.
4. Run `npm run db:seed` to insert initial roles, users, and settings.
5. Run `npm run build` to compile the app.

---

### 3. Manual Step-by-Step in PowerShell or Command Prompt (CMD)

Open **PowerShell** or **Command Prompt** as Administrator and navigate to the project directory:

```powershell
# Navigate to project folder
cd C:\path\to\your\project

# 1. Install all dependencies
npm install

# 2. Setup your .env file
# In PowerShell:
Copy-Item .env.example .env
# Or in Command Prompt (cmd.exe):
copy .env.example .env
```

Open `.env` in Notepad:
```powershell
notepad .env
```
Ensure your database credentials match your Windows PostgreSQL instance:
```env
PORT=3000
NODE_ENV=production
JWT_SECRET="replace-with-a-random-32-character-secret-string-2026"

# Connect via localhost:
DATABASE_URL="postgres://postgres:YourSecurePassword2026!@localhost:5432/itsm_db"

SQL_HOST="localhost"
SQL_PORT="5432"
SQL_USER="postgres"
SQL_PASSWORD="YourSecurePassword2026!"
SQL_DB_NAME="itsm_db"
DATABASE_SSL="false"
```

Now execute the database deployment commands:
```powershell
# 3. Test your PostgreSQL connection (Optional diagnostic)
npm run db:test

# 4. Push the Drizzle schema directly to PostgreSQL (creates all 12 tables)
npm run db:push

# 5. Seed initial admin user, roles, departments, support teams, and asset data
npm run db:seed

# 6. Build the production application bundle
npm run build

# 7. Start the application
npm start
```
> 💡 *Note on npm syntax:* In npm, custom scripts are called using `npm run <name>`, e.g., `npm run db:push`, `npm run db:seed`, `npm run build`.

---

### 4. Running as a Permanent Windows Background Service

To keep the application running continuously in the background even when users log off:

#### Method A: Using PM2 for Windows (Easiest)
```powershell
# Install PM2 and Windows service helper globally
npm install -g pm2
npm install -g pm2-windows-service

# Start the application with PM2
pm2 start dist/server.cjs --name "itsm-app"

# Install as a Windows Service
pm2-service-install

# Save the current process list so it launches on system boot
pm2 save
```

#### Method B: Using NSSM (Non-Sucking Service Manager)
1. Download [NSSM](https://nssm.cc/download).
2. Open PowerShell as Admin and run:
   ```powershell
   nssm install ITSM_Service "C:\Program Files\nodejs\node.exe" "C:\path\to\your\project\dist\server.cjs"
   nssm set ITSM_Service AppDirectory "C:\path\to\your\project"
   nssm start ITSM_Service
   ```

---

### 5. Windows Firewall Configuration
If colleagues need to access the app over your local LAN or intranet:
```powershell
# Allow inbound traffic on port 3000 in Windows Firewall
New-NetFirewallRule -DisplayName "IT Service Desk App" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```
They can now browse to:
👉 **`http://<YOUR_WINDOWS_PC_OR_SERVER_IP>:3000`**

---

## 🔑 Default Credentials & First Login

Once the application is running, log in with the initial administrative account:

| Account | Email | Password | Role / Permissions |
|---|---|---|---|
| **System Administrator** | `admin@system.local` | `Admin@2026!` | Full Admin / All Permissions |
| **Operational Staff** | `ahmed.faris89@gmail.com` | `Admin@2026!` | Standard Employee / Ticket Submitter |

> 🔒 **Security Best Practice:** After initial login, go to **User Management** -> Edit User -> Change Password to update passwords immediately.

---

## 💾 PostgreSQL Maintenance & Backups

### Create a Database Backup (`pg_dump`):
```bash
pg_dump -U itsm_user -h localhost -d itsm_db -F c -b -v -f "/backup/itsm_db_$(date +%Y%m%d_%H%M%S).dump"
```

### Restore from Backup:
```bash
pg_restore -U itsm_user -h localhost -d itsm_db -v "/backup/itsm_db_backup.dump"
```

### Diagnostic Connection Test:
```bash
npm run db:test
```
This script validates your environment variables, verifies PostgreSQL TCP communication, checks database version, and inspects all registered tables.

---

## 🗄️ Relational Database Schema: Assets & Maintenance Tables

The database contains dedicated tables for physical organizational assets and maintenance logs:

### 1. `assets` Table
Stores all physical and IT organizational assets (Computers, Printers, Screens, Scanners, Biometrics, Network Devices):

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `SERIAL` | `PRIMARY KEY` | Unique numeric identifier for the asset |
| `asset_code` | `TEXT` | `NOT NULL UNIQUE` | Canonical asset barcode / code (e.g. `AST-2026-001`, `DEV-2024-001`) |
| `name` | `TEXT` | `NOT NULL` | Descriptive name (e.g. `Dell OptiPlex 7090 Micro`) |
| `category` | `TEXT` | `NOT NULL` | `electronic` or `network` |
| `device_type` | `TEXT` | `NOT NULL` | `Computer`, `Printer`, `Screen`, `Fingerprint device`, `Scanner`, `router`, `switch`, `access point` |
| `brand` | `TEXT` | `NOT NULL` | Manufacturer brand (`Dell`, `HP`, `Cisco`, `Fujitsu`, etc.) |
| `model` | `TEXT` | `NOT NULL` | Equipment model |
| `serial_number` | `TEXT` | `NULLABLE` | Manufacturer hardware serial number |
| `date_of_purchase` | `TEXT` | `NULLABLE` | Date of asset acquisition (`YYYY-MM-DD`) |
| `warranty_start_date`| `TEXT` | `NULLABLE` | Warranty activation date |
| `warranty_period` | `TEXT` | `NULLABLE` | Warranty duration (e.g. `36 Months`, `24 Months`) |
| `department` | `TEXT` | `NOT NULL` | Assigned organizational department |
| `department_ar` | `TEXT` | `NULLABLE` | Arabic translation of department name |
| `status` | `TEXT` | `DEFAULT 'Operational'` | `Operational`, `Under Maintenance`, `Storage`, `Retired` |
| `ip_address` | `TEXT` | `NULLABLE` | Assigned static/dynamic IPv4 address |
| `mac_address` | `TEXT` | `NULLABLE` | Physical MAC address |
| `location` | `TEXT` | `NULLABLE` | Physical installation location / room / rack |
| `assigned_employee` | `TEXT` | `NULLABLE` | Custodian employee name |
| `notes` | `TEXT` | `NULLABLE` | Internal IT notes |
| `created_at` | `TIMESTAMP` | `DEFAULT NOW()` | Record creation timestamp |
| `updated_at` | `TIMESTAMP` | `DEFAULT NOW()` | Last update timestamp |

---

### 2. `maintenance` Table
Records all maintenance procedures, linking directly to the asset, the hardware ticket, the ticket creator, and the uploaded approval document:

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `SERIAL` | `PRIMARY KEY` | Unique maintenance log ID |
| `asset_id` | `INTEGER` | `REFERENCES assets(id) ON DELETE CASCADE` | Connected Asset ID in the `assets` table |
| `maintenance_type` | `TEXT` | `NOT NULL` | `Routine Maintenance`, `Hardware Repair`, `Component Replacement`, `Inspection`, `Emergency Service` |
| `maintenance_date` | `TIMESTAMP`| `DEFAULT NOW()` | Date and time when maintenance was performed or scheduled |
| `maintenance_requester_name` | `TEXT` | `NOT NULL` | Requester name connected to the user who generated the hardware ticket |
| `maintenance_description` | `TEXT` | `NOT NULL` | Full maintenance description, diagnostic findings, and procedure details |
| `maintenance_request_document` | `TEXT` | `NULLABLE` | The same document uploaded during hardware ticket creation (JSON / PDF data URL) |
| `cost_of_maintenance` | `NUMERIC(12,2)` | `DEFAULT 0.00` | Financial maintenance expense |
| `requester_id` | `TEXT` | `REFERENCES users(uid) ON DELETE SET NULL` | Direct foreign key to `users.uid` for the ticket submitter |
| `ticket_id` | `INTEGER` | `REFERENCES tickets(id) ON DELETE SET NULL` | Direct foreign key to `tickets.id` for the hardware ticket |
| `ticket_no` | `TEXT` | `NULLABLE` | Formatted ticket number (e.g. `TCK-2026-0001`) |
| `status` | `TEXT` | `DEFAULT 'Completed'` | `Scheduled`, `In Progress`, `Completed`, `Pending Parts` |
| `performed_by` | `TEXT` | `DEFAULT 'Technical Support Team'` | Technician or team who executed the maintenance |
| `notes` | `TEXT` | `NULLABLE` | Supplementary service notes |
| `created_at` | `TIMESTAMP` | `DEFAULT NOW()` | Creation timestamp |
| `updated_at` | `TIMESTAMP` | `DEFAULT NOW()` | Last modification timestamp |

---

### Executing Migrations & Seeding for the New Tables

When deploying with PostgreSQL on Windows, Linux, or macOS:
```bash
# 1. Push new schema (creates 'assets' and 'maintenance' tables if not present)
npm run db:push

# 2. Seed default assets and initial maintenance records
npm run db:seed
```

