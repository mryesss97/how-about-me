/** Hang-in once per session (#334). Plain module: the root layout (server) inlines the script. */
/** Set on `<html>` once the wall has hung this session (#334): the boards then appear already hung. */
export const HUNG_ATTR = "data-landing-hung";
export const HUNG_KEY = "ham.landing.hung";

/**
 * Inline script run before hydration (root layout): a reload of `/` in a session that already saw the hang-in
 * marks `<html>` so CSS skips the animation from the first frame; the first visit records the flag.
 */
export const LANDING_HUNG_SCRIPT = `if(location.pathname==="/"){try{var s=sessionStorage;if(s.getItem("${HUNG_KEY}"))document.documentElement.setAttribute("${HUNG_ATTR}","");else s.setItem("${HUNG_KEY}","1")}catch(e){}}`;
