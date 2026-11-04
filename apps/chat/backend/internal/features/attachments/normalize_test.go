package attachments

import (
	"bytes"
	"encoding/binary"
	"errors"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"testing"
)

// exifBlock builds a minimal little-endian TIFF/EXIF payload with an Orientation
// tag and a GPS IFD pointer, the way a phone camera records them.
func exifBlock(orientation uint16) []byte {
	var b bytes.Buffer
	b.WriteString("Exif\x00\x00")
	b.WriteString("II")
	_ = binary.Write(&b, binary.LittleEndian, uint16(42))
	_ = binary.Write(&b, binary.LittleEndian, uint32(8))
	_ = binary.Write(&b, binary.LittleEndian, uint16(2)) // two IFD0 entries
	// Orientation (0x0112), SHORT, count 1
	_ = binary.Write(&b, binary.LittleEndian, []uint16{0x0112, 3})
	_ = binary.Write(&b, binary.LittleEndian, uint32(1))
	_ = binary.Write(&b, binary.LittleEndian, []uint16{orientation, 0})
	// GPSInfo pointer (0x8825), LONG, count 1 -> dummy offset
	_ = binary.Write(&b, binary.LittleEndian, []uint16{0x8825, 4})
	_ = binary.Write(&b, binary.LittleEndian, uint32(1))
	_ = binary.Write(&b, binary.LittleEndian, uint32(0x4742)) // "GB" marker that must not survive
	_ = binary.Write(&b, binary.LittleEndian, uint32(0))
	return b.Bytes()
}

// jpegWithExif encodes img as JPEG and inserts an APP1 EXIF segment after SOI.
func jpegWithExif(t *testing.T, img image.Image, orientation uint16) []byte {
	t.Helper()
	var plain bytes.Buffer
	if err := jpeg.Encode(&plain, img, &jpeg.Options{Quality: 90}); err != nil {
		t.Fatal(err)
	}
	exif := exifBlock(orientation)
	var out bytes.Buffer
	out.Write([]byte{0xFF, 0xD8, 0xFF, 0xE1})
	_ = binary.Write(&out, binary.BigEndian, uint16(len(exif)+2))
	out.Write(exif)
	out.Write(plain.Bytes()[2:])
	return out.Bytes()
}

func solid(w, h int, c color.Color) *image.NRGBA {
	img := image.NewNRGBA(image.Rect(0, 0, w, h))
	for y := range h {
		for x := range w {
			img.Set(x, y, c)
		}
	}
	return img
}

func decode(t *testing.T, data []byte) image.Image {
	t.Helper()
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		t.Fatalf("decode: %v", err)
	}
	return img
}

func TestNormalizeImage_AppliesOrientationAndStripsMetadata(t *testing.T) {
	// Stored 40x20 with orientation 6 (rotate 90 clockwise) displays as 20x40.
	// The red top-left pixel block ends up in the top-right corner.
	src := solid(40, 20, color.NRGBA{B: 255, A: 255})
	for y := range 6 {
		for x := range 6 {
			src.Set(x, y, color.NRGBA{R: 255, A: 255})
		}
	}
	data := jpegWithExif(t, src, 6)
	if exifOrientation(data) != 6 || !bytes.Contains(data, []byte("Exif")) {
		t.Fatal("test fixture does not carry EXIF orientation")
	}

	out, mime, err := normalizeImage(data)
	if err != nil {
		t.Fatal(err)
	}
	if mime != "image/jpeg" {
		t.Fatalf("mime = %s", mime)
	}
	img := decode(t, out)
	if b := img.Bounds(); b.Dx() != 20 || b.Dy() != 40 {
		t.Fatalf("size = %v, want 20x40", b)
	}
	r, _, bl, _ := img.At(17, 2).RGBA()
	if r < 0xC000 || bl > 0x4000 {
		t.Errorf("top-right pixel is not red after rotation: r=%x b=%x", r, bl)
	}
	if bytes.Contains(out, []byte("Exif")) || exifOrientation(out) != 1 {
		t.Error("EXIF survived normalisation")
	}
	if bytes.Contains(out, []byte("GB")) && bytes.Contains(out, []byte{0x42, 0x47, 0x00, 0x00}) {
		t.Error("GPS pointer survived normalisation")
	}
}

