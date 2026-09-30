package expo.modules.atepdf

import android.annotation.TargetApi
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.Build
import android.os.ParcelFileDescriptor
import android.system.Os
import android.system.OsConstants
import android.util.Base64
import expo.modules.kotlin.exception.CodedException
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.net.URI
import java.security.MessageDigest
import java.util.concurrent.atomic.AtomicLong
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sqrt

// Every message is fixed product text. Underlying parser/OS errors can contain private paths.
class AtepdfPdfFailure(message: String) : CodedException(message)

/** Platform reader independent of the shared pdf-lib writer; accepts app-owned copies only. */
class AtepdfPdfEngine(context: Context) {
  private val context = context.applicationContext
  private val generation = AtomicLong(0)
  private val workLock = Any()

  fun cancel() { generation.incrementAndGet() }

  @Suppress("UNUSED_PARAMETER")
  fun recognize(uri: String): List<Map<String, Any>> {
    fail("English OCR is not available on this Android build. No document was sent anywhere.")
  }

  @TargetApi(35)
  fun inspect(uri: String): Map<String, Any> = work {
    requireReader()
    withRenderer(uri) { renderer ->
      if (renderer.pdfFormType != PdfRenderer.PDF_FORM_TYPE_NONE) {
        fail("Forms cannot be changed safely by this Android build.")
      }
      val pages = ArrayList<Map<String, Any>>(renderer.pageCount)
      val physical = ArrayList<Map<String, Any>>(renderer.pageCount)
      for (index in 0 until renderer.pageCount) {
        checkCancelled(it)
        renderer.openPage(index).use { page ->
          val text = page.textContents.joinToString(" ") { content -> content.text }
            .replace(Regex("\\s+"), " ").trim()
          // A real display-list render catches errors that page counting cannot.
          val bitmap = render(page, 96)
          val pixels = IntArray(bitmap.width * bitmap.height)
          try { bitmap.getPixels(pixels, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height) }
          finally { bitmap.recycle() }
          val digest = MessageDigest.getInstance("SHA-256")
          for (pixel in pixels) for (shift in intArrayOf(24, 16, 8, 0)) digest.update((pixel shr shift).toByte())
          val identity = digest.digest().joinToString("") { byte -> "%02x".format(byte.toInt() and 255) }
          checkCancelled(it)
          // PdfRenderer does not expose /Rotate or CropBox. JS admission must first
          // reject rotated, cropped, offset and non-default UserUnit documents.
          pages.add(mapOf(
            "text" to text, "width" to page.width.toDouble(),
            "height" to page.height.toDouble(), "rotation" to 0
          ))
          val box = mapOf("x" to 0.0, "y" to 0.0, "width" to page.width.toDouble(), "height" to page.height.toDouble())
          physical.add(mapOf("mediaBox" to box, "cropBox" to box, "rotation" to 0, "identity" to identity))
        }
      }
      mapOf("pages" to pages, "structure" to mapOf("version" to 1, "reader" to "android-raster96-v1", "pages" to physical))
    }
  }

