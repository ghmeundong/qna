const fs = require("fs");
const path = require("path");
const { jsonRes } = require("../utils/response");

function handleStaticFiles(pathname, res) {
  const baseDir = path.resolve(__dirname, "../../frontend");
  let target = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const ext = path.extname(target).toLowerCase();

  // Service worker 파일은 js 폴더로 이동했지만 루트 경로(/sw.js)도 지원합니다.
  if (pathname === "/sw.js") {
    target = "js/sw.js";
  }

  // 파일 확장자에 따라 폴더 분류
  if (target.startsWith("assets/")) {
    // assets 폴더는 그대로 처리
  } else if (ext === ".js" && !target.startsWith("js/") && target !== "sw.js") {
    target = `js/${target}`;
  } else if (ext === ".css" && !target.startsWith("css/")) {
    target = `css/${target}`;
  }

  const resolved = path.resolve(baseDir, target);

  if (!resolved.startsWith(baseDir)) {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }

  fs.readFile(resolved, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const mimeTypes = {
      ".html": "text/html",
      ".js": "application/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".woff2": "font/woff2",
      ".woff": "font/woff",
      ".ttf": "font/ttf",
      ".otf": "font/otf",
    };
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "text/plain" });
    res.end(content);
  });
}

module.exports = { handleStaticFiles };
