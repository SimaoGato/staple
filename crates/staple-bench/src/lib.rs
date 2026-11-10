//! Dev-only benchmark harness: deterministic reference file generator and timing helpers.
//! Native timing only approximates WASM speed.

use std::fmt::Write as _;
use std::io;
use std::path::Path;
use std::time::Instant;

use staple_core::compress::{DEFAULT, Settings};

/// An operation run on one file's bytes. `Ok` carries the output size in bytes.
pub type Op = fn(&[u8]) -> Result<usize, String>;

/// The single call site that names [`DEFAULT`]: every compress op goes through here.
///
/// # Errors
///
/// Whatever the engine returns.
pub fn run(
    engine: impl Fn(&[u8], &Settings) -> Result<usize, String>,
    bytes: &[u8],
) -> Result<usize, String> {
    engine(bytes, &DEFAULT)
}

fn rust_engine(b: &[u8], s: &Settings) -> Result<Vec<u8>, String> {
    staple_core::compress::compress_pdf(b, s).map_err(|e| e.to_string())
}

/// Operation registry. Adding an operation is one line.
pub const OPS: &[(&str, Op)] = &[
    ("demo", |b| {
        // black_box: stops the optimizer deleting the unused result
        std::hint::black_box(staple_core::demo::demo_checksum(b, |_| {}).ok());
        Ok(0)
    }),
    ("compress-rust", |b| {
        run(|b, s| rust_engine(b, s).map(|v| v.len()), b)
    }),
    #[cfg(feature = "pdfium")]
    ("compress-pdfium", |b| {
        run(|b, s| pdfium::compress(b, s).map(|v| v.len()), b)
    }),
];

/// Looks up an operation by name.
#[must_use]
pub fn find_op(name: &str) -> Option<Op> {
    OPS.iter().find(|(n, _)| *n == name).map(|(_, f)| *f)
}

/// Median of `v` (mean of the middle pair for even length); 0 when empty.
#[must_use]
pub fn median(v: &[f64]) -> f64 {
    let mut s = v.to_vec();
    s.sort_by(f64::total_cmp);
    match s.len() {
        0 => 0.0,
        n if n % 2 == 1 => s[n / 2],
        n => f64::midpoint(s[n / 2 - 1], s[n / 2]),
    }
}

/// Maximum of `v`; 0 when empty.
#[must_use]
pub fn max(v: &[f64]) -> f64 {
    v.iter().copied().fold(0.0, f64::max)
}

/// Runs `op` on `bytes` `runs` times; returns each duration in ms and the output size.
///
/// # Errors
///
/// The first error `op` returns.
pub fn time_runs(op: Op, bytes: &[u8], runs: usize) -> Result<(Vec<f64>, usize), String> {
    let mut out = 0;
    let mut times = Vec::with_capacity(runs);
    for _ in 0..runs {
        let t = Instant::now();
        out = op(bytes)?;
        times.push(t.elapsed().as_secs_f64() * 1000.0);
    }
    Ok((times, out))
}

/// Shared by the `pdfium` feature and tests; see [`pdfium`].
#[cfg(feature = "pdfium")]
pub mod pdfium;

/// Sizes of the generated reference set.
#[derive(Debug, Clone)]
pub struct Spec {
    /// Pages in the image-heavy PDF.
    pub image_pages: u32,
    /// Pixel size of each image-heavy page image.
    pub image_dims: (u16, u16),
    /// JPEG quality of the page images.
    pub jpeg_quality: u8,
    /// Pages in the text PDF and lines per page.
    pub text_pages: u32,
    /// Lines of text per text page.
    pub text_lines: u32,
    /// Pages in the many-pages PDF.
    pub many_pages: u32,
    /// Photo pixel size (5 JPG + 5 PNG).
    pub photo_dims: (u16, u16),
}

