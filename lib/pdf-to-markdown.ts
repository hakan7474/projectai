import fs from 'fs/promises';
import path from 'path';

// PDF to Markdown converter using pdfjs-dist v4
let pdfjsLib: any = null;

async function loadPdfJs() {
  if (pdfjsLib) {
    return pdfjsLib;
  }

  // Skip loading during build time to avoid Turbopack errors
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    console.log('loadPdfJs: Skipping during build phase');
    return null;
  }

  try {
    console.log('loadPdfJs: Loading pdfjs-dist v4');
    
    // Use pdfjs-dist v4 which has better Node.js support
    // Try different import paths for v4 (try standard paths first, then legacy)
    let pdfjs: any;
    try {
      // Try standard v4 path first (most likely to work)
      pdfjs = await import('pdfjs-dist/build/pdf.mjs');
      console.log('loadPdfJs: Standard pdf.mjs import succeeded');
    } catch (error1) {
      try {
        // Try legacy pdf.mjs
        pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        console.log('loadPdfJs: Legacy pdf.mjs import succeeded');
      } catch (error2) {
        // Skip legacy pdf.js import as it may not exist in v4 and causes build errors
        // If all imports fail, log but don't throw during build
        console.warn('loadPdfJs: Standard import paths failed. PDF processing will not be available.', {
          error1: error1 instanceof Error ? error1.message : 'Unknown',
          error2: error2 instanceof Error ? error2.message : 'Unknown',
        });
        // Return null instead of throwing to allow build to continue
        // The actual error will be thrown when pdfToMarkdown is called
        return null;
      }
    }
    
    pdfjsLib = {
      getDocument: pdfjs.getDocument,
      GlobalWorkerOptions: pdfjs.GlobalWorkerOptions,
    };
    
    // Set worker file path for Node.js environment
    // pdfjs-dist v4 requires a worker file path, even in Node.js
    if (pdfjsLib.GlobalWorkerOptions) {
      try {
        // Get the actual file system path (not Turbopack format)
        const workerPath = path.resolve(process.cwd(), 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.mjs');
        
        // Verify the file exists
        try {
          await fs.access(workerPath);
          // Use file:// protocol for absolute file paths in Node.js
          pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${workerPath}`;
          console.log('loadPdfJs: workerSrc set to worker file path', { workerPath });
        } catch (accessError) {
          console.log('loadPdfJs: Worker file not found at path, trying without file://', { workerPath, error: accessError });
          // Try without file:// protocol
          pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;
        }
      } catch (e) {
        console.error('loadPdfJs: Failed to set workerSrc', e);
        // Last resort: try to disable worker (may not work in v4)
        try {
          pdfjsLib.GlobalWorkerOptions.workerSrc = '';
        } catch (e2) {
          console.error('loadPdfJs: Could not set workerSrc to empty string', e2);
        }
      }
    }
    
    console.log('loadPdfJs: pdfjs-dist v4 loaded successfully', {
      hasGetDocument: !!pdfjsLib.getDocument,
      hasGlobalWorkerOptions: !!pdfjsLib.GlobalWorkerOptions,
    });
    
    return pdfjsLib;
  } catch (error) {
    console.error('loadPdfJs: Error loading pdfjs-dist', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

export interface PDFToMarkdownOptions {
  preserveFormatting?: boolean;
  includePageNumbers?: boolean;
}

/**
 * Convert PDF buffer to Markdown format
 * Uses pdfjs-dist v4 for Node.js compatibility
 */
export async function pdfToMarkdown(
  buffer: Buffer,
  options: PDFToMarkdownOptions = {}
): Promise<string> {
  try {
    console.log('pdfToMarkdown: Starting conversion', {
      bufferSize: buffer.length,
      options,
    });

    // Use pdfjs-dist v4 (better Node.js support)
    const pdfjs = await loadPdfJs();
    if (!pdfjs || !pdfjs.getDocument) {
      throw new Error('PDF işleme kütüphanesi yüklenemedi. pdfjs-dist paketi kurulu olmalıdır.');
    }

    // Convert Buffer to Uint8Array (pdfjs-dist v4 requires Uint8Array, not Buffer)
    // Use Uint8Array.from() which works for both Buffer and Uint8Array
    // This creates a true Uint8Array that pdfjs-dist will accept
    const uint8Array = Uint8Array.from(buffer);

    console.log('pdfToMarkdown: Buffer converted to Uint8Array', {
      originalType: buffer.constructor.name,
      convertedType: uint8Array.constructor.name,
      isUint8Array: uint8Array instanceof Uint8Array,
      isBuffer: uint8Array instanceof Buffer,
      length: uint8Array.length,
    });

    // Load PDF document with pdfjs-dist
    console.log('pdfToMarkdown: Loading PDF document with pdfjs-dist');
    let pdf: any;
    try {
      // For Node.js, worker is disabled via GlobalWorkerOptions.workerSrc = null
      const loadingTask = pdfjs.getDocument({ 
        data: uint8Array,
        useSystemFonts: true,
        verbosity: 0, // Reduce logging
      });
      pdf = await loadingTask.promise;
      console.log('pdfToMarkdown: PDF document loaded successfully with pdfjs-dist');
    } catch (loadError) {
      console.error('pdfToMarkdown: Failed to load PDF document with pdfjs-dist', {
        error: loadError instanceof Error ? loadError.message : 'Unknown error',
      });
      throw new Error(`PDF yüklenemedi: ${loadError instanceof Error ? loadError.message : 'Bilinmeyen hata'}`);
    }

    console.log('pdfToMarkdown: PDF loaded with pdfjs-dist', { numPages: pdf.numPages });

    const markdownParts: string[] = [];

    // Process each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      console.log(`pdfToMarkdown: Processing page ${pageNum}/${pdf.numPages}`);
      
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Convert text items to Markdown
      let pageText = '';
      let currentY = -1;

      for (const item of textContent.items) {
        const itemY = (item as any).transform?.[5] || 0;
        
        // Add line break if Y position changed significantly (new line)
        if (currentY !== -1 && Math.abs(itemY - currentY) > 5) {
          pageText += '\n';
        }

        // Add text
        const text = (item as any).str || '';
        pageText += text + ' ';

        currentY = itemY;
      }

      // Add page separator if needed
      if (options.includePageNumbers) {
        markdownParts.push(`\n---\n### Sayfa ${pageNum}\n---\n\n`);
      }

      markdownParts.push(pageText.trim());
    }

    const markdown = markdownParts.join('\n\n');

    console.log('pdfToMarkdown: Conversion completed with pdfjs-dist', {
      markdownLength: markdown.length,
      pages: pdf.numPages,
    });

    return markdown;
  } catch (error) {
    console.error('pdfToMarkdown: All methods failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * Convert PDF file to Markdown format
 */
export async function pdfFileToMarkdown(
  filePath: string,
  options: PDFToMarkdownOptions = {}
): Promise<string> {
  const buffer = await fs.readFile(filePath);
  return await pdfToMarkdown(buffer, options);
}

