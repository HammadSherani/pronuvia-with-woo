import { logout } from "@/actions/auth/logout";

export default async function LogoutPage() {
  await logout();
}
