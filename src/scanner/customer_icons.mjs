export const CUSTOMER_ICON_SYSTEM_VERSION = "customer_icon_system_v1";
const PATHS=Object.freeze({
overview:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-7h6v7"/>',
scanner:'<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0z"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
watchlist:'<path d="M6 3h12v18l-6-4-6 4z"/>',
portfolio:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V4h8v3M3 12h18M10 12v2h4v-2"/>',
reports:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
settings:'<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.55V20h-3v-.09a1.7 1.7 0 0 0-1.03-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 7 15.4a1.7 1.7 0 0 0-1.55-1.03H5v-3h.45A1.7 1.7 0 0 0 7 10.34a1.7 1.7 0 0 0-.34-1.88L6.6 8.4l2.12-2.12.06.06A1.7 1.7 0 0 0 10.66 7a1.7 1.7 0 0 0 1.03-1.55V5h3v.45A1.7 1.7 0 0 0 15.72 7a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.12 2.12-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.55 1.03H21v3h-.09A1.7 1.7 0 0 0 19.4 15Z"></path>',
bell:'<path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
sound:'<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/>',
mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
test:'<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6A2 2 0 0 0 19 18l-5-9V3"/><path d="M8 15h8"/>',
exit:'<path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 3h7v18h-7"/>'
});
export function renderCustomerIcon(name,{size=18,label=""}={}){
 const safeName=Object.hasOwn(PATHS,name)?name:"overview";
 const safeSize=Math.max(14,Math.min(32,Number(size)||18));
 const title=String(label??"").replace(/[&<>"]/g,"");
 const aria=title?` role="img" aria-label="${title}"`:' aria-hidden="true"';
 return `<svg class="gs-icon gs-icon-${safeName}" width="${safeSize}" height="${safeSize}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"${aria}>${PATHS[safeName]}</svg>`;
}
export default{CUSTOMER_ICON_SYSTEM_VERSION,renderCustomerIcon};
