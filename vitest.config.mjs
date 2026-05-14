/** @type {import("vitest").UserConfig} */
export default {
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    globals: false,
  },
};
