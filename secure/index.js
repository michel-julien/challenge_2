import express from "express";

const app = express();
const host = process.env.APP_HOST ?? "0.0.0.0";
const port = Number(process.env.APP_PORT ?? 5001);

app.get("/health", (_request, response) => {
  response.json({ status: "ok", service: "secure" });
});

app.listen(port, host, () => {
  console.log(`Secure API listening on http://${host}:${port}`);
});
