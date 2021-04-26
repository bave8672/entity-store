module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    collectCoverage: true,
    collectCoverageFrom: ["src/**/*.ts", "!src/**/*.spec.ts"],
    coverageThreshold: {
        global: {
            branches: 100,
        },
    },
    testPathIgnorePatterns: ["/node_modules/", "/.build/", "/dist/", "/lib/"],
    silent: true,
};
