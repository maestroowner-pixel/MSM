import ExpoModulesCore
import PDFKit
import UIKit

// A page of a PDF drawn by PDFKit onto white, the long edge at most `maxEdge`
// pixels, saved as a JPEG in the caches folder. Pages are 1-based.
public class PdfPageModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PdfPage")

    AsyncFunction("pageCount") { (uri: String) -> Int in
      return try Self.open(uri).pageCount
    }

    AsyncFunction("render") { (uri: String, page: Int, maxEdge: Double) -> [String: Any] in
      let doc = try Self.open(uri)
      guard page >= 1, page <= doc.pageCount, let p = doc.page(at: page - 1) else {
        throw Exception(name: "ERR_PDF_PAGE", description: "No page \(page) in this PDF")
      }
      // The box a viewer shows (crop box), rotation included.
      let box = p.bounds(for: .cropBox)
      let turned = p.rotation % 180 != 0
      let w = turned ? box.height : box.width
      let h = turned ? box.width : box.height
      guard w > 0, h > 0 else { throw Exception(name: "ERR_PDF_PAGE", description: "Empty page") }
      let scale = maxEdge / Double(max(w, h))
      let size = CGSize(width: (Double(w) * scale).rounded(), height: (Double(h) * scale).rounded())
      let format = UIGraphicsImageRendererFormat()
      format.scale = 1
      format.opaque = true
      let image = UIGraphicsImageRenderer(size: size, format: format).image { ctx in
        UIColor.white.setFill()
        ctx.fill(CGRect(origin: .zero, size: size))
        let cg = ctx.cgContext
        cg.translateBy(x: 0, y: size.height)
        cg.scaleBy(x: size.width / w, y: -size.height / h)
        p.draw(with: .cropBox, to: cg)
      }
      guard let data = image.jpegData(compressionQuality: 0.8) else {
        throw Exception(name: "ERR_PDF_PAGE", description: "The page could not be saved")
      }
      let out = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("pdfpage-\(UUID().uuidString).jpg")
      try data.write(to: out)
      return ["uri": out.absoluteString, "width": Int(size.width), "height": Int(size.height)]
    }
  }

  private static func open(_ uri: String) throws -> PDFDocument {
    let url = URL(string: uri).flatMap { $0.scheme == nil ? nil : $0 } ?? URL(fileURLWithPath: uri)
    guard let doc = PDFDocument(url: url) else {
      throw Exception(name: "ERR_PDF_OPEN", description: "This PDF cannot be opened")
    }
    if doc.isLocked {
      throw Exception(name: "ERR_PDF_LOCKED", description: "This PDF is protected by a password")
    }
    return doc
  }
}
