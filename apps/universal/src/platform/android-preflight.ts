import {PDFDocument,PDFName,PDFNumber} from 'pdf-lib';

const geometryError='This Android reader currently supports unrotated pages with a full, origin-aligned page box and default page units. Your original is unchanged.';

/** Admit geometry within the platform reader's scope (which reports dimensions to integer points). */
export function assertAndroidGeometry(document:PDFDocument):void {
  try {
    for(const page of document.getPages()) {
      const crop=page.getCropBox(),media=page.getMediaBox();
      const rawUnit=page.node.getInheritableAttribute(PDFName.of('UserUnit'));
      const unit=rawUnit===undefined?undefined:document.context.lookup(rawUnit);
      if(unit!==undefined&&(!(unit instanceof PDFNumber)||unit.asNumber()!==1))throw new Error();
      if(page.getRotation().angle!==0||crop.x!==0||crop.y!==0||media.x!==0||media.y!==0||
        crop.width!==media.width||crop.height!==media.height||
        !Number.isFinite(media.width)||!Number.isFinite(media.height)||media.width<=0||media.height<=0)throw new Error();
    }
  } catch {
    // Malformed PDF dictionary errors may contain private object values. Keep the boundary fixed.
    throw new Error(geometryError);
  }
}
