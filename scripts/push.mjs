import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import fs from 'fs';
import path from 'path';

const dir = process.cwd();
const remoteUrl = process.argv[2] || 'https://github.com/minikicksonlinestore-cyber/whatsapp_automation11.git';
const token = process.argv[3] || '';

async function run() {
  console.log(`[Git] Setting remote origin to: ${remoteUrl}`);
  const remotes = await git.listRemotes({ fs, dir });
  const originExists = remotes.some(r => r.remote === 'origin');
  if (originExists) {
    await git.deleteRemote({ fs, dir, remote: 'origin' });
  }
  await git.addRemote({ fs, dir, remote: 'origin', url: remoteUrl });

  console.log('[Git] Pushing to main branch...');
  try {
    const pushResult = await git.push({
      fs,
      http,
      dir,
      remote: 'origin',
      ref: 'main',
      force: true,
      onAuth: () => ({
        username: 'minikicksonlinestore-cyber',
        password: token,
      }),
    });

    console.log('[Git] Push result:', pushResult);
    if (pushResult.ok) {
      console.log('[Git] Successfully pushed all code to GitHub repository!');
    }
  } catch (err) {
    console.error('[Git] Push error:', err.message);
  }
}

run();
