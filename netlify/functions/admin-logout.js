import { adminLogout } from "../lib/handlers.js";

export default async (request) => adminLogout(request);

export const config = {
  path: "/api/admin/odjava",
};
