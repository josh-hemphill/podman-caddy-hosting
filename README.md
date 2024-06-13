To run and apply the caddyfile config: `caddy run`
If it's already running, just run `caddy reload` to pick up the new config.

Run `python3 dotenv-to-caddy.py` to recreate all the directives for each service based on their corresponding `.env` file which contains the ports and domains each is listening on and resolves for.