func TestNormalizeImage_CapsLongestEdge(t *testing.T) {
	var buf bytes.Buffer
	if err := png.Encode(&buf, solid(4000, 1000, color.NRGBA{G: 200, A: 255})); err != nil {
		t.Fatal(err)
	}
	out, mime, err := normalizeImage(buf.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	b := decode(t, out).Bounds()
	if b.Dx() != MaxImageEdge || b.Dy() != 512 {
		t.Fatalf("size = %dx%d, want %dx512", b.Dx(), b.Dy(), MaxImageEdge)
	}
	if mime != "image/jpeg" || len(out) >= buf.Len()*2 {
		t.Errorf("unexpected output: mime=%s len=%d", mime, len(out))
	}
}

func TestNormalizeImage_SmallImageIsNotUpscaled(t *testing.T) {
	var buf bytes.Buffer
	_ = png.Encode(&buf, solid(30, 20, color.NRGBA{R: 9, A: 255}))
	out, _, err := normalizeImage(buf.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	if b := decode(t, out).Bounds(); b.Dx() != 30 || b.Dy() != 20 {
		t.Fatalf("size = %v", b)
	}
}

func TestNormalizeImage_KeepsAlphaAsPNG(t *testing.T) {
	img := solid(8, 8, color.NRGBA{R: 255, A: 255})
	img.SetNRGBA(0, 0, color.NRGBA{})
	var buf bytes.Buffer
	_ = png.Encode(&buf, img)
	out, mime, err := normalizeImage(buf.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	if mime != "image/png" {
		t.Fatalf("mime = %s", mime)
	}
	if _, _, _, a := decode(t, out).At(0, 0).RGBA(); a != 0 {
		t.Errorf("transparent pixel lost its alpha: %x", a)
	}
}

func TestNormalizeImage_AllOrientationsKeepPixelCount(t *testing.T) {
	src := solid(6, 4, color.NRGBA{R: 1, G: 2, B: 3, A: 255})
	for o := 1; o <= 8; o++ {
		got := applyOrientation(src, o).Bounds()
		wantW, wantH := 6, 4
		if o >= 5 {
			wantW, wantH = 4, 6
		}
		if got.Dx() != wantW || got.Dy() != wantH {
			t.Errorf("orientation %d: size %v", o, got)
		}
	}
	if applyOrientation(src, 0) != image.Image(src) || applyOrientation(src, 9) != image.Image(src) {
		t.Error("out-of-range orientation must leave the image untouched")
	}
}

func TestNormalizeImage_RejectsGarbageAndBombs(t *testing.T) {
	if _, _, err := normalizeImage([]byte("not an image")); !errors.Is(err, ErrInvalidImage) {
		t.Errorf("garbage: err = %v", err)
	}
	// A valid PNG header declaring 30000x30000 pixels (900 MP) must be refused
	// from the header alone, before any pixel data is allocated.
	var buf bytes.Buffer
	_ = png.Encode(&buf, solid(2, 2, color.NRGBA{A: 255}))
	bomb := buf.Bytes()
	binary.BigEndian.PutUint32(bomb[16:], 30000)
	binary.BigEndian.PutUint32(bomb[20:], 30000)
	if _, _, err := normalizeImage(bomb); !errors.Is(err, ErrInvalidImage) {
		t.Errorf("bomb: err = %v", err)
	}
}

func TestExifOrientation_MalformedInputIsUpright(t *testing.T) {
	cases := map[string][]byte{
		"empty":          nil,
		"truncated jpeg": {0xFF, 0xD8, 0xFF, 0xE1, 0x00},
		"no exif jpeg":   {0xFF, 0xD8, 0xFF, 0xDA, 0x00, 0x02},
		"short webp":     []byte("RIFF\x04\x00\x00\x00WEBP"),
		"short png":      []byte("\x89PNG\r\n\x1a\n"),
	}
	for name, data := range cases {
		if got := exifOrientation(data); got != 1 {
			t.Errorf("%s: orientation = %d, want 1", name, got)
		}
	}
	if tiffOrientation([]byte("XX\x00\x00\x00\x00\x00\x00")) != 0 {
		t.Error("unknown byte order must yield 0")
	}
}

func TestExifOrientation_WebPAndPNGContainers(t *testing.T) {
	tiff := exifBlock(8)[6:]

	var webp bytes.Buffer
	webp.WriteString("RIFF")
	_ = binary.Write(&webp, binary.LittleEndian, uint32(4+8+len(tiff)))
	webp.WriteString("WEBPEXIF")
	_ = binary.Write(&webp, binary.LittleEndian, uint32(len(tiff)))
	webp.Write(tiff)
	if got := exifOrientation(webp.Bytes()); got != 8 {
		t.Errorf("webp orientation = %d, want 8", got)
	}

	var p bytes.Buffer
	p.WriteString("\x89PNG\r\n\x1a\n")
	_ = binary.Write(&p, binary.BigEndian, uint32(len(tiff)))
	p.WriteString("eXIf")
	p.Write(tiff)
	p.Write([]byte{0, 0, 0, 0})
	if got := exifOrientation(p.Bytes()); got != 8 {
		t.Errorf("png orientation = %d, want 8", got)
	}
}

func TestReadAllAndExtension(t *testing.T) {
	if _, err := readAll(bytes.NewReader(make([]byte, 11)), 10); !errors.Is(err, ErrFileTooLarge) {
		t.Errorf("err = %v", err)
	}
	if got := withImageExtension("../x/photo.HEIC.webp", "image/jpeg"); got != "photo.HEIC.jpg" {
		t.Errorf("got %q", got)
	}
	if got := withImageExtension("a", "image/png"); got != "a.png" {
		t.Errorf("got %q", got)
	}
}
