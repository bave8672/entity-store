module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    collectCoverage: true,
    collectCoverageFrom: ["src/**/*.ts", "!src/**/*.spec.ts"],
    coverageThreshold: {
        global: {
            branches: 70,
            functions: 70,
            lines: 70,
            statements: 70,
        },
    },
    testPathIgnorePatterns: ["/node_modules/", "/.build/", "/dist/", "/lib/"],
    silent: true,
};
