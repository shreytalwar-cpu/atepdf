// Called only by the bounded child-process corpus test. No app engine is run.
import {readFile} from 'node:fs/promises';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';

const task=getDocument({data:new Uint8Array(await readFile(process.argv[2])),verbosity:0,stopAtErrors:true});
try {
  const document=await task.promise;
  if(document.numPages!==1)throw Error('Unexpected declared page count');
  try {
    await document.getPage(1);
    process.exitCode=1;
  } catch {
    process.stdout.write('missing-page-rejected\n');
  }
} finally {
  await task.destroy();
}
