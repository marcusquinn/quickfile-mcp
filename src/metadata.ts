import { readFileSync } from "node:fs";
import { join } from "node:path";

interface PackageMetadata {
  name: string;
  version: string;
}

const packageMetadata = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf8"),
) as PackageMetadata;

export const SERVER_NAME = packageMetadata.name;
export const SERVER_VERSION = packageMetadata.version;
