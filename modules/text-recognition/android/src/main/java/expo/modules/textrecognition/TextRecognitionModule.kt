package expo.modules.textrecognition

import android.graphics.Rect
import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.korean.KoreanTextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * 사진에서 글자를 읽는다(ML Kit 한국어). 사진은 기기 밖으로 나가지 않는다.
 * 위치는 사진 크기에 대한 비율(0~1)이고 왼쪽 위가 (0, 0)이다.
 */
class TextRecognitionModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TextRecognition")

    AsyncFunction("recognize") { uri: String, promise: Promise ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val image = try {
        InputImage.fromFilePath(context, Uri.parse(uri))
      } catch (e: Exception) {
        promise.reject("ERR_TEXT_IMAGE", "Could not load the image", e)
        return@AsyncFunction
      }
      // 돌려 찍은 사진은 바로 세운 뒤의 크기가 기준이다.
      val sideways = image.rotationDegrees == 90 || image.rotationDegrees == 270
      val width = (if (sideways) image.height else image.width).toDouble()
      val height = (if (sideways) image.width else image.height).toDouble()

      fun entry(text: String, box: Rect?): MutableMap<String, Any> = mutableMapOf(
        "text" to text,
        "x" to (box?.left ?: 0) / width,
        "y" to (box?.top ?: 0) / height,
        "w" to (box?.width() ?: 0) / width,
        "h" to (box?.height() ?: 0) / height
      )

      val recognizer = TextRecognition.getClient(KoreanTextRecognizerOptions.Builder().build())
      recognizer.process(image)
        .addOnSuccessListener { result ->
          val lines = result.textBlocks.flatMap { it.lines }.map { line ->
            val item = entry(line.text, line.boundingBox)
            item["words"] = line.elements.map { entry(it.text, it.boundingBox) }
            item
          }
          promise.resolve(mapOf("width" to width, "height" to height, "lines" to lines))
        }
        .addOnFailureListener { e ->
          promise.reject("ERR_TEXT_RECOGNIZE", e.message ?: "Text recognition failed", e)
        }
        .addOnCompleteListener { recognizer.close() }
    }
  }
}
