import { resolve, extname } from "node:path";
const args = process.argv.slice(2);
const root = resolve(args.includes("--dist") ? "dist" : ".");
const portIndex = args.indexOf("--port");
const port = portIndex < 0 ? 5173 : Number(args[portIndex + 1]);
const server = Bun.serve({
  hostname: "127.0.0.1",
  port,
  async fetch(request) {
    if (!["GET", "HEAD"].includes(request.method))
      return new Response("Method not allowed", { status: 405 });
    let path: string;
    try {
      path = decodeURIComponent(new URL(request.url).pathname);
    } catch {
      return new Response("Bad path", { status: 400 });
    }
    if (path === "/") path = "/index.html";
    // Expose only the static app, never repository files, credentials or dependencies.
    if (!/^\/(?:index\.html|report\.html|(?:src|public)\/[^\0]+)$/.test(path))
      return new Response("Not found", { status: 404 });
    const target = resolve(root, "." + path);
    if (
      !target.startsWith(root + "/") ||
      path.split("/").some((part) => part.startsWith("."))
    )
      return new Response("Not found", { status: 404 });
    const file = Bun.file(target);
    if (!(await file.exists()))
      return new Response("Not found", { status: 404 });
    const mime =
      (
        {
          ".js": "text/javascript",
          ".mjs": "text/javascript",
          ".wasm": "application/wasm",
        } as Record<string, string>
      )[extname(target)] || file.type;
    return new Response(request.method === "HEAD" ? null : file, {
      headers: { "Content-Type": mime, "Cache-Control": "no-cache" },
    });
  },
});
console.log(`Static site: ${server.url}`);
