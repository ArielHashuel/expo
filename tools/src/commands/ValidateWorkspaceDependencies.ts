import { Command } from '@expo/commander';
import path from 'path';

import { getExpoRepositoryRootDir } from '../Directories';
import { getInfoAsync } from '../Workspace';

type ActionOptions = {
  workspace?: string;
};

export default (program: Command) => {
  program
    .command('validate-workspace-dependencies')
    .alias('vwd')
    .description('Verifies if all workspace packages are linked from monorepo.')
    .asyncAction(action);
};

async function action(options: ActionOptions) {
  const workspaces = await getWorkspacesAsync();
  const workspacesMismatched = Object.values(workspaces).filter(
    (workspace) => workspace.mismatchedWorkspaceDependencies.length
  );

  if (!workspacesMismatched.length) {
    console.log(`✅  Verified that all workspace packages are symlinked.`);
    return;
  }

  console.warn(
    workspacesMismatched.length === 1
      ? `⚠️  Found 1 workspace package installed from npm instead of this repository.`
      : `⚠️  Found ${workspacesMismatched.length} workspace packages installed from npm instead of this repository.`
  );

  for (const workspace of workspacesMismatched) {
    const mismatched = workspace.mismatchedWorkspaceDependencies;

    console.warn();
    console.warn(
      mismatched.length === 1
        ? `${workspace._name} has 1 workspace package that isn't symlinked:`
        : `${workspace._name} has ${mismatched.length} workspace packages that aren't symlinked:`
    );

    for (const dependency of mismatched) {
      const workspaceVersion = workspaces[dependency]._version;
      const installedVersion = await getResolvedVersionAsync(workspace._directory, dependency);

      console.warn(
        `- ${dependency}@${installedVersion} is installed, but workspace package is at ${workspaceVersion}`
      );
    }
  }

  process.exit(1);
}

async function getWorkspacesAsync() {
  const root = getExpoRepositoryRootDir();
  const workspaces = await getInfoAsync();

  return Object.fromEntries(
    Object.entries(workspaces).map(([_name, workspace]) => {
      const _directory = path.join(root, workspace.location);
      const _version = require(path.join(_directory, 'package.json')).version;

      return [_name, { _name, _version, _directory, ...workspace }];
    })
  );
}

async function getResolvedVersionAsync(directory: string, packageName: string) {
  const packageFile = require.resolve(`${packageName}/package.json`, { paths: [directory] });
  return require(packageFile).version;
}
