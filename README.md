# challenge_2

## Start the Docker environment

The three services are available through Docker Compose:

```bash
docker compose up --build
```

If port `5000` is already in use on the host machine, you can change the
external port without changing the internal port:

```bash
FRONTEND_PORT=5050 docker compose up --build
```

- Next.js frontend: <http://localhost:5000>
- Secure API: <http://localhost:5001/health>
- Unsecure API: <http://localhost:5002/health>

Source files are mounted into the containers to preserve hot reloading.
Dependencies remain in dedicated Docker volumes so the host machine's
`node_modules` directories are not used.

To stop the services:

```bash
docker compose down
```
