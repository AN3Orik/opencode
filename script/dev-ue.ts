#!/usr/bin/env bun

/**
 * Development script for Unreal Engine integration
 * Builds the frontend and starts CLI server serving static files
 * 
 * Usage:
 *   bun run script/dev-ue.ts --port=4098
 * 
 * @author ANZO
 * @since 07.01.2026
 */

import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, "..")

// Parse args
const args = process.argv.slice(2)
const portArg = args.find(a => a.startsWith("--port="))
const port = portArg ? parseInt(portArg.split("=")[1], 10) : 4098

console.log("=".repeat(60))
console.log("OpenCode Dev Environment for Unreal Engine")
console.log("=".repeat(60))
console.log(`  Port: ${port}`)
console.log("=".repeat(60))

// Use current bun executable path
const bunExe = process.execPath

// Build the frontend first
console.log("\n[1/2] Building frontend...")
const buildProc = Bun.spawn([bunExe, "run", "build"], {
    cwd: path.join(rootDir, "packages", "app"),
    stdout: "inherit",
    stderr: "inherit",
})
await buildProc.exited
if (buildProc.exitCode !== 0) {
    console.error("Frontend build failed!")
    process.exit(1)
}
console.log("✓ Frontend built to packages/app/dist")

// Start CLI server (it will serve static files from ../app/dist)
console.log("\n[2/2] Starting CLI server...")
const cliProc = Bun.spawn(
    [bunExe, "run", "--conditions=browser", "./src/index.ts", "serve", `--port=${port}`],
    {
        cwd: path.join(rootDir, "packages", "opencode"),
        stdout: "inherit",
        stderr: "pipe",  // Capture stderr to forward to stdout (UE only captures stdout)
    }
)

// Forward child stderr to stdout so UE can see error messages
// UE's CreateProc only pipes stdout; stderr goes nowhere and errors are silently lost
if (cliProc.stderr) {
    ;(async () => {
        try {
            for await (const chunk of cliProc.stderr) {
                process.stdout.write(chunk)
            }
        } catch {}
    })()
}

console.log(`✓ OpenCode dev server starting at http://localhost:${port}`)

// Handle shutdown
process.on("SIGINT", () => {
    console.log("\nShutting down...")
    cliProc.kill()
    process.exit(0)
})

// Wait for CLI to exit
const exitCode = await cliProc.exited
if (exitCode !== 0) {
    console.error(`CLI server exited with code ${exitCode}`)
}
