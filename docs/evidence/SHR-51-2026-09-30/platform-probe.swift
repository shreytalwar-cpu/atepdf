import Vision
import ImageIO
import UniformTypeIdentifiers
let r = VNRecognizeTextRequest()
r.recognitionLevel = .accurate
print("vision_accurate_revision:", r.revision)
print("vision_accurate_languages:", (try? r.supportedRecognitionLanguages()) ?? [])
r.recognitionLevel = .fast
print("vision_fast_languages:", (try? r.supportedRecognitionLanguages()) ?? [])
let src = (CGImageSourceCopyTypeIdentifiers() as! [String])
print("imageio_decode_types:", src.sorted())
let dst = (CGImageDestinationCopyTypeIdentifiers() as! [String])
print("imageio_encode_types:", dst.sorted())
