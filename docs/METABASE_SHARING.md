# Share the Metabase project dashboard

## Dashboard link

The local dashboard for this project is:

```text
http://localhost:3000/dashboard/2-t-ng-quan-lakehouse
```

That address works only on the computer running Docker. A friend on the
Internet cannot use `localhost` on their computer. The project currently has
no public Metabase URL, Metabase API token, or remote-access tunnel configured.

## No API token is needed to view the dashboard

For normal browser access, share the dashboard URL and invite your friend as a
separate Metabase user. Do not send an administrator password, session token,
or API key. A Metabase API key is for trusted programmatic integrations; it
does not make the dashboard URL reachable and should not be put in this
repository or sent to dashboard viewers.

The Gold connection is already configured inside this local Metabase as
**Lakehouse Gold (MinIO)**, backed by the local `gold-postgres` reporting
database. The viewer does not need a direct connection string or credentials
for PostgreSQL.

## Recommended Internet access: Cloudflare Tunnel + Access

Use an authenticated tunnel in front of Metabase. Do not expose port `3000`
directly to the public Internet and do not use an unauthenticated public
dashboard link for project data.

Prerequisites:

- A domain managed by Cloudflare.
- `cloudflared` installed and authenticated on the computer hosting Docker.
- Metabase running and reachable locally at `http://localhost:3000`.

1. In Cloudflare Zero Trust, create a **named tunnel** for this machine.
   Configure a public hostname such as `metabase.example.com` with service
   `http://localhost:3000`. Keep the tunnel credentials/configuration outside
   this repository.
2. In Cloudflare Zero Trust, create a **self-hosted Access application** for
   that hostname. Add an allow policy for your friend's exact email address
   (for example, one-time PIN/email identity). Do not set the application to
   allow everyone.
3. Start the named tunnel and confirm that the Access login is required from a
   browser that is not already signed in.
4. In Metabase, invite your friend using their own account. Grant view access
   only to the collection containing the project dashboard and only the
   minimum data permissions needed to view it. Do not share the Metabase admin
   account.
5. Set Metabase's **Site URL** to the HTTPS tunnel hostname in Metabase
   Admin settings so generated links use the remote address.
6. Send your friend the dashboard link:

   ```text
   https://metabase.example.com/dashboard/2-t-ng-quan-lakehouse
   ```

   Replace `metabase.example.com` with the hostname configured for your
   tunnel. Your friend must pass Cloudflare Access and sign in to Metabase.

Access is available only while the Docker host, Metabase container, and tunnel
are running. The project dashboard ID in the link is the currently configured
dashboard; if it is recreated in Metabase, use its new dashboard URL.

## Credentials and tokens

- Do not commit tunnel tokens, Cloudflare credentials, Metabase passwords,
  Metabase session tokens, or API keys.
- If you need to keep a Metabase API key locally, set `METABASE_API_KEY` in
  the ignored root `.env` file. `METABASE_URL` defaults to
  `http://localhost:3000`. The template variables are placeholders only:
  this repository does not currently read `METABASE_API_KEY` or use it to
  provide dashboard access. Do not paste the key into a tracked template.
- Do not add secrets to a README, URL query string, screenshot, or chat.
- Store tunnel credentials in Cloudflare's local `cloudflared` configuration
  or a secret manager, with file permissions restricted to the account running
  the tunnel.
- Use distinct Metabase users and rotate/revoke credentials if they are
  exposed.

## Current connection layout

```text
Friend's browser
  -> HTTPS hostname
  -> Cloudflare Access (allowlisted identity)
  -> Cloudflare Tunnel on the Docker host
  -> Metabase at localhost:3000
  -> Lakehouse Gold (MinIO) connection
  -> gold-postgres:5432 / gold_analytics
```

The browser talks to Metabase, not directly to the Gold PostgreSQL database.
Do not give the friend the PostgreSQL host credentials. For connection setup
and current dashboard context, see [`../README.md`](../README.md).
