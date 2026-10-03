// Config loader with fail-closed verification gate.
import { readFileSync } from "node:fs";

export function loadConfig(path = new URL("../../config/monad.json", import.meta.url)) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * Returns list of UNVERIFIED items for a given network (or activeNetwork).
 * Production execution must be blocked if non-empty.
 */
export function unverifiedItems(cfg, networkKey = null) {
  const out = [];
  const targetKey = networkKey || cfg.activeNetwork || "testnet";
  const net = cfg.networks ? cfg.networks[targetKey] : (cfg.network ? cfg : null);

  if (!net) {
    out.push(`network-missing:${targetKey}`);
    return out;
  }

  if (net.status !== "VERIFIED" || net.chainId == null) {
    out.push("network");
  }
  if (!net.baseAsset || net.baseAsset.status !== "VERIFIED" || !net.baseAsset.address) {
    out.push("baseAsset");
  }
  if (Array.isArray(net.tokens)) {
    for (const t of net.tokens) {
      if (t.status !== "VERIFIED" || !t.address) {
        out.push(`token:${t.symbol}`);
      }
    }
  }
  if (Array.isArray(net.venues)) {
    for (const v of net.venues) {
      if (v.status !== "VERIFIED" || (!v.routerAddress && !v.poolManager)) {
        out.push(`venue:${v.name}`);
      }
    }
  }
  return out;
}

export function assertLiveAllowed(cfg, networkKey = null) {
  const u = unverifiedItems(cfg, networkKey);
  if (u.length) {
    throw new Error(`Live execution blocked, UNVERIFIED: ${u.join(", ")}`);
  }
}