impl Default for Spec {
    fn default() -> Self {
        Self {
            image_pages: 50,
            image_dims: (1240, 1754),
            jpeg_quality: 93,
            text_pages: 100,
            text_lines: 190,
            many_pages: 200,
            photo_dims: (4000, 3000),
        }
    }
}

impl Spec {
    /// Tiny spec for fast tests.
    #[must_use]
    pub fn small() -> Self {
        Self {
            image_pages: 3,
            image_dims: (64, 80),
            jpeg_quality: 90,
            text_pages: 4,
            text_lines: 10,
            many_pages: 6,
            photo_dims: (48, 32),
        }
    }
}

/// splitmix64: fixed algorithm, so output never changes with dependency bumps.
struct Rng(u64);

impl Rng {
    fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9e37_79b9_7f4a_7c15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xbf58_476d_1ce4_e5b9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94d0_49bb_1331_11eb);
        z ^ (z >> 31)
    }
}

/// RGB gradient plus seeded noise (noise keeps it hard to compress).
fn synth_rgb(w: u16, h: u16, seed: u64) -> Vec<u8> {
    let (w, h) = (usize::from(w), usize::from(h));
    let mut rng = Rng(seed);
    let mut out = Vec::with_capacity(w * h * 3);
    for y in 0..h {
        for x in 0..w {
            let n = rng.next();
            let base = [x * 255 / w, y * 255 / h, (x + y) * 255 / (w + h)];
            for (i, b) in base.into_iter().enumerate() {
                let noise = usize::from(n.to_le_bytes()[i] >> 5); // 0..7
                out.push(u8::try_from((b / 2 + noise).min(255)).unwrap_or(255));
            }
        }
    }
    out
}

fn jpeg(w: u16, h: u16, seed: u64, quality: u8) -> io::Result<Vec<u8>> {
    let mut out = Vec::new();
    jpeg_encoder::Encoder::new(&mut out, quality)
        .encode(&synth_rgb(w, h, seed), w, h, jpeg_encoder::ColorType::Rgb)
        .map_err(io::Error::other)?;
    Ok(out)
}

fn png(w: u16, h: u16, seed: u64) -> io::Result<Vec<u8>> {
    let mut out = Vec::new();
    let mut enc = png::Encoder::new(&mut out, u32::from(w), u32::from(h));
    enc.set_color(png::ColorType::Rgb);
    enc.set_depth(png::BitDepth::Eight);
    enc.set_compression(png::Compression::Fast);
    let mut wr = enc.write_header().map_err(io::Error::other)?;
    wr.write_image_data(&synth_rgb(w, h, seed))
        .map_err(io::Error::other)?;
    wr.finish().map_err(io::Error::other)?;
    Ok(out)
}

/// One page: its content stream and an optional JPEG image.
struct Page {
    content: Vec<u8>,
    image: Option<(u16, u16, Vec<u8>)>,
}

