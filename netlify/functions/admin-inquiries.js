import { adminInquiries } from "../lib/handlers.js";

export default async (request) => adminInquiries(request);

export const config = {
  path: ["/api/admin/upiti", "/api/admin/upiti/:id"],
};
