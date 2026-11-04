/**
 * Prepares a runtime data directory (DATA_DIR, default ./data).
 *
 * Used to bootstrap an isolated directory for open-source runs so they never
 * touch premium data. Existing files are never overwritten; the admin user is
 * seeded lazily by lib/auth.ts on first login.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dataDir = path.resolve(process.env.DATA_DIR || path.join(root, "data"));

const SUBDIRS = ["db", "uploads", "uploads/generated"];

fs.mkdirSync(dataDir, { recursive: true });
for (const dir of SUBDIRS) {
  fs.mkdirSync(path.join(dataDir, dir), { recursive: true });
}

const legacyModels = path.join(dataDir, "models.json");
const modelsDoc = path.join(dataDir, "db", "settings", "models.json");
const example = path.join(root, "data", "models.json.example");
if (fs.existsSync(legacyModels) && !fs.existsSync(path.join(dataDir, "db", "users"))) {
  console.log(`[init-data-dir] Legacy layout found: run scripts/migrate-legacy-layout.mjs first.`);
} else if (!fs.existsSync(modelsDoc) && fs.existsSync(example)) {
  const { chatModels = [], imageModels = [] } = JSON.parse(fs.readFileSync(example, "utf-8"));
  fs.mkdirSync(path.dirname(modelsDoc), { recursive: true });
  fs.writeFileSync(modelsDoc, JSON.stringify({ id: "models", chatModels, imageModels }, null, 2));
  console.log(`[init-data-dir] Seeded the models catalogue from example.`);
}

console.log(`[init-data-dir] Ready: ${dataDir}`);
