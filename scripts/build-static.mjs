// 정적 웹 빌드: 서버 기능이 필요한 폴더(api, pay, report)를 뺀 사본을 만들어 내보낸다.
// 결과는 out 폴더에 생기며, 깃허브 무료 주소에 그대로 올릴 수 있다.
// 사용법: BASE_PATH=/saju-hanjang SITE_URL=https://계정.github.io/saju-hanjang node scripts/build-static.mjs
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const work = path.join(root, '.static-build');
const out = path.join(root, 'out');
const basePath = process.env.BASE_PATH || '';
const siteUrl = process.env.SITE_URL || 'http://localhost:3000';

rmSync(work, { recursive: true, force: true });
rmSync(out, { recursive: true, force: true });
mkdirSync(work);

// 필요한 것만 사본으로 옮긴다.
for (const name of ['src', 'public', 'package.json', 'tsconfig.json', 'next.config.mjs']) {
  cpSync(path.join(root, name), path.join(work, name), { recursive: true });
}
symlinkSync(path.join(root, 'node_modules'), path.join(work, 'node_modules'), 'dir');

// 서버가 있어야 하는 화면과 기능은 정적 배포에서 뺀다.
for (const dir of ['src/app/api', 'src/app/pay', 'src/app/report']) {
  rmSync(path.join(work, dir), { recursive: true, force: true });
}

execFileSync('npx', ['next', 'build'], {
  cwd: work,
  stdio: 'inherit',
  env: {
    ...process.env,
    STATIC_EXPORT: '1',
    NEXT_PUBLIC_STATIC: '1',
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_SITE_URL: siteUrl,
  },
});

cpSync(path.join(work, 'out'), out, { recursive: true });

// 홈 화면 추가용 정보(manifest)의 주소에 앞머리를 붙인다.
const manifestPath = path.join(out, 'manifest.webmanifest');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.start_url = `${basePath}/`;
manifest.scope = `${basePath}/`;
manifest.icons = manifest.icons.map((i) => ({ ...i, src: `${basePath}${i.src}` }));
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

// 깃허브 페이지가 밑줄로 시작하는 폴더(_next)를 그대로 올리도록 표시한다.
writeFileSync(path.join(out, '.nojekyll'), '');

rmSync(work, { recursive: true, force: true });
if (!existsSync(path.join(out, 'index.html'))) throw new Error('정적 빌드 결과에 index.html 이 없습니다.');
console.log(`정적 웹 빌드 완료: ${out}`);
