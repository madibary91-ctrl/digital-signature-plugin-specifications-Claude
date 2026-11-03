import fs from "node:fs/promises";
import path from "node:path";

/** پوشه‌ی محافظت‌شده — خارج از public و فقط از طریق مسیر احراز هویت‌شده قابل دریافت است */
const DIR = path.join(process.cwd(), "storage", "signatures");

function safeName(name: string) {
  return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "");
}

export async function saveSignatureFile(name: string, buffer: Buffer): Promise<string> {
  const file = safeName(name);
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(path.join(DIR, file), buffer, { mode: 0o600 });
  return file;
}

export async function readSignatureFile(name: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(path.join(DIR, safeName(name)));
  } catch {
    return null;
  }
}

export async function deleteSignatureFile(name: string) {
  try {
    await fs.unlink(path.join(DIR, safeName(name)));
  } catch {
    /* ignore */
  }
}
