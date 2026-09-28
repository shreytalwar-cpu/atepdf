package expo.modules.atepdf

import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AtepdfPdfModule : Module() {
  private val localEngine = lazy {
    AtepdfPdfEngine(requireNotNull(appContext.reactContext) { "The local PDF engine is unavailable." })
  }
  private val engine get() = localEngine.value

  override fun definition() = ModuleDefinition {
    Name("AtepdfPdf")
    Constants(
      "readerAvailable" to (Build.VERSION.SDK_INT >= 35),
      "ocrAvailable" to false
    )

    AsyncFunction("inspectAsync") { uri: String -> engine.inspect(uri) }
    AsyncFunction("renderPageAsync") { uri: String, page: Int, maxDimension: Int ->
      engine.renderPage(uri, page, maxDimension)
    }
    AsyncFunction("reencodeJpegAsync") { base64: String, width: Int, height: Int, quality: Double ->
      engine.reencodeJpeg(base64, width, height, quality)
    }
    AsyncFunction("recognizeAsync") { uri: String -> engine.recognize(uri) }

    // Synchronous and constant-time so cancellation is not queued behind native work.
    Function("cancelAsync") { engine.cancel(); true }
    AsyncFunction("removePreviewAsync") { uri: String -> engine.removePreview(uri) }
    OnDestroy { if (localEngine.isInitialized()) localEngine.value.cancel() }
  }
}
