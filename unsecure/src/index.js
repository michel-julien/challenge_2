import app from "./app.js";

const host = process.env.APP_HOST ?? "0.0.0.0";
const port = Number(process.env.APP_PORT ?? 5002);

app.listen(port, host, () => {
  console.log(`Unsecure API listening on http://${host}:${port}`);
});
