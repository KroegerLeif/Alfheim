package attachments

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"image"
	"image/draw"
	"image/jpeg"
	"image/png"
	"io"

	xdraw "golang.org/x/image/draw"
	_ "golang.org/x/image/webp" // registers the WebP decoder with image.Decode
)

const (
	// MaxImageEdge is the longest edge, in pixels, a stored attachment may have.
	MaxImageEdge = 2048
	// MaxImagePixels bounds the decoded size (width x height) so a small, highly
	// compressed file cannot exhaust memory (about 160 MB as NRGBA at the limit).
	MaxImagePixels = 40_000_000

	jpegQuality = 85
)

// normalizeImage decodes an uploaded JPEG, PNG or WebP, applies its EXIF
// orientation, downscales it to MaxImageEdge and re-encodes it without any
// metadata. Opaque images become JPEG, images with transparency become PNG, so
// alpha is kept. It is pure Go, so the chat binary stays CGO-free.
func normalizeImage(data []byte) ([]byte, string, error) {
	cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return nil, "", fmt.Errorf("%w: %v", ErrInvalidImage, err)
	}
	if cfg.Width <= 0 || cfg.Height <= 0 || int64(cfg.Width)*int64(cfg.Height) > MaxImagePixels {
		return nil, "", fmt.Errorf("%w: dimensions %dx%d exceed the allowed pixel count", ErrInvalidImage, cfg.Width, cfg.Height)
	}

	src, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, "", fmt.Errorf("%w: %v", ErrInvalidImage, err)
	}

	img := src
	if w, h := cfg.Width, cfg.Height; w > MaxImageEdge || h > MaxImageEdge {
		nw, nh := scaledSize(w, h, MaxImageEdge)
		dst := image.NewNRGBA(image.Rect(0, 0, nw, nh))
		xdraw.CatmullRom.Scale(dst, dst.Bounds(), src, src.Bounds(), xdraw.Src, nil)
		img = dst
	}
	img = applyOrientation(img, exifOrientation(data))

	var out bytes.Buffer
	if isOpaque(img) {
		// jpeg.Encode writes no EXIF, ICC or comment segments.
		if err := jpeg.Encode(&out, img, &jpeg.Options{Quality: jpegQuality}); err != nil {
			return nil, "", fmt.Errorf("encode jpeg: %w", err)
		}
		return out.Bytes(), "image/jpeg", nil
	}
	if err := (&png.Encoder{CompressionLevel: png.BestCompression}).Encode(&out, img); err != nil {
		return nil, "", fmt.Errorf("encode png: %w", err)
	}
	return out.Bytes(), "image/png", nil
}

func scaledSize(w, h, maxEdge int) (int, int) {
	if w >= h {
		return maxEdge, max(1, h*maxEdge/w)
	}
	return max(1, w*maxEdge/h), maxEdge
}

func isOpaque(img image.Image) bool {
	if o, ok := img.(interface{ Opaque() bool }); ok {
		return o.Opaque()
	}
	return false
}

// applyOrientation returns img rotated or flipped so that it displays upright
// for the given EXIF orientation (1 to 8; anything else leaves it unchanged).
func applyOrientation(img image.Image, orientation int) image.Image {
	if orientation < 2 || orientation > 8 {
		return img
	}
	b := img.Bounds()
	w, h := b.Dx(), b.Dy()
	dw, dh := w, h
	if orientation >= 5 {
		dw, dh = h, w
	}
	src := image.NewNRGBA(image.Rect(0, 0, w, h))
	draw.Draw(src, src.Bounds(), img, b.Min, draw.Src)
	dst := image.NewNRGBA(image.Rect(0, 0, dw, dh))
	for y := range h {
		for x := range w {
			var dx, dy int
			switch orientation {
			case 2: // mirror horizontal
				dx, dy = w-1-x, y
			case 3: // rotate 180
				dx, dy = w-1-x, h-1-y
			case 4: // mirror vertical
				dx, dy = x, h-1-y
			case 5: // transpose
				dx, dy = y, x
			case 6: // rotate 90 clockwise
				dx, dy = h-1-y, x
			case 7: // transverse
				dx, dy = h-1-y, w-1-x
			case 8: // rotate 90 counter-clockwise
				dx, dy = y, w-1-x
			}
			dst.SetNRGBA(dx, dy, src.NRGBAAt(x, y))
		}
	}
	return dst
}

