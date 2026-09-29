"""Generate only SHR-45's new, synthetic PDF fixtures.

Run from the repository root with locally available reportlab, pypdf and Pillow:
    python3 tests/fixtures/corpus/generate.py [--output-dir DIRECTORY]

No product engine, provider, customer data, or network access is involved.
AES encryption intentionally uses fresh cryptographic randomness; other outputs
are byte-reproducible with the documented generator versions.
"""

from __future__ import annotations

import argparse
import io
from pathlib import Path

from PIL import Image, ImageDraw
from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    ArrayObject, BooleanObject, DictionaryObject, FloatObject, NameObject,
    NumberObject, TextStringObject,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
import reportlab


ROOT = Path(__file__).resolve().parents[3]
OUTPUT = Path(__file__).resolve().parent
# Synthetic test-only password. Do not submit it through the application chat.
TEST_USER_PASSWORD = "SHR45_fixture_user_only"
TEST_OWNER_PASSWORD = "SHR45_fixture_owner_only"


def raw_pdf(objects: list[bytes]) -> bytes:
    result = bytearray(b"%PDF-1.7\n%SHR45 synthetic fixture\n")
    offsets = [0]
    for index, body in enumerate(objects, start=1):
        offsets.append(len(result))
        result.extend(f"{index} 0 obj\n".encode())
        result.extend(body)
        result.extend(b"\nendobj\n")
    startxref = len(result)
    result.extend(f"xref\n0 {len(offsets)}\n0000000000 65535 f \n".encode())
    for offset in offsets[1:]:
        result.extend(f"{offset:010d} 00000 n \n".encode())
    result.extend(f"trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{startxref}\n%%EOF\n".encode())
    return bytes(result)


def stream(dictionary: bytes, data: bytes) -> bytes:
    return b"<< " + dictionary + f" /Length {len(data)} >>\nstream\n".encode() + data + b"\nendstream"


def tagged_pdf() -> bytes:
    # The marked-content MCID, StructElem, ParentTree, and page StructParents
    # actually connect. A bare /StructTreeRoot dictionary would be a fake tag.
    content = b"/P << /MCID 0 >> BDC\nBT /F1 20 Tf 40 140 Td (TAGGED-1) Tj ET\nEMC\n"
    return raw_pdf([
        b"<< /Type /Catalog /Pages 2 0 R /MarkInfo << /Marked true >> /StructTreeRoot 6 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /StructParents 0 /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        stream(b"", content),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Type /StructTreeRoot /K [7 0 R] /ParentTree 8 0 R /ParentTreeNextKey 1 >>",
        b"<< /Type /StructElem /S /P /P 6 0 R /Pg 3 0 R /K 0 >>",
        b"<< /Nums [0 [7 0 R]] >>",
    ])


def image_dimension_mismatch_pdf() -> bytes:
    image = Image.new("RGB", (32, 24))
    for y in range(24):
        for x in range(32):
            image.putpixel((x, y), (x * 7, y * 10, 80))
    encoded = io.BytesIO()
    image.save(encoded, format="JPEG", quality=85, subsampling=0)
    content = b"q 160 0 0 120 40 40 cm /Im1 Do Q\nBT /F1 14 Tf 40 180 Td (MISMATCH-1) Tj ET\n"
    return raw_pdf([
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 260 220] /Resources << /Font << /F1 6 0 R >> /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>",
        stream(b"", content),
        # The XObject declares 40x24, while the JPEG SOF encodes 32x24.
        stream(b"/Type /XObject /Subtype /Image /Width 40 /Height 24 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode", encoded.getvalue()),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ])


def boundary_pdf(count: int) -> bytes:
    font_id = count + 3
    kids = b" ".join(f"{3 + n} 0 R".encode() for n in range(count))
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [" + kids + f"] /Count {count} >>".encode(),
    ]
    for n in range(count):
        objects.append(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 {font_id} 0 R >> >> /Contents {font_id + 1 + n} 0 R >>".encode()
        )
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    for n in range(count):
        marker = f"BOUNDARY-{n + 1:03d}".encode()
        objects.append(stream(b"", b"BT /F1 16 Tf 40 100 Td (" + marker + b") Tj ET\n"))
    return raw_pdf(objects)


def damaged_missing_page_pdf() -> bytes:
    # A finite, intentionally invalid page tree; no bombs, huge streams, or loops.
    return raw_pdf([
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [99 0 R] /Count 1 >>",
    ])


def reportlab_base(draw) -> bytes:
    output = io.BytesIO()
    pdf = canvas.Canvas(output, pagesize=(595.28, 841.89), invariant=1, pageCompression=0)
    pdf.setTitle("SHR-45 synthetic PDF corpus")
    pdf.setAuthor("atePDF synthetic test fixtures")
    draw(pdf)
    pdf.save()
    return output.getvalue()


def geometry_font_pdf() -> bytes:
    font_path = Path(reportlab.__file__).parent / "fonts" / "Vera.ttf"
    pdfmetrics.registerFont(TTFont("SHR45Vera", str(font_path)))

    def draw(pdf):
        pdf.setFont("SHR45Vera", 20)
        pdf.drawString(60, 740, "GEOMETRY-1 embedded Vera + raster")
        image = ImageReader(io.BytesIO((ROOT / "tests/fixtures/image-input.png").read_bytes()))
        pdf.drawImage(image, 60, 430, width=140, height=200)
        pdf.showPage()
        pdf.setPageSize((792, 612))
        pdf.setFont("SHR45Vera", 20)
        pdf.drawString(80, 500, "GEOMETRY-2 landscape Letter")
        pdf.showPage()
        pdf.setPageSize((600, 800))
        pdf.setFont("SHR45Vera", 20)
        pdf.drawString(80, 650, "GEOMETRY-3 offset crop")
        pdf.showPage()

    writer = PdfWriter(clone_from=PdfReader(io.BytesIO(reportlab_base(draw))))
    writer.pages[1].rotate(90)
    writer.pages[2].mediabox.lower_left = (20, 30)
    writer.pages[2].mediabox.upper_right = (620, 830)
    writer.pages[2].cropbox.lower_left = (40, 50)
    writer.pages[2].cropbox.upper_right = (600, 780)
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


