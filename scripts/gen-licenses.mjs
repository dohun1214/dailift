// 앱에 들어가는 직접 의존성의 라이선스 목록(src/data/licenses.json)을 만든다.
// 의존성을 바꾸면 다시 실행: node scripts/gen-licenses.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const mod = (name) => join(root, 'node_modules', name);
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
// 웹 빌드 전용이라 앱에 안 들어간다.
const skip = new Set(['react-dom', 'react-native-web']);

const MIT = `Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;
const APACHE = readFileSync(mod('typescript/LICENSE.txt'), 'utf8').replace(/\r\n/g, '\n');

const read = (dir, pattern) => {
  const file = readdirSync(dir).find((f) => pattern.test(f));
  return file ? readFileSync(join(dir, file), 'utf8').replace(/\r\n/g, '\n').trim() : null;
};
const authorOf = (meta) => {
  const a = typeof meta.author === 'string' ? meta.author : meta.author?.name;
  return a ? a.replace(/\s*[<(].*$/, '').trim() : null;
};

// 80자에서 강제로 끊긴 줄을 문단 단위로 잇는다(화면 폭에 맞게 다시 줄바꿈되도록).
// 빈 줄, 들여쓰기·번호·기호로 시작하는 줄, 구분선, 문단 첫머리의 제목(소문자 없는 짧은 줄)은 잇지 않는다.
const isRule = (line) => /^[-=_*\s]+$/.test(line);
const isTitle = (line) => !/[a-z]/.test(line) && line.length < 50;
const unwrap = (text) => {
  const out = [];
  let prevBreaks = true; // 앞 줄 뒤에서 끊어야 하는가
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    const startsParagraph = out.length === 0 || out.at(-1) === '';
    if (line && !prevBreaks && !/^[\s\d*\-•(]/.test(line) && !isRule(line)) {
      out[out.length - 1] = `${out.at(-1)} ${line}`;
    } else {
      out.push(line);
    }
    prevBreaks = !line || isRule(line) || (startsParagraph && isTitle(line));
  }
  return out.join('\n');
};

const list = Object.keys(pkg.dependencies)
  .filter((name) => !skip.has(name))
  .sort()
  .map((name) => {
    const dir = mod(name);
    const meta = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    const license =
      typeof meta.license === 'string' ? meta.license : (meta.license?.type ?? 'UNKNOWN');
    const repo = typeof meta.repository === 'string' ? meta.repository : meta.repository?.url;
    const url = (meta.homepage || repo || `https://www.npmjs.com/package/${name}`)
      .replace(/^git\+/, '')
      .replace(/\.git$/, '')
      .replace(/^git:\/\//, 'https://')
      .replace(/^github:/, 'https://github.com/');

    let text = read(dir, /^(licen[cs]e|copying)(\.md|\.txt)?$/i);
    if (!text) {
      const author = authorOf(meta);
      if (license === 'MIT') text = `MIT License\n\nCopyright (c) ${author}\n\n${MIT}`;
      else if (license === 'Apache-2.0') text = `Copyright ${author}\n\n${APACHE.trim()}`;
      else throw new Error(`${name}: 라이선스 전문이 없음 (${license})`);
    }
    const font = read(dir, /^license_font/i);
    if (font) text = `${text}\n\n${font}`;
    return { name, version: meta.version, license, url, text: unwrap(text) };
  });

writeFileSync(join(root, 'src/data/licenses.json'), `${JSON.stringify(list, null, 2)}\n`);
console.log(`${list.length} packages`);
