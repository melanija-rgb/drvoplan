import { submitInquiry } from "../lib/handlers.js";

export default async (request) => submitInquiry(request);

export const config = {
  path: "/api/upit",
};