def interactive_pdf() -> bytes:
    def draw(pdf):
        pdf.setFont("Helvetica", 16)
        pdf.drawString(60, 740, "INTERACTIVE-1 links, forms, notes")
        pdf.drawString(60, 690, "Visit synthetic example")
        pdf.linkURL("https://example.invalid/shr45", (55, 682, 265, 710), relative=0)
        pdf.drawString(60, 640, "Go to section two")
        pdf.linkRect("internal destination", "second", (55, 632, 245, 660), relative=0)
        pdf.bookmarkPage("first")
        pdf.addOutlineEntry("Synthetic guide", "first", level=0)
        pdf.acroForm.textfield(name="synthetic_name", tooltip="Synthetic name", x=60, y=540, width=220, height=24, value="Example", forceBorder=True)
        pdf.acroForm.checkbox(name="synthetic_check", tooltip="Synthetic check", x=60, y=500, size=20, checked=True, forceBorder=True)
        pdf.showPage()
        pdf.setFont("Helvetica", 16)
        pdf.drawString(60, 740, "INTERACTIVE-2 internal target")
        pdf.bookmarkPage("second")
        pdf.addOutlineEntry("Second section", "second", level=1)
        pdf.showPage()

    writer = PdfWriter(clone_from=PdfReader(io.BytesIO(reportlab_base(draw))))
    annotations = writer.pages[0]["/Annots"].get_object()
    assert len(annotations) >= 4, "URI, GoTo, text field and checkbox must exist"
    highlight = DictionaryObject({
        NameObject("/Type"): NameObject("/Annot"),
        NameObject("/Subtype"): NameObject("/Highlight"),
        NameObject("/Rect"): ArrayObject([FloatObject(55), FloatObject(730), FloatObject(355), FloatObject(762)]),
        NameObject("/QuadPoints"): ArrayObject([FloatObject(v) for v in (55, 762, 355, 762, 55, 730, 355, 730)]),
        NameObject("/Contents"): TextStringObject("Synthetic highlight"),
        NameObject("/C"): ArrayObject([FloatObject(1), FloatObject(1), FloatObject(0)]),
        NameObject("/CA"): FloatObject(0.35),
        NameObject("/F"): NumberObject(4),
    })
    note = DictionaryObject({
        NameObject("/Type"): NameObject("/Annot"),
        NameObject("/Subtype"): NameObject("/Text"),
        NameObject("/Rect"): ArrayObject([FloatObject(v) for v in (360, 720, 385, 745)]),
        NameObject("/Contents"): TextStringObject("Synthetic note"),
        NameObject("/Open"): BooleanObject(False),
    })
    annotations.extend([writer._add_object(highlight), writer._add_object(note)])
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


def blank_noisy_scan_pdf() -> bytes:
    def draw(pdf):
        blank = Image.new("RGB", (400, 550), "white")
        blank.putpixel((201, 301), (246, 246, 246))
        noisy = Image.new("RGB", (400, 550), (245, 245, 245))
        painter = ImageDraw.Draw(noisy)
        painter.text((70, 260), "SCAN-NOISE-2", fill=(25, 25, 25))
        for index in range(180):
            x = (index * 173) % 400
            y = (index * 251) % 550
            noisy.putpixel((x, y), (95, 95, 95))
        for image in (blank, noisy):
            pdf.drawImage(ImageReader(image), 0, 0, width=595.28, height=841.89)
            pdf.showPage()

    return reportlab_base(draw)


def encrypted_pdf() -> bytes:
    def draw(pdf):
        pdf.setFont("Helvetica", 18)
        pdf.drawString(55, 730, "ENCRYPTED-1 synthetic test only")
        pdf.showPage()

    writer = PdfWriter()
    for page in PdfReader(io.BytesIO(reportlab_base(draw))).pages:
        writer.add_page(page)
    writer.add_metadata({"/Title": "SHR-45 synthetic encrypted fixture"})
    writer.encrypt(TEST_USER_PASSWORD, TEST_OWNER_PASSWORD, algorithm="AES-256")
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, default=OUTPUT)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    fixtures = {
        "geometry-font.pdf": geometry_font_pdf(),
        "interactive.pdf": interactive_pdf(),
        "tagged.pdf": tagged_pdf(),
        "blank-noisy-scan.pdf": blank_noisy_scan_pdf(),
        "encoded-dimension-mismatch.pdf": image_dimension_mismatch_pdf(),
        "encrypted.pdf": encrypted_pdf(),
        "boundary-100.pdf": boundary_pdf(100),
        "boundary-101.pdf": boundary_pdf(101),
        "damaged-missing-page.pdf": damaged_missing_page_pdf(),
    }
    for name, data in fixtures.items():
        path = args.output_dir / name
        path.write_bytes(data)
        print(f"{name}: {len(data)} bytes")


if __name__ == "__main__":
    main()
