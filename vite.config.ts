import { defineConfig, loadEnv } from "vite";
import handler from "./api/decide.ts";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  for (const key of ["TYPESAFE_API_KEY", "JEV_ACCESS_CODE"])
    if (env[key]) process.env[key] = env[key];
  return {
    plugins: [
      {
        name: "local-api",
        configureServer(server) {
          server.middlewares.use("/api/decide", (req, res) => {
            void handler(req, res);
          });
        },
      },
    ],
  };
});
