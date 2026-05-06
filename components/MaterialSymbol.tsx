import { createIconSet } from "@expo/vector-icons";

const glyphMap = {
  home: 0xe88a,
  add_circle: 0xe147,
  donut_large: 0xe917,
  settings: 0xe8b8,
  mood: 0xe7f2,
  calendar_month: 0xebcc,
  sleep: 0xef44,
};

const MaterialSymbol = createIconSet(
  glyphMap,
  "MaterialSymbolsRounded",
  "MaterialSymbolsRounded.ttf"
);

export default MaterialSymbol;