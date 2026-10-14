import { Bungee, Saira_Extra_Condensed } from "next/font/google";

/** Sign lettering (#271, app-wide since #274): Bungee for painted phrases and titles, Saira Extra Condensed for figures and condensed labels. */
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
