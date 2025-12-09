const express = require("express");
const fetch = require("node-fetch");
const path = require("path");
const app = express();

const PORT = process.env.PORT || 3000;

// Serve static files from /public
app.use(express.static(path.join(__dirname, "public")));

// Serve index.html on root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Proxy endpoint
app.get("/proxy", async (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).send("Missing URL");

  let url;
  try {
    url = new URL(target);
  } catch {
    return res.status(400).send("Invalid URL");
  }

  try {
    const upstream = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    const type = upstream.headers.get("content-type") || "text/plain";
    let body = await upstream.text();

    if (type.includes("text/html")) {
      body = body
        .replace(/href="([^"]+)"/g, (m, u) => `href="/proxy?url=${encodeURIComponent(new URL(u, url).href)}"`)
        .replace(/src="([^"]+)"/g, (m, u) => `src="/proxy?url=${encodeURIComponent(new URL(u, url).href)}"`)
        .replace(/action="([^"]*)"/g, (m, u) => `action="/proxy?url=${encodeURIComponent(new URL(u || url, url).href)}"`);

      res.setHeader("Content-Type", "text/html");
      return res.send(body);
    }

    // Non-HTML: send as-is
    const buf = Buffer.from(body);
    res.setHeader("Content-Type", type);
    res.send(buf);

  } catch (err) {
    res.status(500).send("Proxy error: " + err.message);
  }
});

app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
