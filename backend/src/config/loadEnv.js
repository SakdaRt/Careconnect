import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootEnvPath = path.resolve(__dirname, "../../../.env");
const backendEnvPath = path.resolve(__dirname, "../../.env");
const externalEnvKeys = new Set(Object.keys(process.env));
const overlayAssignedKeys = new Set();

const loadModeOverlay = (filePath) => {
  if (!fs.existsSync(filePath)) return;
  const parsed = dotenv.parse(fs.readFileSync(filePath));
  Object.entries(parsed).forEach(([key, value]) => {
    if (externalEnvKeys.has(key) || overlayAssignedKeys.has(key)) return;
    process.env[key] = value;
    overlayAssignedKeys.add(key);
  });
};

dotenv.config({ path: rootEnvPath });
dotenv.config({ path: backendEnvPath, override: false });

const mode = process.env.NODE_ENV || "development";
const rootModeEnvPath = path.resolve(__dirname, `../../../.env.${mode}`);
const backendModeEnvPath = path.resolve(__dirname, `../../.env.${mode}`);

loadModeOverlay(rootModeEnvPath);
loadModeOverlay(backendModeEnvPath);
