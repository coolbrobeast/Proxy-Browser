console.log("RUNNING FILE:", __filename);

const express = require("express");
const fetch = require("node-fetch");
const app = express();
const PORT = 3000;

app.use(express.static("."));

function rewriteHTML(html, base) {
  return html
    // rewrite <a href="">
    .replace(/href="([^"]+)"/g, (m, url) => {
      try {
        const u = new URL(url, base).href;
        return `href="/proxy?url=${encodeURIComponent(u)}"`;
      } catch {
        return m;
      }
    })
    // rewrite <script src="">
    .replace(/src="([^"]+)"/g, (m, url) => {
      try {
        const u = new URL(url, base).href;
        return `src="/proxy?url=${encodeURIComponent(u)}"`;
      } catch {
        return m;
      }
    })
    // rewrite <form action="">
    .replace(/action="([^"]*)"/g, (m, url) => {
      try {
        const u = new URL(url || base, base).href;
        return `action="/proxy?url=${encodeURIComponent(u)}"`;
      } catch {
        return m;
      }
    });
}

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
      body = rewriteHTML(body, url);
      res.setHeader("Content-Type", "text/html");
      return res.send(body);
    }

    // non-HTML: send as-is
    const buf = Buffer.from(body);
    res.setHeader("Content-Type", type);
    res.send(buf);

  } catch (err) {
    res.status(500).send("Proxy error: " + err.message);
  }
});

app.listen(PORT, () => console.log(`Proxy at http://localhost:${PORT}`));
