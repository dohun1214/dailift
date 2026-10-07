import ExpoModulesCore
import UIKit
import Vision

internal final class TextImageNotFoundException: Exception {
  override var reason: String {
    "Could not load the image"
  }
}

/// 사진에서 글자를 읽는다(Vision). 사진은 기기 밖으로 나가지 않는다.
/// 위치는 사진 크기에 대한 비율(0~1)이고 왼쪽 위가 (0, 0)이다.
public class TextRecognitionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TextRecognition")

    AsyncFunction("recognize") { (uri: String) -> [String: Any] in
      guard let image = TextRecognitionModule.loadImage(uri), let cgImage = image.cgImage else {
        throw TextImageNotFoundException()
      }

      let request = VNRecognizeTextRequest()
      request.recognitionLevel = .accurate
      request.recognitionLanguages = ["ko-KR", "en-US"]
      request.usesLanguageCorrection = true

      let handler = VNImageRequestHandler(
        cgImage: cgImage,
        orientation: TextRecognitionModule.orientation(image.imageOrientation),
        options: [:]
      )
      try handler.perform([request])

      var lines: [[String: Any]] = []
      for observation in request.results ?? [] {
        guard let candidate = observation.topCandidates(1).first else {
          continue
        }
        let text = candidate.string
        let lineBox = observation.boundingBox
        var words: [[String: Any]] = []

        var index = text.startIndex
        while index < text.endIndex {
          while index < text.endIndex && text[index].isWhitespace {
            index = text.index(after: index)
          }
          if index >= text.endIndex {
            break
          }
          var end = index
          while end < text.endIndex && !text[end].isWhitespace {
            end = text.index(after: end)
          }
          let range = index..<end
          var wordBox = lineBox
          if let box = try? candidate.boundingBox(for: range) {
            wordBox = box.boundingBox
          }
          words.append(TextRecognitionModule.entry(String(text[range]), wordBox))
          index = end
        }

        var line = TextRecognitionModule.entry(text, lineBox)
        line["words"] = words
        lines.append(line)
      }

      let sideways = [UIImage.Orientation.left, .right, .leftMirrored, .rightMirrored]
        .contains(image.imageOrientation)
      return [
        "width": sideways ? cgImage.height : cgImage.width,
        "height": sideways ? cgImage.width : cgImage.height,
        "lines": lines
      ]
    }
  }

  private static func loadImage(_ uri: String) -> UIImage? {
    if let url = URL(string: uri), url.isFileURL {
      return UIImage(contentsOfFile: url.path)
    }
    return UIImage(contentsOfFile: uri)
  }

  /// Vision의 상자는 왼쪽 아래가 원점이라 위아래를 뒤집는다.
  private static func entry(_ text: String, _ box: CGRect) -> [String: Any] {
    return [
      "text": text,
      "x": Double(box.origin.x),
      "y": Double(1 - box.origin.y - box.size.height),
      "w": Double(box.size.width),
      "h": Double(box.size.height)
    ]
  }

  private static func orientation(_ value: UIImage.Orientation) -> CGImagePropertyOrientation {
    switch value {
    case .up: return .up
    case .down: return .down
    case .left: return .left
    case .right: return .right
    case .upMirrored: return .upMirrored
    case .downMirrored: return .downMirrored
    case .leftMirrored: return .leftMirrored
    case .rightMirrored: return .rightMirrored
    @unknown default: return .up
    }
  }
}
