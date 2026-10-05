import { adminLogin } from "../lib/handlers.js";

export default async (request) => adminLogin(request);

export const config = {
  path: "/api/admin/prijava",
};
