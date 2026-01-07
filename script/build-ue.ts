#!/usr/bin/env bun

/**
 * Build script for Unreal Engine integration
 * Builds CLI + App dist side by side
 * 
 * Output structure:
 *   dist-ue/opencode-windows-x64/
 *     bin/opencode.exe
 *     app/index.html, assets/...
 * 
 * Usage:
 *   bun run script/build-ue.ts             # Build for current platform
 *   bun run script/build-ue.ts --all       # Build for all platforms
 * 
 * @author ANZO
 * @since 07.01.2026
 */

import path from "path"
import fs from "fs"
import { $ } from "bun"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, "..")

process.chdir(rootDir)

const allFlag = process.argv.includes("--all")
const skipApp = process.argv.includes("--skip-app")

const outDir = path.join(rootDir, "dist-ue")

function copyDirSync(src: string, dest: string) {
    fs.mkdirSync(dest, { recursive: true })
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name)
        const destPath = path.join(dest, entry.name)
        if (entry.isDirectory()) {
            copyDirSync(srcPath, destPath)
        } else {
            fs.copyFileSync(srcPath, destPath)
        }
    }
}

console.log("=".repeat(60))
console.log("OpenCode Build for Unreal Engine")
console.log("=".repeat(60))

if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true })
fs.mkdirSync(outDir, { recursive: true })

// Step 1: Build App
if (!skipApp) {
    console.log("\n[1/2] Building Web UI...")
    process.chdir(path.join(rootDir, "packages/app"))
    await $`bun run build`
    process.chdir(rootDir)
    console.log("  Done!")
}

// Step 2: Build CLI
console.log("\n[2/2] Building CLI...")
process.chdir(path.join(rootDir, "packages/opencode"))
if (allFlag) {
    await $`bun run script/build.ts`
} else {
    await $`bun run script/build.ts --single`
}
process.chdir(rootDir)

// Step 3: Copy CLI + App to output
const cliDistDir = path.join(rootDir, "packages/opencode/dist")
const appDistDir = path.join(rootDir, "packages/app/dist")

if (fs.existsSync(cliDistDir)) {
    for (const platform of fs.readdirSync(cliDistDir)) {
        const src = path.join(cliDistDir, platform)
        const dest = path.join(outDir, platform)

        // Copy CLI
        copyDirSync(src, dest)

        // Copy App next to bin folder (so bin/../app works)
        if (fs.existsSync(appDistDir)) {
            copyDirSync(appDistDir, path.join(dest, "app"))
        }

        console.log(`  - ${platform}`)
    }
}

// Summary
console.log("\n" + "=".repeat(60))
console.log("Build complete!")
console.log("=".repeat(60))

for (const platform of fs.readdirSync(outDir)) {
    const binPath = path.join(outDir, platform, "bin")
    if (fs.existsSync(binPath)) {
        for (const bin of fs.readdirSync(binPath)) {
            const stat = fs.statSync(path.join(binPath, bin))
            if (!stat.isDirectory()) {
                console.log(`  ${platform}/bin/${bin} (${(stat.size / 1024 / 1024).toFixed(1)} MB)`)
            }
        }
    }
    const appPath = path.join(outDir, platform, "app")
    if (fs.existsSync(appPath)) {
        const appFiles = fs.readdirSync(appPath, { recursive: true })
        console.log(`  ${platform}/app/ (${appFiles.length} files)`)
    }
}

console.log("\nUsage: opencode.exe serve --port=60000")
console.log("Open: http://localhost:60000")