// exifOrientation reads the EXIF orientation tag from a JPEG, WebP or PNG file.
// It returns 1 (upright) when there is none or the metadata is malformed.
func exifOrientation(data []byte) int {
	var tiff []byte
	switch {
	case bytes.HasPrefix(data, []byte{0xFF, 0xD8}):
		tiff = jpegExif(data)
	case len(data) >= 12 && string(data[:4]) == "RIFF" && string(data[8:12]) == "WEBP":
		tiff = webpExif(data)
	case bytes.HasPrefix(data, []byte("\x89PNG\r\n\x1a\n")):
		tiff = pngExif(data)
	}
	if o := tiffOrientation(tiff); o >= 1 && o <= 8 {
		return o
	}
	return 1
}

func jpegExif(data []byte) []byte {
	pos := 2
	for pos+4 <= len(data) {
		if data[pos] != 0xFF {
			return nil
		}
		marker := data[pos+1]
		if marker == 0xFF { // fill byte
			pos++
			continue
		}
		if marker == 0xDA || marker == 0xD9 { // start of scan / end of image
			return nil
		}
		length := int(binary.BigEndian.Uint16(data[pos+2:]))
		end := pos + 2 + length
		if length < 2 || end > len(data) {
			return nil
		}
		if marker == 0xE1 && length >= 8 && bytes.HasPrefix(data[pos+4:end], []byte("Exif\x00\x00")) {
			return data[pos+10 : end]
		}
		pos = end
	}
	return nil
}

func webpExif(data []byte) []byte {
	for pos := 12; pos+8 <= len(data); {
		size := int(binary.LittleEndian.Uint32(data[pos+4:]))
		start, end := pos+8, pos+8+size
		if size < 0 || end > len(data) {
			return nil
		}
		if string(data[pos:pos+4]) == "EXIF" {
			return bytes.TrimPrefix(data[start:end], []byte("Exif\x00\x00"))
		}
		pos = end + size%2
	}
	return nil
}

func pngExif(data []byte) []byte {
	for pos := 8; pos+8 <= len(data); {
		size := int(binary.BigEndian.Uint32(data[pos:]))
		start, end := pos+8, pos+8+size
		if size < 0 || end+4 > len(data) {
			return nil
		}
		switch string(data[pos+4 : pos+8]) {
		case "eXIf":
			return data[start:end]
		case "IDAT", "IEND":
			return nil
		}
		pos = end + 4 // skip CRC
	}
	return nil
}

// tiffOrientation returns the Orientation (0x0112) value of IFD0 in a TIFF block, or 0.
func tiffOrientation(tiff []byte) int {
	if len(tiff) < 8 {
		return 0
	}
	var order binary.ByteOrder
	switch string(tiff[:2]) {
	case "II":
		order = binary.LittleEndian
	case "MM":
		order = binary.BigEndian
	default:
		return 0
	}
	ifd := int(order.Uint32(tiff[4:]))
	if ifd < 8 || ifd+2 > len(tiff) {
		return 0
	}
	count := int(order.Uint16(tiff[ifd:]))
	for i := range count {
		entry := ifd + 2 + i*12
		if entry+12 > len(tiff) {
			return 0
		}
		if order.Uint16(tiff[entry:]) == 0x0112 {
			return int(order.Uint16(tiff[entry+8:]))
		}
	}
	return 0
}

// readAll reads r fully, failing if it yields more than limit bytes.
func readAll(r io.Reader, limit int64) ([]byte, error) {
	data, err := io.ReadAll(io.LimitReader(r, limit+1))
	if err != nil {
		return nil, err
	}
	if int64(len(data)) > limit {
		return nil, ErrFileTooLarge
	}
	return data, nil
}
