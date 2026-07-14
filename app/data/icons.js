// Shared icon picker registry for admin-created content (shop items,
// commanders) — anything a plain string can't reference gets resolved
// through here, so custom entries can be stored as {iconKey} in
// localStorage and rendered as real lucide components everywhere else.
import {
  Shield, Zap, Target, Castle, Crown, Heart, Flame, Footprints, Eye, Dumbbell,
  Coins, Wallet, Package, Landmark, Gem, Diamond, Shapes, Star, Unlock,
  TrendingUp, Medal, Sparkles, Trophy, Rocket, Compass, Anchor, Flag, Swords,
  Ticket, Skull, Sword,
} from "lucide-react";

export const ICON_REGISTRY = {
  Shield, Zap, Target, Castle, Crown, Heart, Flame, Footprints, Eye, Dumbbell,
  Coins, Wallet, Package, Landmark, Gem, Diamond, Shapes, Star, Unlock,
  TrendingUp, Medal, Sparkles, Trophy, Rocket, Compass, Anchor, Flag, Swords,
  Ticket, Skull, Sword,
};

export const ICON_KEYS = Object.keys(ICON_REGISTRY);

export function resolveIcon(key) {
  return ICON_REGISTRY[key] || Star;
}
