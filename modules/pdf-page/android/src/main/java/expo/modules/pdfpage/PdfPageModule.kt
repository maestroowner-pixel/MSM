package expo.modules.pdfpage

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import kotlin.math.max
import kotlin.math.roundToInt

// A page of a PDF drawn by PdfRenderer onto white, the long edge at most
// `maxEdge` pixels, saved as a JPEG in the cache folder. Pages are 1-based.
class PdfPageModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PdfPage")

    AsyncFunction("pageCount") { uri: String ->
      open(uri).use { it.renderer.pageCount }
    }

    AsyncFunction("render") { uri: String, page: Int, maxEdge: Double ->
      open(uri).use { o ->
        val r = o.renderer
        if (page < 1 || page > r.pageCount) throw CodedException("ERR_PDF_PAGE", "No page $page in this PDF", null)
        r.openPage(page - 1).use { p ->
          val scale = maxEdge / max(p.width, p.height)
          val w = max(1, (p.width * scale).roundToInt())
          val h = max(1, (p.height * scale).roundToInt())
          val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
          bmp.eraseColor(Color.WHITE)
          val m = Matrix().apply { setScale(w.toFloat() / p.width, h.toFloat() / p.height) }
          p.render(bmp, null, m, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
          val ctx = appContext.reactContext ?: throw CodedException("ERR_PDF_PAGE", "No context", null)
          val out = File(ctx.cacheDir, "pdfpage-${UUID.randomUUID()}.jpg")
          FileOutputStream(out).use { bmp.compress(Bitmap.CompressFormat.JPEG, 80, it) }
          bmp.recycle()
          mapOf("uri" to Uri.fromFile(out).toString(), "width" to w, "height" to h)
        }
      }
    }
  }

  private class Opened(val pfd: ParcelFileDescriptor, val renderer: PdfRenderer) : AutoCloseable {
    override fun close() {
      renderer.close()
      pfd.close()
    }
  }

  private fun open(uri: String): Opened {
    val ctx = appContext.reactContext ?: throw CodedException("ERR_PDF_OPEN", "No context", null)
    val parsed = Uri.parse(uri)
    val pfd = try {
      if (parsed.scheme == null || parsed.scheme == "file") {
        ParcelFileDescriptor.open(File(parsed.path ?: uri), ParcelFileDescriptor.MODE_READ_ONLY)
      } else {
        ctx.contentResolver.openFileDescriptor(parsed, "r")
      }
    } catch (e: Exception) {
      null
    } ?: throw CodedException("ERR_PDF_OPEN", "This PDF cannot be opened", null)
    return try {
      Opened(pfd, PdfRenderer(pfd))
    } catch (e: SecurityException) {
      pfd.close()
      throw CodedException("ERR_PDF_LOCKED", "This PDF is protected by a password", e)
    } catch (e: Exception) {
      pfd.close()
      throw CodedException("ERR_PDF_OPEN", "This PDF cannot be opened", e)
    }
  }
}
