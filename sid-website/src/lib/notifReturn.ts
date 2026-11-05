/**
 * Retour depuis les notifications (Lot 66) : la dernière page visitée hors
 * des notifications, gardée pour l'onglet en cours. La cloche et le bouton
 * « Retour » de la page Notifications y renvoient.
 */
const KEY = "sid-page-avant-notifs";
export const NOTIFS_PATH = "/dashboard/notifications";

export function rememberPage(path: string) {
  if (path.startsWith(NOTIFS_PATH)) return;
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
    /* stockage indisponible */
  }
}

export function pageBeforeNotifs(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}
