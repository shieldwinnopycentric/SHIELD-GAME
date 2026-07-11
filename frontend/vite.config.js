import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // host: true binds to 0.0.0.0 so other devices on the same Wi-Fi (e.g. your
  // phone) can open http://<laptop-LAN-IP>:5173. HMR host is derived from the
  // page automatically, so hot-reload works over the LAN too.
  server: { host: true, port: 5173 },
});
