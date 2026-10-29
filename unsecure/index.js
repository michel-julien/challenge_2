import express from "express";

const app = express();
const host = process.env.APP_HOST ?? "0.0.0.0";
const port = Number(process.env.APP_PORT ?? 5002);

app.get("/health", (_request, response) => {
  response.json({ status: "ok", service: "unsecure" });
});

app.listen(port, host, () => {
  console.log(`Unsecure API listening on http://${host}:${port}`);
});
