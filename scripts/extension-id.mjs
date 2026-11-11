import crypto from "node:crypto";

// Chromium hashes the native FilePath bytes: UTF-16LE on Windows, UTF-8 on POSIX.
// Pass fs.realpathSync(extensionDir), just as the browser resolves an unpacked path.
export function unpackedExtensionId(realPath, platform = process.platform) {
  return [...crypto.createHash("sha256").update(realPath, platform === "win32" ? "utf16le" : "utf8").digest("hex").slice(0, 32)]
    .map((c) => String.fromCharCode(97 + parseInt(c, 16))).join("");
}
