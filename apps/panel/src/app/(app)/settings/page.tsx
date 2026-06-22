import { redirect } from "next/navigation";

/**
 * /settings — redirect to the default tab.
 */
export default function SettingsPage() {
  redirect("/settings/clinic");
}
