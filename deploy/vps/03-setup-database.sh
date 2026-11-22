#!/usr/bin/env bash
# ==============================================================================
# Callme Yoghurt ERP Core — PostgreSQL 16 Setup & Hardening Script (Phase 1.5)
# Security Mandate: Dedicated user, SCRAM-SHA-256, Local-Only Binding
# ==============================================================================
set -euo pipefail

echo "====================================================="
echo " Callme Yoghurt — Phase 1.5 PostgreSQL 16 Hardening"
echo "====================================================="

if [[ $EUID -ne 0 ]]; then
   echo "ERROR: This script must be run as root (or via sudo)." >&2
   exit 1
fi

DB_NAME="callme_yoghurt_prod"
DB_USER="callme_erp_user"

# Generate high-entropy 32-character database password if not provided
DB_PASS="${DB_PASSWORD:-$(openssl rand -hex 16)}"

echo "[1/4] Ensuring PostgreSQL binds to localhost only..."
PG_CONF="/etc/postgresql/16/main/postgresql.conf"
PG_HBA="/etc/postgresql/16/main/pg_hba.conf"

sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '127.0.0.1'/g" "$PG_CONF"
sed -i "s/listen_addresses = '\*'/listen_addresses = '127.0.0.1'/g" "$PG_CONF"

# Enforce SCRAM-SHA-256 authentication
sed -i "s/password_encryption = .*/password_encryption = scram-sha-256/g" "$PG_CONF"

echo "[2/4] Hardening pg_hba.conf to reject remote untrusted connections..."
# Ensure local socket and 127.0.0.1 use scram-sha-256
cat << 'EOF' > "$PG_HBA"
# TYPE  DATABASE        USER            ADDRESS                 METHOD
# "local" is for Unix domain socket connections only
local   all             postgres                                peer
local   all             all                                     scram-sha-256
# IPv4 local connections:
host    all             all             127.0.0.1/32            scram-sha-256
# IPv6 local connections:
host    all             all             ::1/128                 scram-sha-256
EOF

systemctl restart postgresql

echo "[3/4] Creating database user '$DB_USER' and database '$DB_NAME'..."
sudo -u postgres psql << EOF
DO \$\$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$DB_USER') THEN
      CREATE ROLE $DB_USER WITH LOGIN PASSWORD '$DB_PASS' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
   ELSE
      ALTER ROLE $DB_USER WITH PASSWORD '$DB_PASS';
   END IF;
END
\$\$;

SELECT 'CREATE DATABASE $DB_NAME OWNER $DB_USER'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')\gexec

GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
ALTER DATABASE $DB_NAME OWNER TO $DB_USER;
EOF

echo "[4/4] Verifying connection locally..."
PGPASSWORD="$DB_PASS" psql -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" -c "SELECT current_database(), current_user, version();"

echo "====================================================="
echo " Database Setup & Hardening Complete!"
echo " Database Name: $DB_NAME"
echo " Database User: $DB_USER"
echo " Generated Password: $DB_PASS"
echo " (Save this password into .env DB_PASSWORD!)"
echo " Public Access: DISABLED (Listening strictly on 127.0.0.1)"
echo "====================================================="
