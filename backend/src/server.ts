import app from "./app";

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
