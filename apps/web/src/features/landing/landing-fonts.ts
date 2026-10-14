import { Bungee, Saira_Extra_Condensed } from "next/font/google";

/** Sign lettering for the landing wall (#271): Bungee for painted phrases, Saira Extra Condensed for figures. */
export const signFont = Bungee({
  subsets: ["latin", "vietnamese"],
  weight: "400",
  display: "swap",
  variable: "--font-sign",
});
export const figureFont = Saira_Extra_Condensed({
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700"],
  display: "swap",
  variable: "--font-figure",
});
