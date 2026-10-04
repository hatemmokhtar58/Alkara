# Deploying Alkara

One Linux server runs everything with Docker Compose:

- `db`: MySQL 8 (data in a Docker volume)
- `api`: the ASP.NET Core API (not exposed to the internet)
- `web`: Caddy, which serves the frontend, forwards `/api` to the API, and gets and renews the HTTPS certificate automatically

A nightly timer backs up the database, keeps 7 days on the server and 30 days on off-server storage.

## What to buy

- A VPS with at least 2 vCPU, 4 GB RAM and 40 GB disk, Ubuntu 24.04.
- A domain. Point an `A` record (for example `app.yourdomain`) at the server's IP.
- Off-server backup storage that rclone supports (for example a Hetzner Storage Box, Backblaze B2 or Cloudflare R2), ideally at a different provider or location from the server.

## First setup

As root on the server:

```bash
# Docker and rclone
curl -fsSL https://get.docker.com | sh
apt-get install -y rclone git

# Firewall: SSH and the website only
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable

# The code
git clone https://github.com/hatemmokhtar58/Alkara.git /opt/alkara
cd /opt/alkara/deploy
cp .env.example .env && chmod 600 .env
nano .env        # fill in every value; generate secrets with openssl as the comments say
```

Use the generated values as they are: no spaces or quotes in `.env`.

Start it:

```bash
docker compose up -d --build
docker compose logs -f api     # wait for "Now listening on"
```

Open `https://<DOMAIN>` and log in with `INITIAL_ADMIN_USERNAME` / `INITIAL_ADMIN_PASSWORD`. After the first login you can clear `INITIAL_ADMIN_PASSWORD` from `.env`.

## Daily backup

1. Connect rclone to the backup storage (it asks a few questions and saves them in `/root/.config/rclone/rclone.conf`):

   ```bash
   rclone config            # e.g. name it "storagebox", type sftp
   rclone mkdir storagebox:alkara
   ```

2. Set `BACKUP_REMOTE=storagebox:alkara` in `.env`.
3. Run one backup by hand and check it arrived:

   ```bash
   ./backup.sh
   rclone ls storagebox:alkara
   ```

4. Turn on the nightly timer (03:00 Riyadh time):

   ```bash
   cp systemd/alkara-backup.* /etc/systemd/system/
   systemctl daemon-reload
   systemctl enable --now alkara-backup.timer
   systemctl list-timers alkara-backup.timer
   ```

`journalctl -u alkara-backup` shows each night's result. The script fails (and systemd records the failure) if the dump is incomplete or the upload does not happen.

## Restore

```bash
./restore.sh latest                                   # newest off-server backup
./restore.sh /var/backups/alkara/alkara_db_<date>.sql.gz
```

It asks for confirmation, stops the API, replaces the database, and starts the API again. CI runs a full backup, data loss and restore on every pull request (`deploy` job in `.github/workflows/ci.yml`).

To move to a new server: set it up as above with the same `.env`, then `./restore.sh latest`.

## Updating

```bash
cd /opt/alkara && git pull
cd deploy && docker compose up -d --build
```

Migrations run automatically when the API starts. Take a backup first (`./backup.sh`) before a big update.
