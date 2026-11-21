import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const parts=await Promise.all(['core','levels','level-info','tutorial','browser'].map(name=>readFile(new URL(`dist/${name}.js`,root),'utf8')));
// These modules have only top-level imports/exports. TypeScript is compiled first.
const bundle=parts.map(s=>s.replace(/^import .*?;\s*$/gm,'').replace(/^export /gm,'')).join('\n');
const template=await readFile(new URL('index.template.html',root),'utf8');
if(bundle.includes('</script'))throw new Error('Unsafe inline script boundary');
await mkdir(new URL('dist/',root),{recursive:true});
await writeFile(new URL('dist/SS14-demo.html',root),template.replace('/* SS14_BUNDLE */',bundle));
console.log('Built dist/SS14-demo.html (self-contained, no network dependency).');
