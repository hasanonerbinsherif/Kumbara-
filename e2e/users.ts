// The people the end-to-end tests log in as. The Admin comes from the seed.
export const ADMIN = {
  email: (process.env.ADMIN_EMAIL ?? "admin@example.com").toLowerCase(),
  password: process.env.ADMIN_PASSWORD ?? "",
};

export const SAVER = { email: "e2e-saver@example.com", password: "e2e-saver-password", name: "E2E Saver" };