/// Hand-written PDF: no timestamps or IDs, so output is deterministic.
fn pdf(pages: &[Page]) -> Vec<u8> {
    let mut objs: Vec<Vec<u8>> = vec![Vec::new(); 3]; // catalog, pages, font filled below
    let mut kids = String::new();
    for p in pages {
        let page_id = objs.len() + 1;
        let _ = write!(kids, "{page_id} 0 R ");
        let (res, img_obj) = if let Some((w, h, data)) = &p.image {
            let mut o = format!(
                "<< /Type /XObject /Subtype /Image /Width {w} /Height {h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length {} >>\nstream\n",
                data.len()
            )
            .into_bytes();
            o.extend_from_slice(data);
            o.extend_from_slice(b"\nendstream");
            (format!("/XObject << /Im0 {} 0 R >> ", page_id + 2), Some(o))
        } else {
            (String::new(), None)
        };
        objs.push(
            format!(
                "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents {} 0 R /Resources << /Font << /F1 3 0 R >> {res}>> >>",
                page_id + 1
            )
            .into_bytes(),
        );
        let mut c = format!("<< /Length {} >>\nstream\n", p.content.len()).into_bytes();
        c.extend_from_slice(&p.content);
        c.extend_from_slice(b"\nendstream");
        objs.push(c);
        objs.extend(img_obj);
    }
    objs[0] = b"<< /Type /Catalog /Pages 2 0 R >>".to_vec();
    objs[1] = format!("<< /Type /Pages /Kids [{kids}] /Count {} >>", pages.len()).into_bytes();
    objs[2] = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>".to_vec();

    let mut out = b"%PDF-1.4\n".to_vec();
    let mut offsets = Vec::new();
    for (i, o) in objs.iter().enumerate() {
        offsets.push(out.len());
        out.extend_from_slice(format!("{} 0 obj\n", i + 1).as_bytes());
        out.extend_from_slice(o);
        out.extend_from_slice(b"\nendobj\n");
    }
    let xref = out.len();
    let mut tail = format!("xref\n0 {}\n0000000000 65535 f \n", objs.len() + 1);
    for off in offsets {
        let _ = writeln!(tail, "{off:010} 00000 n ");
    }
    let _ = write!(
        tail,
        "trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n",
        objs.len() + 1
    );
    out.extend_from_slice(tail.as_bytes());
    out
}

const WORDS: &[&str] = &[
    "staple", "document", "page", "paper", "invoice", "contract", "receipt", "letter", "form",
    "report", "local", "private", "browser", "file", "merge", "split", "compress", "image",
];

fn text_page(rng: &mut Rng, lines: u32) -> Page {
    let mut c = String::from("BT /F1 10 Tf 12 TL 40 800 Td\n");
    for _ in 0..lines {
        c.push('(');
        for _ in 0..8 {
            let w = WORDS[usize::try_from(rng.next() % WORDS.len() as u64).unwrap_or(0)];
            c.push_str(w);
            c.push(' ');
        }
        c.push_str(") '\n");
    }
    c.push_str("ET");
    Page {
        content: c.into_bytes(),
        image: None,
    }
}

fn text_pdf(pages: u32, lines: u32, seed: u64) -> Vec<u8> {
    let mut rng = Rng(seed);
    let v: Vec<Page> = (0..pages).map(|_| text_page(&mut rng, lines)).collect();
    pdf(&v)
}

/// Writes the reference set into `dir` and returns `(file name, size)` for each file.
///
/// # Errors
///
/// Any I/O or encoder failure.
pub fn generate(dir: &Path, spec: &Spec) -> io::Result<Vec<(String, u64)>> {
    std::fs::create_dir_all(dir)?;
    let mut files: Vec<(String, Vec<u8>)> = Vec::new();

    let (w, h) = spec.image_dims;
    let mut pages = Vec::new();
    for i in 0..spec.image_pages {
        pages.push(Page {
            content: b"q 595 0 0 842 0 0 cm /Im0 Do Q".to_vec(),
            image: Some((w, h, jpeg(w, h, 1000 + u64::from(i), spec.jpeg_quality)?)),
        });
    }
    files.push(("image-heavy-20mb.pdf".into(), pdf(&pages)));
    files.push((
        "text-1mb.pdf".into(),
        text_pdf(spec.text_pages, spec.text_lines, 2),
    ));
    files.push(("pages-200.pdf".into(), text_pdf(spec.many_pages, 3, 3)));

    let (w, h) = spec.photo_dims;
    for i in 1..=5u64 {
        files.push((format!("photo-{i:02}.jpg"), jpeg(w, h, 2000 + i, 92)?));
        files.push((format!("photo-{:02}.png", i + 5), png(w, h, 3000 + i)?));
    }

    let mut out = Vec::new();
    for (name, bytes) in files {
        std::fs::write(dir.join(&name), &bytes)?;
        out.push((name, bytes.len() as u64));
    }
    Ok(out)
}
