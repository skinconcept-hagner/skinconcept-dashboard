import { spawnSync } from "node:child_process";

const PROJECT = "skinconcept-hagner";
const ROOT_PATH = "/v_d98f5188d9f9cf761ac092776ad0529ff4240ec8e5818c6e/kartei_data";
const apply = process.argv.includes("--apply");

function firebase(args) {
  const result = spawnSync("firebase", [...args, "--project", PROJECT], {
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "Firebase-Aufruf fehlgeschlagen").trim());
  }
  return result.stdout;
}

function list(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value && typeof value === "object") return Object.values(value).filter(Boolean);
  return [];
}

function norm(value) {
  return String(value ?? "").trim().toLowerCase();
}

function number(value) {
  const parsed = Number(String(value ?? "0").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function treatmentSignature(item) {
  return [
    norm(item?.date),
    norm(item?.time),
    norm(item?.type),
    number(item?.price),
    norm(item?.products),
    norm(item?.notes),
  ].join("|");
}

function uniqueTreatments(items) {
  const seen = new Set();
  return items.filter((item) => {
    const signature = treatmentSignature(item);
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

const data = JSON.parse(firebase(["database:get", ROOT_PATH]) || "{}");
const changes = [];

for (const [clientId, client] of Object.entries(data || {})) {
  const before = list(client?.treatments);
  const after = uniqueTreatments(before);
  if (after.length < before.length) changes.push({ clientId, before, after });
}

if (apply) {
  for (const change of changes) {
    firebase([
      "database:set",
      `${ROOT_PATH}/${change.clientId}/treatments`,
      "--data",
      JSON.stringify(change.after),
      "--force",
    ]);
  }
}

console.log(JSON.stringify({
  mode: apply ? "apply" : "dry-run",
  affectedClients: changes.length,
  duplicateTreatments: changes.reduce((sum, change) => sum + change.before.length - change.after.length, 0),
}, null, 2));
