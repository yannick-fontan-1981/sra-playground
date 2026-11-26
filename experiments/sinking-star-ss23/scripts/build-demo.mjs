import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const parts=await Promise.all(['core','levels','level-info','tutorial','browser'].map(name=>readFile(new URL(`dist/${name}.js`,root),'utf8')));
// These modules have only top-level imports/exports. TypeScript is compiled first.
const bundle=parts.map(s=>s.replace(/^import .*?;\s*$/gm,'').replace(/^export /gm,'')).join('\n');
const template=await readFile(new URL('index.template.html',root),'utf8');
if(bundle.includes('</script'))throw new Error('Unsafe inline script boundary');
if(template.split('/* SS23_BUNDLE */').length!==2)throw new Error('The standalone template must contain exactly one SS23 bundle marker.');
await mkdir(new URL('dist/',root),{recursive:true});
await writeFile(new URL('dist/SS23-demo.html',root),template.replace('/* SS23_BUNDLE */',bundle));
console.log('Built dist/SS23-demo.html (self-contained, no network dependency).');
