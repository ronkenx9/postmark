import { handle } from "../server/index.mjs";

export default function game(req, res) {
  const url = new URL(req.url, "http://localhost");
  const route = url.searchParams.get("route");
  if (route !== null) req.url = "/api/" + route;
  return handle(req, res);
}
