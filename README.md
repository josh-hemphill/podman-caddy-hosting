## Setup

1. Run the bash script to install the latest version of Deno, and optionally install all the other system dependencies
2. Add the nessicary deployment-specific keys to the `.env` files for each service you want to deploy (gitlab also requires a `root_password.txt` file in it's directory, refer to the `template.kube.yaml` volume binding if you need help)
3. Update any other ENV variables you want for each deployment to configure them how you want
4. Run `./build.ts` to compile all the temporary artifacts and select which services you want to include for deployment
5. Once you're happy with the configuration and the `./build.ts` runs successfully, you can run `./deploy.ts` to deploy each service to a Podman pod (can be independently started and stopped) and configure the system-level Caddy server to proxy each with HTTPS based on host-name
6. Enjoy, each service should be reachable based on hostname, just make sure you update your local or public DNS to point to your server for those host-names/domains and you should be good to go.
