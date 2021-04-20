const execSync = require("child_process").execSync;

const branch = process.env.TRAVIS_BRANCH;
const commitSha = execSync("git rev-parse --short HEAD")
    .toString()
    .trim();

switch (branch) {
    case "master":
        break;
    case "develop":
        execSync(
            `npm version prerelease --preid=beta-${commitSha} --no-git-tag-version`,
        );
        break;
    default:
        execSync(
            `npm version prerelease --preid=alpha-${commitSha} --no-git-tag-version`,
        );
        break;
}

execSync(`npm publish`);
