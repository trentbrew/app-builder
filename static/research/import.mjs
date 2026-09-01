/**
 * Single-process Research graph import for WebContainer (run: node research/import.mjs).
 * Uses TrellisVcsEngine directly — no per-entity CLI spawns (avoids WC OOM).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const researchDir = path.dirname(fileURLToPath(import.meta.url));
const trellisRoot = path.resolve(researchDir, "..");
const manifestPath = path.join(researchDir, "manifest.json");

const { TrellisVcsEngine } = await import(
  new URL("../dist/index.js", import.meta.url).href
);

function formatAttrValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function nodeToAttributes(node) {
  const attrs = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "@id" || key === "@type") continue;
    if (value === undefined || value === null) continue;
    attrs[key] = formatAttrValue(value);
  }
  return attrs;
}

function projectionToAttributes(doc) {
  const attrs = {};
  for (const [key, value] of Object.entries(doc)) {
    if (key === "@id" || key === "@type" || key === "@context") continue;
    if (value === undefined || value === null) continue;
    attrs[key] = formatAttrValue(value);
  }
  return attrs;
}

async function yieldToGc() {
  await new Promise((resolve) => setImmediate(resolve));
}

const engine = new TrellisVcsEngine({ rootPath: trellisRoot, provenance: "cli" });
engine.open();

async function createEntity(entityId, entityType, attrs) {
  if (engine.getStoreEntity(entityId)) return;
  await engine.createStoreEntity(entityId, entityType, attrs);
  await yieldToGc();
}

async function addLink(source, attribute, target) {
  try {
    await engine.addStoreLink(source, attribute, target);
  } catch {
    // duplicate links on re-run are fine
  }
}

async function importWorkspace(relPath) {
  const raw = fs.readFileSync(path.join(researchDir, relPath), "utf8");
  const doc = JSON.parse(raw);
  const nodes = doc.workspace?.graph?.nodes ?? [];
  const edges = doc.workspace?.graph?.edges ?? [];

  for (const node of nodes) {
    const entityId = node["@id"];
    const entityType = node["@type"];
    if (!entityId || !entityType) continue;
    await createEntity(String(entityId), String(entityType), nodeToAttributes(node));
  }

  for (const edge of edges) {
    const source = edge.source?.["@id"];
    const target = edge.target?.["@id"];
    const relation = edge.relationType;
    if (!source || !target || !relation) continue;
    await addLink(source, relation, target);
  }

  return { nodes: nodes.length, edges: edges.length };
}

async function importProjection(relPath) {
  const raw = fs.readFileSync(path.join(researchDir, relPath), "utf8");
  const doc = JSON.parse(raw);
  const entityId = doc["@id"];
  const entityType = doc["@type"];
  if (!entityId || !entityType) return;

  await createEntity(String(entityId), String(entityType), projectionToAttributes(doc));

  if (typeof doc.project === "string") {
    await addLink(String(entityId), "project", doc.project);
  }
  if (typeof doc.assignee === "string") {
    await addLink(String(entityId), "assignee", doc.assignee);
  }
  if (typeof doc.owner === "string") {
    await addLink(String(entityId), "owner", doc.owner);
  }
}

if (!fs.existsSync(manifestPath)) {
  console.error("manifest.json missing — run npm run pack:research on host");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
let totalNodes = 0;
let totalEdges = 0;

for (const ws of manifest.workspaces ?? []) {
  const { nodes, edges } = await importWorkspace(ws);
  totalNodes += nodes;
  totalEdges += edges;
}

for (const rel of manifest.projections ?? []) {
  await importProjection(rel);
  totalNodes += 1;
}

console.log(`Research import ok — ${totalNodes} entities, ${totalEdges} edges`);
