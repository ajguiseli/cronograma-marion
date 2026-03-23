const express = require("express");
const path = require("path");
const chapters = require("./src/data");

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// API: all chapter data
app.get("/api/chapters", (req, res) => {
  res.json(chapters);
});

// API: stats summary
app.get("/api/stats", (req, res) => {
  const summary = {};
  for (const [key, ch] of Object.entries(chapters)) {
    summary[key] = {
      title: ch.title,
      color: ch.color,
      total: ch.topics.length,
      totalHours: ch.topics.reduce((s, t) => s + t.hours, 0),
      byDifficulty: {
        easy:   ch.topics.filter(t => t.difficulty === "easy").length,
        medium: ch.topics.filter(t => t.difficulty === "medium").length,
        hard:   ch.topics.filter(t => t.difficulty === "hard").length,
      },
    };
  }
  res.json(summary);
});

// Serve SPA for all other routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`\n  Cronograma Marion rodando em http://localhost:${PORT}\n`);
});