  fun renderPage(uri: String, page: Int, maxDimension: Int): Map<String, Any> = work { token ->
    requireReader()
    if (maxDimension !in 1..4096) fail("Choose a preview dimension between 1 and 4096 pixels.")
    withRenderer(uri) { renderer ->
      if (page !in 1..renderer.pageCount) fail("That page is not in this document.")
      renderer.openPage(page - 1).use { source ->
        checkCancelled(token)
        val bitmap = render(source, maxDimension)
        var output: File? = null
        try {
          checkCancelled(token)
          output = File.createTempFile("page-", ".png", previewDirectory())
          FileOutputStream(output).use { stream ->
            if (!bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)) fail("The local preview could not be created.")
            stream.fd.sync()
          }
          checkCancelled(token)
          mapOf("uri" to Uri.fromFile(output).toString(), "width" to bitmap.width, "height" to bitmap.height)
        } catch (error: Throwable) {
          output?.delete()
          throw error
        } finally {
          bitmap.recycle()
        }
      }
    }
  }

  fun reencodeJpeg(base64: String, width: Int, height: Int, quality: Double): String = work { token ->
    checkPixels(width, height)
    if (!quality.isFinite() || quality <= 0 || quality > 1) fail("Image quality must be greater than zero and no more than one.")
    val bytes = Base64.decode(base64, Base64.DEFAULT)
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
    checkPixels(bounds.outWidth, bounds.outHeight)
    if (bounds.outMimeType != "image/jpeg") fail("Only supported JPEG images can be compressed.")
    if (width > bounds.outWidth || height > bounds.outHeight) fail("Image compression cannot enlarge an image.")
    // Permit the shared writer's integer rounding without distorting the image.
    if (abs(width.toDouble() * bounds.outHeight - height.toDouble() * bounds.outWidth) >
      max(bounds.outWidth, bounds.outHeight).toDouble()) fail("Image compression must preserve its proportions.")
    checkCancelled(token)
    val original = BitmapFactory.decodeByteArray(bytes, 0, bytes.size,
      BitmapFactory.Options().apply { inPreferredConfig = Bitmap.Config.ARGB_8888; inScaled = false })
      ?: fail("The JPEG image could not be read on this device.")
    var scaled: Bitmap? = null
    try {
      checkCancelled(token)
      val image = Bitmap.createScaledBitmap(original, width, height, true)
      scaled = image
      val result = ByteArrayOutputStream().use { stream ->
        if (!image.compress(Bitmap.CompressFormat.JPEG, (quality * 100).roundToInt().coerceIn(1, 100), stream)) {
          fail("The JPEG image could not be compressed on this device.")
        }
        stream.toByteArray()
      }
      checkCancelled(token)
      Base64.encodeToString(result, Base64.NO_WRAP)
    } finally {
      if (scaled !== original) scaled?.recycle()
      original.recycle()
    }
  }

  fun removePreview(uri: String): Boolean = safe {
    val file = localFile(uri)
    if (file.parentFile != previewDirectory() || !file.name.startsWith("page-") || !file.name.endsWith(".png")) {
      fail("Only this app's temporary previews can be removed.")
    }
    file.delete()
  }

  private fun <T> work(body: (Long) -> T): T {
    val token = generation.get()
    return synchronized(workLock) {
      safe { checkCancelled(token); body(token).also { checkCancelled(token) } }
    }
  }

  private fun <T> safe(body: () -> T): T = try {
    body()
  } catch (error: AtepdfPdfFailure) {
    throw error
  } catch (_: OutOfMemoryError) {
    fail("This device could not allocate enough memory. The original is unchanged.")
  } catch (_: Exception) {
    fail("The local PDF operation failed. The original is unchanged.")
  }

  private fun checkCancelled(token: Long) {
    if (token != generation.get() || Thread.currentThread().isInterrupted) fail("Cancelled. No output was committed.")
  }

  private fun requireReader() {
    if (Build.VERSION.SDK_INT < 35) fail("Independent PDF validation needs Android 15 or later in this build.")
  }

  private fun localFile(uri: String): File {
    val parsed = URI(uri)
    if (parsed.scheme != "file" || !parsed.authority.isNullOrEmpty() || parsed.rawQuery != null || parsed.rawFragment != null) {
      fail("Choose a local file through the app's document picker.")
    }
    val file = File(parsed).canonicalFile
    val roots = listOf(context.filesDir.canonicalFile, context.cacheDir.canonicalFile)
    if (roots.none { file.path.startsWith(it.path + File.separator) } || !file.isFile || !file.canRead()) {
      fail("Choose a local file through the app's document picker.")
    }
    return file
  }

  private fun previewDirectory(): File {
    val root = context.cacheDir.canonicalFile
    val directory = File(root, "atepdf-previews")
    if ((!directory.isDirectory && !directory.mkdir()) || directory.canonicalFile.parentFile != root) {
      fail("The app's temporary preview folder is unavailable.")
    }
    return directory.canonicalFile
  }

  private fun <T> withRenderer(uri: String, body: (PdfRenderer) -> T): T {
    val file = localFile(uri)
    // Refuse a final-component symlink and open read-only. The renderer owns its descriptor.
    val descriptor = Os.open(file.path, OsConstants.O_RDONLY or OsConstants.O_NOFOLLOW, 0)
    val parcel = try { ParcelFileDescriptor.dup(descriptor) } finally { Os.close(descriptor) }
    val renderer = try { PdfRenderer(parcel) } catch (error: Throwable) { parcel.close(); throw error }
    renderer.use {
      if (it.pageCount !in 1..100) fail("Use 1–100 pages in this local job.")
      return body(it)
    }
  }

  private fun render(page: PdfRenderer.Page, maxDimension: Int): Bitmap {
    if (page.width <= 0 || page.height <= 0) fail("This page has invalid dimensions.")
    val scale = min(maxDimension.toDouble() / max(page.width, page.height),
      sqrt(12_000_000.0 / (page.width.toDouble() * page.height)))
    val width = max(1, floor(page.width * scale).toInt())
    val height = max(1, floor(page.height * scale).toInt())
    checkPixels(width, height)
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    try {
      bitmap.eraseColor(Color.WHITE)
      page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
      return bitmap
    } catch (error: Throwable) {
      bitmap.recycle()
      throw error
    }
  }

  private fun checkPixels(width: Int, height: Int) {
    if (width <= 0 || height <= 0 || width.toLong() * height.toLong() > 12_000_000L) {
      fail("This image exceeds this build's safe decoded-pixel workload.")
    }
  }

  private fun fail(message: String): Nothing = throw AtepdfPdfFailure(message)
}
