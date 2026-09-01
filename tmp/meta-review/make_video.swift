import AVFoundation
import CoreGraphics
import CoreVideo
import Foundation
import ImageIO

let root = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let output = root.appendingPathComponent("recepia-meta-review.m4v")
try? FileManager.default.removeItem(at: output)

let width = 1280
let height = 720
let fps: Int32 = 30
let secondsPerFrame = 5
let imageNames = ["frame-01.png", "frame-02.png", "frame-03.png", "frame-04.png"]

let writer = try AVAssetWriter(outputURL: output, fileType: .m4v)
let input = AVAssetWriterInput(
    mediaType: .video,
    outputSettings: [
        AVVideoCodecKey: AVVideoCodecType.h264,
        AVVideoWidthKey: width,
        AVVideoHeightKey: height,
    ]
)
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(
    assetWriterInput: input,
    sourcePixelBufferAttributes: [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        kCVPixelBufferWidthKey as String: width,
        kCVPixelBufferHeightKey as String: height,
    ]
)
guard writer.canAdd(input) else { fatalError("Cannot add video input") }
writer.add(input)
guard writer.startWriting() else { fatalError(writer.error?.localizedDescription ?? "Cannot start writer") }
writer.startSession(atSourceTime: .zero)

func loadImage(_ url: URL) -> CGImage {
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        fatalError("Cannot load \(url.path)")
    }
    return image
}

func makeBuffer(_ image: CGImage) -> CVPixelBuffer {
    var buffer: CVPixelBuffer?
    let result = CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &buffer)
    guard result == kCVReturnSuccess, let buffer else { fatalError("Cannot create pixel buffer") }
    CVPixelBufferLockBaseAddress(buffer, [])
    defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
    guard let context = CGContext(
        data: CVPixelBufferGetBaseAddress(buffer),
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGBitmapInfo.byteOrder32Little.rawValue | CGImageAlphaInfo.premultipliedFirst.rawValue
    ) else { fatalError("Cannot create context") }
    context.setFillColor(CGColor(gray: 1, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    return buffer
}

var frameNumber: Int64 = 0
for name in imageNames {
    let image = loadImage(root.appendingPathComponent(name))
    for _ in 0..<(secondsPerFrame * Int(fps)) {
        while !input.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.01) }
        let time = CMTime(value: frameNumber, timescale: fps)
        guard adaptor.append(makeBuffer(image), withPresentationTime: time) else {
            fatalError(writer.error?.localizedDescription ?? "Cannot append frame")
        }
        frameNumber += 1
    }
}

input.markAsFinished()
let semaphore = DispatchSemaphore(value: 0)
writer.finishWriting { semaphore.signal() }
semaphore.wait()
guard writer.status == .completed else {
    fatalError(writer.error?.localizedDescription ?? "Video export failed")
}
print(output.path)
