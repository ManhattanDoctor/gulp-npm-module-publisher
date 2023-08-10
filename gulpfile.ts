import * as del from "del";
import { dest, series, src, task } from "gulp";
import * as clean from "gulp-clean";
import * as path from "path";
import run from "gulp-run-command";
import { createProject } from "gulp-typescript";

// --------------------------------------------------------------------------
//
//  Properties
//
// --------------------------------------------------------------------------

const input = path.join(__dirname, "../../src");
const output = path.join(__dirname, "../../dist");

const outputEsm = path.join(output, "./esm");
const tsConfigEsm = path.join(__dirname, "../../tsconfig.esm.json");
const projectEsm = createProject(tsConfigEsm);

const outputCjs = path.join(output, "./cjs");
const tsConfigCjs = path.join(__dirname, "../../tsconfig.cjs.json");
const projectCjs = createProject(tsConfigCjs);

const projectDirectory = projectEsm.projectDirectory;

// --------------------------------------------------------------------------
//
//  Files Methods
//
// --------------------------------------------------------------------------

const filesDelete = async (
  files: Array<string>,
  options?: any
): Promise<void> => {
  await new Promise((resolve) => {
    src(files, options || { read: false })
      .pipe(clean())
      .on("finish", resolve);
  });
};

const filesCopy = async (
  files: Array<string>,
  destination: string,
  options?: any
): Promise<void> => {
  await new Promise((resolve) => {
    src(files, options || { allowEmpty: true })
      .pipe(dest(destination))
      .on("finish", resolve);
  });
};

// --------------------------------------------------------------------------
//
//  Package Methods
//
// --------------------------------------------------------------------------

const nodeModulesClean = async (directory: string): Promise<void> => {
  await del([`${directory}/node_modules`, `${directory}/package-lock.json`], {
    force: true,
  });
};

const packageCopyFiles = async (): Promise<void> => {
  await filesCopy(
    [`${projectDirectory}/package.json`],
    output
  );
};

const packageClean = async (): Promise<void> => {
  // Remove node_modules
  await nodeModulesClean(input);

  // Remove compiled files
  await filesDelete([
    `${input}/**/*.js`,
    `${input}/**/*.d.ts`,
    `${input}/**/*.js.map`,
    `${input}/**/*.d.ts.map`,
    `!${input}/**/package.json`,
    `!${input}/**/node_modules/**/*`,
  ]);
};

const packageCompile = async (): Promise<void> => {
  await new Promise((resolve) => {
    projectEsm.src().pipe(projectEsm()).pipe(dest(outputEsm)).on("finish", resolve);
  });
  await new Promise((resolve) => {
    projectCjs.src().pipe(projectCjs()).pipe(dest(outputCjs)).on("finish", resolve);
  });
};

const packageCommit = async (): Promise<void> => {
  try {
    await run(`git commit -a -m "auto commit"`)();
  } catch (error) { }
};

const packagePush = async (): Promise<void> => {
  try {
    await run("git push --all origin")();
  } catch (error) { }
};

const packageBuild = async (): Promise<void> => {
  // Remove output directory
  await del(output, { force: true });
  // Compile project
  await packageCompile();
  // Copy files
  await packageCopyFiles();
};

const packagePublish = async (
  type: "patch" | "minor" | "major"
): Promise<void> => {
  // Build package or copy files
  await packageBuild();
  // Commit project
  await packageCommit();
  // Push project
  await packagePush();
  // Update version of package.js
  await run(`npm --prefix ${projectDirectory} version ${type}`)();
  // Copy package.js
  await filesCopy([`${projectDirectory}/package.json`], output);
  // Publish to npm
  await run(`npm --prefix ${output} --access public publish ${output}`)();
};

(() => {
  task(`build`, () => packageBuild());
  task(`compile`, () => packageCompile());

  task(`clean`, () => packageClean());

  task(`publish:patch`, () => packagePublish("patch"));
  task(`publish:minor`, () => packagePublish("minor"));
  task(`publish:major`, () => packagePublish("major"));
  task(`publish`, series(`publish:patch`));
})();