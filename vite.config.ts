import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// relative base: the build works from any folder, including GitHub Pages' /card-freezing/
export default defineConfig({ base: "./", plugins: [react()] });
