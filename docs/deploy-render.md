# Deploying on Render with Neon

The server runs on Render's free web service, built from the repository's
`Dockerfile` by the Blueprint in [`render.yaml`](../render.yaml). Games are stored
in a Neon Postgres database.

## What the free tiers mean for this game

- **Render free web service.** It sleeps after about 15 minutes without requests
  and takes roughly a minute to wake on the next one. A workspace gets 750 free
  instance hours a month, which covers one service running all month. There is no
  persistent disk, which is why games go to Postgres rather than SQLite.
- **Neon free plan.** The database suspends itself when idle and wakes on the
  next connection, so there is nothing to restore by hand. Storage is about 0.5 GB
  per project; finished games are compressed after a day
  (`COMPRESS_COMPLETED_GAMES_DAYS=1`) and unfinished ones are purged after 30
  (`MAX_GAME_DAYS=30`).
- **Games survive the sleep.** Every save goes to Postgres, and a game is loaded
  back from it on the first request after the server wakes.

## 1. Create the database on Neon

1. Sign in at [neon.com](https://neon.com) and create a project. Pick the region
   closest to Render's Frankfurt, such as AWS Europe (Frankfurt).
2. Open **Connect** on the project dashboard and copy the connection string with
   **Connection pooling** turned on. It looks like:

   ```
   postgresql://<user>:<password>@ep-<name>-pooler.<region>.aws.neon.tech/neondb?sslmode=require
   ```

The project holds nothing but the game, so the server's tables can live in the
default schema. It creates them itself on first start.

## 2. Create the service on Render

1. In Render, choose **New → Blueprint** and connect this repository.
2. Render reads `render.yaml` and asks for the variables marked `sync: false`.
   Paste the connection string from step 1 as `POSTGRES_HOST`.
3. Apply. The first build takes several minutes; later pushes to `main` deploy by
   themselves.
4. Open the `onrender.com` address Render gives the service. The log should say
   `Connecting to Postgres database.`

The server turns on TLS for any `postgres...` connection string, which is what
Neon requires.

## Playing on a phone

The game is a PWA. Open the address on the phone and choose **Add to Home Screen**;
it then opens like an app, with its own icon and without the browser's bars.
