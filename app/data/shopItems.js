// Admin-created shop items — global (not per-account), stored as plain data
// (icon as a string key) and merged into ShopModal's built-in SECTIONS by
// category. Purchases aren't live for these any more than the built-in ones.
import { resolveIcon } from "./icons";

const CUSTOM_SHOP_ITEMS_KEY = "rpg_admin_shop_items";

function loadRaw() {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(CUSTOM_SHOP_ITEMS_KEY) || "[]"); }
  catch { return []; }
}

function saveRaw(list) {
  localStorage.setItem(CUSTOM_SHOP_ITEMS_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("rpg_admin_shop_items_updated"));
}

export function getCustomShopItems() {
  return loadRaw().map(i => ({ ...i, icon: resolveIcon(i.iconKey) }));
}

export function getCustomShopItemsByCategory(category) {
  return getCustomShopItems().filter(i => i.category === category);
}

export function addShopItem({ category, name, iconKey, desc, price, tag }) {
  const list = loadRaw();
  const entry = { id: `custom_${Date.now()}`, category, name, iconKey, desc, price, tag: tag || "" };
  list.push(entry);
  saveRaw(list);
  return entry;
}

export function updateShopItem(id, patch) {
  const list = loadRaw();
  const idx = list.findIndex(i => i.id === id);
  if (idx === -1) return false;
  list[idx] = { ...list[idx], ...patch };
  saveRaw(list);
  return true;
}

export function deleteShopItem(id) {
  saveRaw(loadRaw().filter(i => i.id !== id));
}
