# Super Simple Production Setup Guide

Follow these steps one by one. Read each step out loud and make sure it is done before moving on. Think of it like building with blocks—put one block on at a time.

## 1. Fill Out the Secret Notes

1. Open the folder named `backend`.
2. Copy the file called `.env.development` and rename the copy to `.env`.
3. Open the new `.env` file and fill in these blanks:
   - `DATABASE_URL`: the address of your Postgres database (ask an adult if you need help).
   - `JWT_SECRET`: a long secret code. You can make one with `openssl rand -hex 32`.
   - `N8N_BASE_URL`: where your n8n lives. It should look like `https://example.com/api/v1/`.
   - `N8N_API_KEY`: the magic key from n8n so the app can talk to it.
   - `APP_BASE_URL`: the website where people will log in, like `https://dashboard.mysite.com`.
   - `CORS_ORIGIN`: the same website as above so the browser and server trust each other.
   - Mailgun details (only if you plan to send emails: ask an adult for these values).
4. Go to the `frontend` folder.
5. Copy `.env.example` and rename the copy to `.env`.
6. Open that file and set `VITE_API_BASE_URL=https://dashboard.mysite.com/api` (use your real address).

## 2. Get a Database Ready (Inside Docker)

1. Make sure you are standing in the top project folder (`/opt/n8n-client-console`).
2. Start the Postgres container so it is ready:
   ```bash
   docker compose up -d postgres
   ```
3. Create a database and a helper user inside that container:
   ```bash
   docker compose exec postgres psql -U postgres -c "CREATE DATABASE n8n_console;"
   docker compose exec -T postgres psql -U postgres <<'SQL'
   CREATE USER n8n_user WITH PASSWORD 'JdDjTw14!!' VALID UNTIL 'infinity';
   GRANT ALL PRIVILEGES ON DATABASE n8n_console TO n8n_user;
   SQL
   ```
4. In the backend `.env`, set
   ```
   DATABASE_URL=postgresql://n8n_user:choose-a-strong-password@postgres:5432/n8n_console?sslmode=require
   ```
   Replace the password with the one you picked in the command above.

## 3. Set Up the Database Tables

1. Make sure you are in the top project folder (where `docker-compose.yml` lives).
2. Run this command to create the tables:
   ```bash
   docker compose run --rm backend npx prisma migrate deploy
   ```
3. If you want to create the first admin user right now, run:
   ```bash
   SEED_ADMIN_EMAIL=john@nerdwaretechsolutions.com \
   SEED_ADMIN_PASSWORD=JdDjTw14!! \
   docker compose run --rm backend npx prisma db seed
   ```
4. Replace the email and password with the real values you want to use.

## 4. Start the App Machines

1. Still in the top project folder, build and start everything:
   ```bash
   docker compose up -d --build
   ```
2. Check that everything is awake:
   ```bash
   docker compose ps
   ```
3. Peek at the backend logs to make sure there are no scary red errors:
   ```bash
   docker compose logs backend
   ```

## 5. Add the Front Door (Nginx + HTTPS)

1. Install Nginx (the traffic helper) if you have not already.
2. Set Nginx so:
   - Anything at `/` goes to the frontend container at port `5175`.
   - Anything at `/api` goes to the backend container at port `4000`.
3. Use Certbot to get the shiny green lock:
   ```bash
   sudo certbot --nginx -d catalyst.nerdwaretechsolutions.com
   ```
4. After changing `.env` files, restart the containers so they read the new values:
   ```bash
   docker compose restart backend frontend
   ```

## 6. Test Everything

1. Visit `https://dashboard.mysite.com` in your browser.
2. Log in with the admin you created earlier.
3. Click around and make sure the buttons work.
4. Watch the live backend messages while you test:
   ```bash
   docker compose logs -f backend
   ```

## 7. Keep Things Healthy

1. Open `docker-compose.yml` and make sure each service has `restart: unless-stopped` so the app comes back after a reboot.
2. Turn on automatic Ubuntu updates (`unattended-upgrades`) so security fixes install themselves.
3. Check CPU, memory, and disk in AWS CloudWatch every week.
4. Plan regular database backups so you never lose important data.
5. Write down the command you will use for updates:
   ```bash
   git pull
   docker compose pull
    docker compose up -d
   ```

## 8. Bonus Ideas (Do These Later)

1. Send all your logs to CloudWatch or another log system so you can search them easily.
2. Save secret values in AWS SSM Parameter Store or Secrets Manager and have a script fill the `.env` files.
3. Build a small CI job so when you push to the production branch, the server updates itself automatically.