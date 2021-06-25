// @ts-check
const core = require('@actions/core');
const github = require('@actions/github');
const exec = require('@actions/exec');
const { readFileSync } = require('fs');
const semver = require('semver');

async function main() {
  try {
    const token = core.getInput('github-token', { required: true });
    const context = github.context;
    const octokit = github.getOctokit(token, {
      previews: ['ant-man-preview', 'flash-preview'],
    });

    const json = JSON.parse(readFileSync('package.json', 'utf8'));
    const version = 'v' + json.version;
    const minorVersion =
      'v' + semver.major(json.version) + '.' + semver.minor(json.version);
    const majorVersion = 'v' + semver.major(json.version);

    const tags = await octokit.repos.listTags({
      owner: context.repo.owner,
      repo: context.repo.repo,
    });

    if (tags.data.some((tag) => tag.name === version)) {
      console.log('Tag', version, 'already exists');
      return;
    }

    await exec.exec(
      'git config --global user.email "github-actions[bot]@users.noreply.github.com"'
    );
    await exec.exec('git config --global user.name "github-actions[bot]"');
    await exec.exec(
      'git remote set-url origin https://x-access-token:' +
        token +
        '@github.com/' +
        context.repo.owner +
        '/' +
        context.repo.repo +
        '.git'
    );

    await exec.exec('git', ['push', 'origin', ':refs/tags/' + version]);
    await exec.exec('git', ['tag', '-fa', version, '-m', version]);
    await exec.exec('git', ['push', 'origin', ':refs/tags/' + minorVersion]);
    await exec.exec('git', ['tag', '-f', minorVersion]);
    await exec.exec('git', ['push', 'origin', ':refs/tags/' + majorVersion]);
    await exec.exec('git', ['tag', '-f', majorVersion]);
    await exec.exec('git push --tags origin');

    await octokit.repos.createRelease({
      owner: context.repo.owner,
      repo: context.repo.repo,
      tag_name: version,
      name: version,
    });
  } catch (error) {
    core.error(error);
    core.setFailed(error.message);
  }
}

main();
