import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const parts=await Promise.all(['core','levels','level-info','tutorial','browser'].map(name=>readFile(new URL(`dist/${name}.js`,root),'utf8')));
// These modules have only top-level imports/exports. TypeScript is compiled first.
const bundle=parts.map(s=>s.replace(/^import .*?;\s*$/gm,'').replace(/^export /gm,'')).join('\n');
let template=await readFile(new URL('index.template.html',root),'utf8');
const {lessonIds,lessonPrompt}=await import('../dist/tutorial.js');
const escape=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const learned=new Set();
const lessons=lessonIds.map(id=>{const hint=lessonPrompt(learned);learned.add(id);return `<li data-lesson="${id}">${escape(hint)}</li>`;}).join('\n');
if(!template.includes('<!-- SS24_LESSONS -->'))throw new Error('Missing tutorial template marker');
template=template.replace('<!-- SS24_LESSONS -->',lessons);
if(bundle.includes('</script'))throw new Error('Unsafe inline script boundary');
if(template.split('/* SS24_BUNDLE */').length!==2)throw new Error('The standalone template must contain exactly one SS24 bundle marker.');
await mkdir(new URL('dist/',root),{recursive:true});
await writeFile(new URL('dist/SS24-demo.html',root),template.replace('/* SS24_BUNDLE */',bundle));
console.log('Built dist/SS24-demo.html (self-contained, no network dependency).');
