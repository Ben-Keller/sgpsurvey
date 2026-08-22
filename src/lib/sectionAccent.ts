import type { CSSProperties } from "react";

type Accent = { color: string; rgb: string; chartColor: string };

// Official UN Sustainable Development Goal colors are used for data marks.
// Darker companion colors keep section labels and controls readable on white.
const sdgDataPalette = [
  "#E5243B", // SDG 1
  "#DDA63A", // SDG 2
  "#4C9F38", // SDG 3
  "#C5192D", // SDG 4
  "#FF3A21", // SDG 5
  "#26BDE2", // SDG 6
  "#FCC30B", // SDG 7
  "#A21942", // SDG 8
  "#FD6925", // SDG 9
  "#DD1367", // SDG 10
  "#FD9D24", // SDG 11
  "#BF8B2E", // SDG 12
  "#3F7E44", // SDG 13
  "#0A97D9", // SDG 14
  "#56C02B", // SDG 15
  "#00689D", // SDG 16
  "#19486A", // SDG 17
];

const sectionPalettes: Record<string, Accent[]> = {
  country_team: [
    { color: "#3F7E44", rgb: "63 126 68", chartColor: "#3F7E44" },
    { color: "#007A9E", rgb: "0 122 158", chartColor: "#26BDE2" },
    { color: "#85651B", rgb: "133 101 27", chartColor: "#DDA63A" },
    { color: "#397D1D", rgb: "57 125 29", chartColor: "#56C02B" },
  ],
  grantee_partners: [
    { color: "#19486A", rgb: "25 72 106", chartColor: "#19486A" },
    { color: "#B51C31", rgb: "181 28 49", chartColor: "#E5243B" },
    { color: "#A21942", rgb: "162 25 66", chartColor: "#DD1367" },
    { color: "#A65B00", rgb: "166 91 0", chartColor: "#FD9D24" },
  ],
  implementing_agencies: [
    { color: "#00689D", rgb: "0 104 157", chartColor: "#00689D" },
    { color: "#80611C", rgb: "128 97 28", chartColor: "#BF8B2E" },
    { color: "#B94716", rgb: "185 71 22", chartColor: "#FD6925" },
  ],
  steering_committee: [
    { color: "#C02F1B", rgb: "192 47 27", chartColor: "#FF3A21" },
    { color: "#A21942", rgb: "162 25 66", chartColor: "#A21942" },
    { color: "#347629", rgb: "52 118 41", chartColor: "#4C9F38" },
    { color: "#0076A8", rgb: "0 118 168", chartColor: "#0A97D9" },
  ],
};

const fallbackPalette = sectionPalettes.country_team;

function contrastColor(hex: string) {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255);
  const [red, green, blue] = channels.map((channel) => channel <= .03928 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
  const luminance = .2126 * red + .7152 * green + .0722 * blue;
  return luminance > .38 ? "#12343b" : "#ffffff";
}

export function sectionAccentStyle(groupKey: string, sectionIndex: number): CSSProperties {
  const palette = sectionPalettes[groupKey] ?? fallbackPalette;
  const accent = palette[sectionIndex % palette.length];
  return {
    "--section-color": accent.color,
    "--section-rgb": accent.rgb,
    "--section-fill-color": accent.chartColor,
    "--section-contrast-color": contrastColor(accent.chartColor),
  } as CSSProperties;
}

export function sectionChartPalette(groupKey: string, sectionIndex: number): string[] {
  const palette = sectionPalettes[groupKey] ?? fallbackPalette;
  const normalizedIndex = ((sectionIndex % palette.length) + palette.length) % palette.length;
  const sectionColors = [...palette.slice(normalizedIndex), ...palette.slice(0, normalizedIndex)].map((accent) => accent.chartColor);
  return [...new Set([...sectionColors, ...sdgDataPalette])];
}
