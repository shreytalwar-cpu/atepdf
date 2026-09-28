// Neutral, synthetic study inputs. Run from the repository with existing packages:
// node tests/fixtures/usability/generate.mjs [--verify-only]
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import {PDFDocument, StandardFonts, rgb} from 'pdf-lib';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';

const files = {
  'brief.pdf': [
    {heading: 'Event Overview', sections: [
      ['Community Makers Morning', [
        'A fictional half-day gathering for people who enjoy simple craft projects.',
        'The event combines short demonstrations, shared work tables and a small',
        'display of finished projects. All activities use ordinary reusable materials.',
      ]],
      ['Purpose', [
        'Offer a relaxed place to try a new activity and exchange practical ideas.',
        'Participants may spend the morning on one project or move between tables.',
      ]],
      ['Format', [
        'The practice event takes place in a single community room.',
        'There are three activity areas: paper craft, simple model building and drawing.',
        'A quiet table is available for planning and individual work.',
      ]],
    ]},
    {heading: 'Venue and Materials', sections: [
      ['Room layout', [
        'Place the shared work tables in the centre of the room with wide walkways.',
        'Keep the demonstration table near the front and the display along one wall.',
        'A separate shelf holds reusable supplies and finished examples.',
      ]],
      ['Materials', [
        'Paper sheets and card offcuts',
        'Pencils, washable markers and rulers',
        'Reusable building pieces and small trays',
        'Table coverings and labelled storage boxes',
      ]],
      ['Room preparation', [
        'Arrange supplies by activity before the room opens.',
        'Keep walkways clear and leave space for seated participation at every table.',
        'At the end of the morning, return reusable materials to their labelled boxes.',
      ]],
    ]},
  ],
  'appendix.pdf': [
    {heading: 'Morning Schedule', sections: [
      ['Practice event timetable', [
        '09:30   Room opens and materials are available',
        '09:45   Welcome and activity introductions',
        '10:00   First demonstration and open work time',
        '10:45   Short break',
        '11:00   Second demonstration and open work time',
        '11:45   Informal project display',
        '12:00   Pack away materials and close the room',
      ]],
      ['Planning notes', [
        'The timetable is illustrative and may be adjusted for the practice event.',
        'People may work at their own pace during the open sessions.',
        'Leave the final quarter-hour free for arranging the display and tidying.',
      ]],
    ]},
  ],
};

for (const [name, pages] of Object.entries(files)) {
  const output = new URL(name, import.meta.url);
  if (!process.argv.includes('--verify-only')) {
    const pdf = await PDFDocument.create();
    const date = new Date('2026-09-29T00:00:00.000Z');
    pdf.setTitle(name === 'brief.pdf' ? 'Practice Event Brief' : 'Practice Event Schedule');
    pdf.setAuthor('Synthetic practice materials');
    pdf.setCreator('Neutral usability fixture generator');
    pdf.setProducer('pdf-lib 1.17.1');
    pdf.setCreationDate(date); pdf.setModificationDate(date);
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    pages.forEach((content, index) => {
      const page = pdf.addPage([595.28, 841.89]);
      const ink = rgb(0.16, 0.20, 0.25), muted = rgb(0.39, 0.43, 0.47);
      const draw = (text, y, size = 11, font = regular, color = ink) => {
        assert.ok(font.widthOfTextAtSize(text, size) <= 499, `Line too wide: ${text}`);
        page.drawText(text, {x: 48, y, size, font, color});
      };
      draw('COMMUNITY MAKERS MORNING', 792, 10, bold, muted);
      draw(content.heading, 746, 24, bold);
      page.drawLine({start: {x: 48, y: 724}, end: {x: 547, y: 724}, thickness: 1, color: rgb(0.82, 0.85, 0.87)});
      let y = 683;
      for (const [title, lines] of content.sections) {
        draw(title, y, 13, bold); y -= 26;
        for (const line of lines) { draw(line, y); y -= 19; }
        y -= 30;
      }
      assert.ok(y > 80, 'Content must stay above the footer');
      draw('Synthetic practice document. No real event or personal information.', 48, 9, regular, muted);
      page.drawText(String(index + 1), {x: 540, y: 48, size: 9, font: regular, color: muted});
    });
    await writeFile(output, await pdf.save());
  }
  const bytes = await readFile(output);
  const task = getDocument({data: Uint8Array.from(bytes), verbosity: 0, useSystemFonts: true});
  try {
    const pdf = await task.promise;
    assert.equal(pdf.numPages, pages.length);
    const headings = [];
    for (let index = 1; index <= pdf.numPages; index++) {
      const page = await pdf.getPage(index);
      const text = (await page.getTextContent()).items.map(item => 'str' in item ? item.str : '').join(' ');
      assert.ok(text.includes(pages[index - 1].heading));
      assert.ok(text.includes('Synthetic practice document.'));
      assert.ok(!/atepdf|canary|merge|undo|remove|save|export|originals? unchanged/i.test(text));
      assert.equal((await page.getAnnotations()).length, 0);
      headings.push(pages[index - 1].heading);
    }
    console.log(JSON.stringify({name, pageCount: pdf.numPages, headings, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), reader: 'PDF.js 6.3.289'}));
  } finally { await task.destroy(); }
}
