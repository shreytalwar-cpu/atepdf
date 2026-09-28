package expo.modules.atepdf

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Paint
import android.graphics.pdf.PdfDocument
import android.net.Uri
import android.util.Base64
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.SdkSuppress
import androidx.test.platform.app.InstrumentationRegistry
import java.io.ByteArrayOutputStream
import java.io.File
import java.security.MessageDigest
import org.junit.After
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

/** Device tests, not source-pattern checks. Requires an Android 15+ emulator/device. */
@RunWith(AndroidJUnit4::class)
@SdkSuppress(minSdkVersion = 35)
class AtepdfPdfEngineTest {
  private val instrumentation = InstrumentationRegistry.getInstrumentation()
  private val context = instrumentation.targetContext
  private val engine = AtepdfPdfEngine(context)
  private val inputs = mutableListOf<File>()
  private val previews = mutableListOf<String>()

  @After fun cleanOnlyTestArtifacts() {
    previews.forEach { runCatching { engine.removePreview(it) } }
    inputs.forEach { it.delete() }
  }

  @Test fun sharedBriefFixtureExtractsBothPagesAndKeepsOriginal() {
    val file = temporary("brief-")
    instrumentation.context.assets.open("brief.pdf").use { source ->
      file.outputStream().use { source.copyTo(it) }
    }
    val before = digest(file)
    val inspection = engine.inspect(uri(file))
    val pages = inspection["pages"] as List<*>
    assertEquals(2, pages.size)
    assertTrue((pages[0] as Map<*, *>)["text"].toString().contains("A1"))
    assertTrue((pages[1] as Map<*, *>)["text"].toString().contains("A2"))
    assertArrayEquals(before, digest(file))
  }

  @Test fun independentPlatformReaderRendersTextAndMarksWithoutMutatingPdf() {
    val file = syntheticDocument()
    val before = digest(file)
    val inspection = engine.inspect(uri(file))
    val page = (inspection["pages"] as List<*>)[0] as Map<*, *>
    assertEquals(600.0, page["width"])
    assertEquals(800.0, page["height"])
    assertEquals(0, page["rotation"])
    assertTrue(page["text"].toString().contains("SYNTHETIC"))

    val result = engine.renderPage(uri(file), 1, 800)
    val preview = result["uri"] as String
    previews.add(preview)
    val bitmap = BitmapFactory.decodeFile(File(java.net.URI(preview)).path)
    try {
      assertEquals(600, bitmap.width)
      assertEquals(800, bitmap.height)
      assertEquals(Color.BLACK, bitmap.getPixel(250, 250))
      assertEquals(Color.WHITE, bitmap.getPixel(500, 500))
    } finally { bitmap.recycle() }
    assertArrayEquals(before, digest(file))
  }

  @Test fun jpegCodecReturnsARealJpegWithRequestedGeometry() {
    val bitmap = Bitmap.createBitmap(128, 96, Bitmap.Config.ARGB_8888)
    val source = try {
      for (y in 0 until 96) for (x in 0 until 128) bitmap.setPixel(x, y,
        Color.rgb((x * 23 + y * 13) % 256, (x * 7 + y * 19) % 256, (x + y) % 256))
      ByteArrayOutputStream().use { stream ->
        assertTrue(bitmap.compress(Bitmap.CompressFormat.JPEG, 100, stream))
        stream.toByteArray()
      }
    } finally { bitmap.recycle() }
    val result = Base64.decode(engine.reencodeJpeg(Base64.encodeToString(source, Base64.NO_WRAP), 64, 48, .82), Base64.NO_WRAP)
    assertEquals(0xff, result[0].toInt() and 0xff)
    assertEquals(0xd8, result[1].toInt() and 0xff)
    val decoded = BitmapFactory.decodeByteArray(result, 0, result.size)
    try { assertEquals(64, decoded.width); assertEquals(48, decoded.height) }
    finally { decoded.recycle() }
    assertTrue(result.size < source.size)
    expectSafeFailure { engine.reencodeJpeg(Base64.encodeToString(source, Base64.NO_WRAP), 64, 64, .82) }
    expectSafeFailure { engine.reencodeJpeg(Base64.encodeToString(source, Base64.NO_WRAP), Int.MAX_VALUE, 2, .82) }
  }

  @Test fun remoteExternalAndCorruptInputsFailWithoutPrivateErrorData() {
    val secret = "PRIVATE_PATH_CANARY"
    listOf("https://example.invalid/$secret.pdf", "content://documents/$secret", "file:///sdcard/$secret.pdf",
      "file://remotehost/$secret.pdf", "file:///data/local/tmp/$secret.pdf").forEach { candidate ->
      expectSafeFailure(secret) { engine.inspect(candidate) }
    }
    val corrupt = temporary("$secret-")
    corrupt.writeText("Not a PDF: PRIVATE_CONTENT_CANARY")
    expectSafeFailure(secret) { engine.inspect(uri(corrupt)) }
    assertTrue(corrupt.exists())
  }

  @Test fun invalidPageAndOversizedRenderRequestsFailAndOriginalCannotBeDeleted() {
    val file = syntheticDocument()
    expectSafeFailure { engine.renderPage(uri(file), 0, 800) }
    expectSafeFailure { engine.renderPage(uri(file), 2, 800) }
    expectSafeFailure { engine.renderPage(uri(file), 1, Int.MAX_VALUE) }
    expectSafeFailure { engine.removePreview(uri(file)) }
    assertTrue(file.exists())
  }

  @Test fun pageWorkloadLimitRejectsOneHundredAndOnePages() {
    val file = syntheticDocument(pageCount = 101)
    expectSafeFailure { engine.inspect(uri(file)) }
    assertTrue(file.exists())
  }

  private fun syntheticDocument(pageCount: Int = 1): File {
    val file = temporary("generated-")
    val document = PdfDocument()
    try {
      for (n in 1..pageCount) {
        val page = document.startPage(PdfDocument.PageInfo.Builder(600, 800, n).create())
        val paint = Paint().apply { color = Color.BLACK; textSize = 24f }
        page.canvas.drawText("SYNTHETIC ATEPDF $n", 40f, 60f, paint)
        page.canvas.drawRect(200f, 200f, 300f, 300f, paint)
        document.finishPage(page)
      }
      file.outputStream().use { document.writeTo(it) }
    } finally { document.close() }
    return file
  }

  private fun temporary(prefix: String): File = File.createTempFile(prefix, ".pdf", context.cacheDir).also { inputs.add(it) }
  private fun uri(file: File): String = Uri.fromFile(file).toString()
  private fun digest(file: File): ByteArray = MessageDigest.getInstance("SHA-256").digest(file.readBytes())

  private fun expectSafeFailure(canary: String = "PRIVATE_CONTENT_CANARY", action: () -> Any?) {
    try { action(); fail("The unsafe request should fail") }
    catch (error: AtepdfPdfFailure) {
      assertFalse(error.message.orEmpty().contains(canary))
      assertNull(error.cause)
    }
  }
}
