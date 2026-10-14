# Deploying on Render with Supabase

The server runs on Render's free web service, built from the repository's
`Dockerfile` by the Blueprint in [`render.yaml`](../render.yaml). Games are stored
in Supabase Postgres.

## What the free tiers mean for this game

- **Render free web service.** It sleeps after about 15 minutes without requests
  and takes roughly a minute to wake on the next one. A workspace gets 750 free
  instance hours a month, which covers one service running all month. There is no
  persistent disk, which is why games go to Postgres rather than SQLite.
- **Supabase free project.** It is paused after a week with little database
  activity, and can be restored from the Supabase dashboard. A project that also
  serves another app stays active through that app. The free plan has 500 MB of
  database space; finished games are compressed after a day
  (`COMPRESS_COMPLETED_GAMES_DAYS=1`) and unfinished ones are purged after 30
  (`MAX_GAME_DAYS=30`).
- **Games survive the sleep.** Every save goes to Postgres, and a game is loaded
  back from it on the first request after the server wakes.

## 1. Give the game its own schema and role in Supabase

The server creates its tables (`games`, `game`, `participants`, `game_results`,
`completed_game`, `session`, ...) in whatever schema its `search_path` names. Do not
let that be `public`: Supabase serves `public` through its Data API, so the game's
tables would be readable with the project's anon key, and in a project shared with
another app they would sit beside that app's tables.

Run this in the SQL editor of the Supabase project, with a long random password:

```sql
create role tfm with login password 'REPLACE-WITH-A-LONG-RANDOM-PASSWORD';
create schema tfm authorization tfm;
alter role tfm set search_path = tfm;
```

The `tfm` role owns its schema and nothing else, so the game cannot read or change
another app's data, and the other app's keys do not reach the game's tables.

A separate Supabase project works too, with the same three statements; it will be
paused after a quiet week, though.

## 2. Find the session pooler connection string

In Supabase, open **Connect** and copy the **Session pooler** string (port 5432 on
a `*.pooler.supabase.com` host). Not the direct connection: that is IPv6, which
Render does not reach. Not the transaction pooler (port 6543): the server keeps a
connection pool of its own and expects a session.

Replace the user and password with the role from step 1. The pooler's user name is
the role followed by the project reference:

```
postgresql://tfm.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

The server turns on TLS for any `postgres...` connection string.

## Or: Neon instead of Supabase

Any Postgres reachable over IPv4 works. On Neon, create a project and copy its
pooled connection string as `POSTGRES_HOST`; steps 1 and 2 are not needed, because
Neon serves no Data API over the `public` schema and the project holds nothing
else. Neon suspends an idle database by itself and wakes it on the next
connection, so there is no pause to undo by hand.

## 3. Create the service on Render

1. In Render, choose **New → Blueprint** and connect this repository.
2. Render reads `render.yaml` and asks for the variables marked `sync: false`.
   Paste the connection string from step 2 as `POSTGRES_HOST`.
3. Apply. The first build takes several minutes; later pushes to `main` deploy by
   themselves.
4. Open the `onrender.com` address Render gives the service. The log should say
   `Connecting to Postgres database.`

## Playing on a phone

The game is a PWA. Open the address on the phone and choose **Add to Home Screen**;
it then opens like an app, with its own icon and without the browser's bars.
