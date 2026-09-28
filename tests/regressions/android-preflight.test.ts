import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PDFDocument,PDFName,PDFNumber,PDFString,degrees} from 'pdf-lib';
import {assertAndroidGeometry} from '../../apps/universal/src/platform/android-preflight';

const userUnit=PDFName.of('UserUnit');
async function document(){const doc=await PDFDocument.create();doc.addPage([612,792]);return doc;}
async function reopened(doc:PDFDocument){return PDFDocument.load(await doc.save());}

test('Android admission accepts the shared brief fixture and does not rewrite page dictionaries',async()=>{
  const bytes=await readFile('apps/universal/public/fixtures/brief.pdf'),doc=await PDFDocument.load(bytes);
  const before=doc.getPages().map(page=>page.node.toString());assert.doesNotThrow(()=>assertAndroidGeometry(doc));
  assert.deepEqual(doc.getPages().map(page=>page.node.toString()),before);
  const explicitDefault=await document();explicitDefault.getPage(0).node.set(userUnit,PDFNumber.of(1));
  assert.doesNotThrow(()=>assertAndroidGeometry(explicitDefault));
  const fractional=await document();fractional.getPage(0).setSize(612.25,792);
  assert.doesNotThrow(()=>assertAndroidGeometry(fractional));
});

test('Android admission rejects direct, indirect, inherited and malformed non-default UserUnit',async()=>{
  for(const value of [2,.5,0,-1]){
    const direct=await document();direct.getPage(0).node.set(userUnit,PDFNumber.of(value));
    assert.throws(()=>assertAndroidGeometry(direct),/default page units/);
    const indirect=await document();indirect.getPage(0).node.set(userUnit,indirect.context.register(PDFNumber.of(value)));
    assert.throws(()=>assertAndroidGeometry(indirect),/default page units/);
  }
  const inherited=await document();inherited.getPage(0).node.Parent()!.set(userUnit,PDFNumber.of(2));
  assert.throws(()=>assertAndroidGeometry(inherited),/default page units/);
  const malformed=await document();malformed.getPage(0).node.set(userUnit,PDFString.of('PRIVATE_DOCUMENT_CANARY'));
  const saved=await reopened(malformed);
  assert.throws(()=>assertAndroidGeometry(saved),error=>error instanceof Error&&/default page units/.test(error.message)&&!error.message.includes('PRIVATE_DOCUMENT_CANARY'));
});

test('Android admission rejects geometry the independent reader cannot report faithfully',async()=>{
  for(const rotation of [90,180,270,360,-90]){
    const rotated=await document();rotated.getPage(0).setRotation(degrees(rotation));
    assert.throws(()=>assertAndroidGeometry(rotated),/unrotated pages/);
  }
  const cropped=await document();cropped.getPage(0).setCropBox(0,0,600,790);
  assert.throws(()=>assertAndroidGeometry(cropped),/full, origin-aligned/);
  const offset=await document();offset.getPage(0).setMediaBox(5,5,612,792);offset.getPage(0).setCropBox(5,5,612,792);
  assert.throws(()=>assertAndroidGeometry(offset),/origin-aligned/);
  const zeroWidth=await document();zeroWidth.getPage(0).setMediaBox(0,0,0,792);
  assert.throws(()=>assertAndroidGeometry(zeroWidth),/page box/);
  const inheritedRotation=await document();inheritedRotation.getPage(0).node.Parent()!.set(PDFName.Rotate,PDFNumber.of(90));
  assert.throws(()=>assertAndroidGeometry(inheritedRotation),/unrotated pages/);
});
