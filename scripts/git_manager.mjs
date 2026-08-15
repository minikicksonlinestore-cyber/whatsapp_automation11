import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import fs from 'fs';
import path from 'path';

const dir = process.cwd();

async function getIgnoredFiles() {
  const gitignorePath = path.join(dir, '.gitignore');
  if (!fs.existsSync(gitignorePath)) return [];
  const content = fs.readFileSync(gitignorePath, 'utf8');
  return content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
}

async function isIgnored(relPath) {
  if (relPath.startsWith('.git') || relPath.startsWith('node_modules') || relPath.startsWith('.next')) {
    return true;
  }
  if (relPath === '.env' || relPath.startsWith('.env.') && relPath !== '.env.example') {
    return true;
  }
  return false;
}

async function getAllFiles(currentDir = dir, baseDir = dir) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

    if (await isIgnored(relPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      const nested = await getAllFiles(fullPath, baseDir);
      files = files.concat(nested);
    } else {
      files.push(relPath);
    }
  }
  return files;
}

export async function initAndCommit() {
  console.log('[Git] Checking git repository status in:', dir);
  if (!fs.existsSync(path.join(dir, '.git'))) {
    console.log('[Git] Initializing Git repository...');
    await git.init({ fs, dir, defaultBranch: 'main' });
  }

  const files = await getAllFiles();
  console.log(`[Git] Found ${files.length} project files to track (ignoring node_modules, .next, .env).`);

  for (const file of files) {
    await git.add({ fs, dir, filepath: file });
  }

  console.log('[Git] Staged all source files.');

  const sha = await git.commit({
    fs,
    dir,
    message: 'feat: initial commit for WhatsApp PDF Reminder Automation application',
    author: {
      name: 'AutoRemind Bot',
      email: 'bot@autoremind.local',
    },
  });

  console.log(`[Git] Created initial commit: ${sha}`);
  return { success: true, sha, totalFiles: files.length };
}

export async function pushToRemote(remoteUrl, token, username = 'git') {
  console.log(`[Git] Pushing to remote: ${remoteUrl}`);
  
  // Set or replace remote
  const remotes = await git.listRemotes({ fs, dir });
  const originExists = remotes.some(r => r.remote === 'origin');
  if (originExists) {
    await git.deleteRemote({ fs, dir, remote: 'origin' });
  }
  await git.addRemote({ fs, dir, remote: 'origin', url: remoteUrl });

  const pushResult = await git.push({
    fs,
    http,
    dir,
    remote: 'origin',
    ref: 'main',
    force: false,
    onAuth: () => ({
      username: username,
      password: token,
    }),
  });

  console.log('[Git] Push result:', pushResult);
  return pushResult;
}

if (process.argv[2] === 'commit') {
  initAndCommit()
    .then(r => console.log('Commit completed successfully:', r))
    .catch(err => console.error('Commit failed:', err));
}
